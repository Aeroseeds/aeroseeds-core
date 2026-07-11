import fs from "fs";
import path from "path";
import type { Browser } from "puppeteer-core";
import { prisma } from "../db/prismaClient";
import {
  letterheadImagePath,
  reportCompanyName,
  reportCompanyAddress,
  reportCompanyPhone,
  reportCompanyEmail,
  reportCompanyWebsite,
} from "../config";
import { getScanById, getScansByFarm, computeDiseaseBreakdown } from "./scanPersistenceService";
import { renderScanReportHtml } from "../templates/scanReport.html";
import { renderFarmReportHtml } from "../templates/farmReport.html";
import { escapeHtml } from "../templates/escapeHtml";

// @sparticuz/chromium ships a statically-linked Linux Chromium build, which
// is what Render's `runtime: node` web service needs (it has no system
// Chrome/libs, unlike a Docker runtime). On non-Linux dev machines that
// binary doesn't run, so we fall back to full `puppeteer`, which bundles its
// own Chromium for the local platform. Swap this for the sparticuz path
// everywhere if the backend ever moves to `runtime: docker`.
//
// Launching Chromium (extracting the sparticuz binary, then booting it) takes
// several seconds, and used to happen on every single report download. It's
// kept running as a singleton instead and reused across requests -- only the
// page is created/torn down per report.
let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.launch() as unknown as Browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }

  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

let cachedLogoDataUri: string | null = null;

function loadLetterheadDataUri(): string {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  const resolved = path.resolve(letterheadImagePath);
  const buffer = fs.readFileSync(resolved);
  const ext = path.extname(resolved).slice(1) || "png";
  cachedLogoDataUri = `data:image/${ext};base64,${buffer.toString("base64")}`;
  return cachedLogoDataUri;
}

function buildHeaderTemplate(letterheadDataUri: string): string {
  return `
    <div style="width:100%; padding:14px 40px 0; margin:0; display:flex; align-items:center; justify-content:space-between; font-family:Helvetica,Arial,sans-serif;">
      <img src="${letterheadDataUri}" style="height:30px;" />
      <div style="text-align:right; font-size:8px; line-height:1.5; color:#4a4a45;">
        <div>${escapeHtml(reportCompanyAddress)}</div>
        <div>${escapeHtml(reportCompanyPhone)} &nbsp;&bull;&nbsp; ${escapeHtml(reportCompanyEmail)}</div>
        <div style="color:#0f5c3a; font-weight:700;">${escapeHtml(reportCompanyWebsite)}</div>
      </div>
    </div>`;
}

function buildFooterTemplate(): string {
  const contactLine = `${reportCompanyName} &nbsp;|&nbsp; ${reportCompanyPhone} &nbsp;|&nbsp; ${reportCompanyEmail} &nbsp;|&nbsp; ${reportCompanyWebsite}`;
  return `
    <div style="width:100%; padding:6px 40px 0; margin:0; border-top:1px solid #dcdcd6; display:flex; align-items:center; justify-content:space-between; font-family:Helvetica,Arial,sans-serif; font-size:7.5px; color:#8a8a84;">
      <span>${contactLine}</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`;
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const letterheadDataUri = loadLetterheadDataUri();
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(letterheadDataUri),
      footerTemplate: buildFooterTemplate(),
      margin: { top: "80px", bottom: "56px", left: "40px", right: "40px" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function renderScanReportPdf(scanId: string): Promise<Buffer> {
  const scan = await getScanById(scanId);
  if (!scan) {
    throw new Error("Scan not found.");
  }

  let farmName: string | null = null;
  if (scan.farmId) {
    const farm = await prisma.farm.findUnique({
      where: { id: scan.farmId },
      select: { name: true },
    });
    farmName = farm?.name ?? null;
  }

  const html = renderScanReportHtml({
    scan: {
      id: scan.id,
      mode: scan.mode,
      status: scan.status,
      totalImages: scan.totalImages,
      diagnosedCount: scan.diagnosedCount,
      rejectedCount: scan.rejectedCount,
      uncertainCount: scan.uncertainCount,
      dominantFinding: scan.dominantFinding,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
      results: scan.results.map((r) => ({
        filename: r.filename,
        status: r.status,
        diseaseName: r.diseaseName,
        predictedClass: r.predictedClass,
        cause: r.cause,
        symptoms: r.symptoms,
        treatment: r.treatment,
        prevention: r.prevention,
        recommendations: Array.isArray(r.recommendations)
          ? (r.recommendations as unknown as { text: string; buyUrl?: string }[])
          : [],
        message: r.message,
        observed: r.observed,
      })),
    },
    farmName,
    companyName: reportCompanyName,
  });

  return renderHtmlToPdf(html);
}

export async function renderFarmReportPdf(farmId: string): Promise<Buffer> {
  const farm = await prisma.farm.findUnique({ where: { id: farmId } });
  if (!farm) {
    throw new Error("Farm not found.");
  }

  const scans = await getScansByFarm(farmId);
  const diseaseBreakdown = computeDiseaseBreakdown(scans);

  // `byDisease` (and so diseaseBreakdown) is keyed by the model's short
  // predicted-class code (e.g. "MLB"), not the human-readable disease name
  // stored on each ScanResult -- those only match via `predictedClass`.
  // Fetch one representative row per code for the narrative detail (cause,
  // symptoms, treatment, prevention, recommendations); that text is
  // effectively static per disease class, so a single recent example is
  // enough to write the "what to do" guidance from.
  const representativeRows =
    diseaseBreakdown.length > 0
      ? await prisma.scanResult.findMany({
          where: {
            scan: { farmId },
            status: "success",
            predictedClass: { in: diseaseBreakdown.map((d) => d.name) },
          },
          distinct: ["predictedClass"],
          orderBy: { createdAt: "desc" },
          select: {
            predictedClass: true,
            diseaseName: true,
            cause: true,
            symptoms: true,
            treatment: true,
            prevention: true,
            recommendations: true,
          },
        })
      : [];
  const detailByDiseaseCode = new Map(representativeRows.map((r) => [r.predictedClass, r]));

  const totalImages = scans.reduce((sum, s) => sum + s.totalImages, 0);
  const totalDiagnosed = scans.reduce((sum, s) => sum + s.diagnosedCount, 0);
  const totalUncertain = scans.reduce((sum, s) => sum + s.uncertainCount, 0);
  const totalRejected = scans.reduce((sum, s) => sum + s.rejectedCount, 0);

  const html = renderFarmReportHtml({
    farm: {
      id: farm.id,
      name: farm.name,
      location: farm.location,
      sizeHa: farm.sizeHa,
      notes: farm.notes,
      createdAt: farm.createdAt,
    },
    scans: scans.map((scan) => ({
      id: scan.id,
      mode: scan.mode,
      status: scan.status,
      totalImages: scan.totalImages,
      diagnosedCount: scan.diagnosedCount,
      rejectedCount: scan.rejectedCount,
      uncertainCount: scan.uncertainCount,
      dominantFinding: scan.dominantFinding,
      createdAt: scan.createdAt,
    })),
    totalImages,
    totalUncertain,
    totalRejected,
    diseaseFindings: diseaseBreakdown.map((entry) => {
      const detail = detailByDiseaseCode.get(entry.name);
      return {
        name: detail?.diseaseName || entry.name,
        count: entry.count,
        share: totalDiagnosed > 0 ? entry.count / totalDiagnosed : 0,
        cause: detail?.cause ?? null,
        symptoms: detail?.symptoms ?? null,
        treatment: detail?.treatment ?? null,
        prevention: detail?.prevention ?? null,
        recommendations: Array.isArray(detail?.recommendations)
          ? (detail!.recommendations as unknown as { text: string; buyUrl?: string }[])
          : [],
      };
    }),
    companyName: reportCompanyName,
  });

  return renderHtmlToPdf(html);
}
