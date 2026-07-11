import { reportStyles } from "./reportStyles.css";
import { escapeHtml } from "./escapeHtml";

export interface ScanReportRecommendation {
  text: string;
  buyUrl?: string;
}

export interface ScanReportResultRow {
  filename: string;
  status: string;
  diseaseName: string | null;
  predictedClass: string | null;
  cause: string | null;
  symptoms: string | null;
  treatment: string | null;
  prevention: string | null;
  recommendations: ScanReportRecommendation[];
  message: string | null;
  observed: string | null;
}

export interface ScanReportData {
  scan: {
    id: string;
    mode: string;
    status: string;
    totalImages: number;
    diagnosedCount: number;
    rejectedCount: number;
    uncertainCount: number;
    dominantFinding: string | null;
    createdAt: Date;
    completedAt: Date | null;
    results: ScanReportResultRow[];
  };
  farmName: string | null;
  companyName: string;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface FindingGroup {
  key: string;
  status: string;
  diseaseName: string | null;
  cause: string | null;
  symptoms: string | null;
  treatment: string | null;
  prevention: string | null;
  recommendations: ScanReportRecommendation[];
  message: string | null;
  observed: string | null;
  filenames: string[];
}

function groupFindings(results: ScanReportResultRow[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();

  for (const row of results) {
    const key =
      row.status === "success"
        ? `success:${row.diseaseName || row.predictedClass || "unknown"}`
        : `${row.status}:${row.message || ""}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        status: row.status,
        diseaseName: row.diseaseName,
        cause: row.cause,
        symptoms: row.symptoms,
        treatment: row.treatment,
        prevention: row.prevention,
        recommendations: row.recommendations,
        message: row.message,
        observed: row.observed,
        filenames: [],
      };
      groups.set(key, group);
    }
    group.filenames.push(row.filename);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.status === b.status) return b.filenames.length - a.filenames.length;
    const order: Record<string, number> = { success: 0, uncertain: 1, rejected: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });
}

function renderRecommendations(recommendations: ScanReportRecommendation[]): string {
  if (recommendations.length === 0) return "";
  const items = recommendations
    .map((rec) => {
      const link = rec.buyUrl
        ? ` <a class="rec-link" href="${escapeHtml(rec.buyUrl)}">Where to find it</a>`
        : "";
      return `<li class="rec-item">${escapeHtml(rec.text)}${link}</li>`;
    })
    .join("");
  return `
    <div class="finding-block">
      <p class="finding-block-title">What to use</p>
      <ul class="rec-list">${items}</ul>
    </div>`;
}

function renderSuccessCard(group: FindingGroup, totalImages: number): string {
  const count = group.filenames.length;
  const coverage =
    totalImages > 1 ? `Found in ${count} of ${totalImages} images reviewed.` : `Found in the image reviewed.`;

  return `
    <div class="finding-card finding-card-success">
      <div class="finding-card-header">
        <p class="finding-name">${escapeHtml(group.diseaseName || "Unidentified issue")}</p>
        <p class="finding-coverage">${escapeHtml(coverage)}</p>
      </div>
      ${
        group.cause || group.symptoms
          ? `<p class="finding-prose">${
              group.cause ? escapeHtml(group.cause) + " " : ""
            }${group.symptoms ? escapeHtml(group.symptoms) : ""}</p>`
          : ""
      }
      ${
        group.treatment
          ? `<div class="finding-block">
              <p class="finding-block-title">What to do</p>
              <p class="finding-prose">${escapeHtml(group.treatment)}</p>
            </div>`
          : ""
      }
      ${
        group.prevention
          ? `<div class="finding-block">
              <p class="finding-block-title">Going forward</p>
              <p class="finding-prose">${escapeHtml(group.prevention)}</p>
            </div>`
          : ""
      }
      ${renderRecommendations(group.recommendations)}
    </div>`;
}

function renderNonSuccessCard(group: FindingGroup, label: string, cardClass: string): string {
  const count = group.filenames.length;
  return `
    <div class="finding-card ${cardClass}">
      <div class="finding-card-header">
        <p class="finding-name">${escapeHtml(label)}</p>
        <p class="finding-coverage">${count} image${count === 1 ? "" : "s"}</p>
      </div>
      ${group.message ? `<p class="finding-prose">${escapeHtml(group.message)}</p>` : ""}
      ${group.observed ? `<p class="finding-prose muted">${escapeHtml(group.observed)}</p>` : ""}
    </div>`;
}

export function renderScanReportHtml(data: ScanReportData): string {
  const { scan, farmName, companyName } = data;
  const groups = groupFindings(scan.results);

  const findingCards = groups
    .map((group) => {
      if (group.status === "success") return renderSuccessCard(group, scan.totalImages);
      if (group.status === "uncertain")
        return renderNonSuccessCard(group, "Needs a closer look", "finding-card-uncertain");
      return renderNonSuccessCard(group, "Could not be diagnosed", "finding-card-rejected");
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Scan Report</title>
    <style>${reportStyles}</style>
  </head>
  <body>
    <p class="report-title">Field Scan Report</p>
    <p class="report-subtitle">${escapeHtml(companyName)} · ${escapeHtml(
    farmName || "Unassigned scan"
  )} · ${formatDate(scan.createdAt)}</p>

    <div class="report-section">
      <p class="report-section-title">Scan details</p>
      <div class="field-grid">
        <div class="field">
          <span class="field-label">Farm</span>
          <span class="field-value">${escapeHtml(farmName || "Unassigned")}</span>
        </div>
        <div class="field">
          <span class="field-label">Mode</span>
          <span class="field-value">${scan.mode === "single" ? "Single image" : "Batch"}</span>
        </div>
        <div class="field">
          <span class="field-label">Started</span>
          <span class="field-value">${formatDate(scan.createdAt)}</span>
        </div>
        <div class="field">
          <span class="field-label">Completed</span>
          <span class="field-value">${formatDate(scan.completedAt)}</span>
        </div>
        <div class="field">
          <span class="field-label">Status</span>
          <span class="field-value"><span class="pill pill-${escapeHtml(
            scan.status
          )}">${escapeHtml(scan.status)}</span></span>
        </div>
        <div class="field">
          <span class="field-label">Dominant finding</span>
          <span class="field-value">${escapeHtml(scan.dominantFinding || "—")}</span>
        </div>
      </div>
    </div>

    <div class="report-section">
      <p class="report-section-title">At a glance</p>
      <div class="stat-row">
        <div class="stat">
          <span class="stat-value">${scan.totalImages}</span>
          <span class="stat-label">Images scanned</span>
        </div>
        <div class="stat">
          <span class="stat-value">${scan.diagnosedCount}</span>
          <span class="stat-label">Diagnosed</span>
        </div>
        <div class="stat">
          <span class="stat-value">${scan.uncertainCount}</span>
          <span class="stat-label">Needs review</span>
        </div>
        <div class="stat">
          <span class="stat-value">${scan.rejectedCount}</span>
          <span class="stat-label">Rejected</span>
        </div>
      </div>
    </div>

    <div class="report-section">
      <p class="report-section-title">What we found</p>
      ${
        findingCards ||
        `<p class="empty-note">No findings were recorded for this scan.</p>`
      }
    </div>
  </body>
</html>`;
}
