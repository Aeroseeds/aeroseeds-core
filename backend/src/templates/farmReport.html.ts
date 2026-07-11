import { reportStyles } from "./reportStyles.css";
import { escapeHtml } from "./escapeHtml";

export interface FarmReportRecommendation {
  text: string;
  buyUrl?: string;
}

export interface FarmReportScanRow {
  id: string;
  mode: string;
  status: string;
  totalImages: number;
  diagnosedCount: number;
  rejectedCount: number;
  uncertainCount: number;
  dominantFinding: string | null;
  createdAt: Date;
}

export interface FarmReportDiseaseFinding {
  name: string;
  count: number;
  share: number;
  cause: string | null;
  symptoms: string | null;
  treatment: string | null;
  prevention: string | null;
  recommendations: FarmReportRecommendation[];
}

export interface FarmReportData {
  farm: {
    id: string;
    name: string;
    location: string | null;
    sizeHa: number | null;
    notes: string | null;
    createdAt: Date;
  };
  scans: FarmReportScanRow[];
  totalImages: number;
  totalUncertain: number;
  totalRejected: number;
  diseaseFindings: FarmReportDiseaseFinding[];
  companyName: string;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateShort(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function modeLabel(mode: string): string {
  return mode === "single" ? "Single image" : "Batch";
}

function renderRecommendations(recommendations: FarmReportRecommendation[]): string {
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

function renderDiseaseCard(finding: FarmReportDiseaseFinding): string {
  const pct = Math.round(finding.share * 100);
  const coverage = `${pct}% of diagnosed images (${finding.count})`;

  return `
    <div class="finding-card finding-card-success">
      <div class="finding-card-header">
        <p class="finding-name">${escapeHtml(finding.name)}</p>
        <p class="finding-coverage">${escapeHtml(coverage)}</p>
      </div>
      ${
        finding.cause || finding.symptoms
          ? `<p class="finding-prose">${
              finding.cause ? escapeHtml(finding.cause) + " " : ""
            }${finding.symptoms ? escapeHtml(finding.symptoms) : ""}</p>`
          : ""
      }
      ${
        finding.treatment
          ? `<div class="finding-block">
              <p class="finding-block-title">What to do</p>
              <p class="finding-prose">${escapeHtml(finding.treatment)}</p>
            </div>`
          : ""
      }
      ${
        finding.prevention
          ? `<div class="finding-block">
              <p class="finding-block-title">Going forward</p>
              <p class="finding-prose">${escapeHtml(finding.prevention)}</p>
            </div>`
          : ""
      }
      ${renderRecommendations(finding.recommendations)}
    </div>`;
}

export function renderFarmReportHtml(data: FarmReportData): string {
  const { farm, scans, totalImages, totalUncertain, totalRejected, diseaseFindings, companyName } = data;

  const totalDiagnosed = scans.reduce((sum, s) => sum + s.diagnosedCount, 0);

  const overviewParts: string[] = [];
  overviewParts.push(
    `${escapeHtml(farm.name)}${farm.location ? ` is located in ${escapeHtml(farm.location)}` : ""}${
      farm.sizeHa != null ? ` and covers about ${farm.sizeHa} hectares` : ""
    }, on record since ${formatDateShort(farm.createdAt)}.`
  );
  if (scans.length > 0) {
    overviewParts.push(
      `${scans.length} scan${scans.length === 1 ? " has" : "s have"} been run so far, covering ` +
        `${totalImages} image${totalImages === 1 ? "" : "s"}, of which ${totalDiagnosed} received a clear diagnosis.`
    );
  } else {
    overviewParts.push("No scans have been run on this farm yet.");
  }

  const findingCards = diseaseFindings.map(renderDiseaseCard).join("");

  const reviewNoteParts: string[] = [];
  if (totalUncertain > 0) {
    reviewNoteParts.push(
      `${totalUncertain} image${totalUncertain === 1 ? "" : "s"} could not be confidently diagnosed and may need a closer look.`
    );
  }
  if (totalRejected > 0) {
    reviewNoteParts.push(
      `${totalRejected} image${totalRejected === 1 ? " was" : "s were"} rejected (not a usable maize photo).`
    );
  }

  const scanItems = scans
    .map((scan) => {
      const summary =
        scan.status === "done"
          ? `${scan.totalImages} image${scan.totalImages === 1 ? "" : "s"} · ${escapeHtml(
              scan.dominantFinding || "no dominant finding"
            )}`
          : escapeHtml(scan.status === "processing" ? "Still processing" : "Failed to complete");
      return `
        <div class="timeline-row">
          <div class="timeline-date">${formatDate(scan.createdAt)}</div>
          <div class="timeline-body">
            <span class="pill pill-${scan.mode === "single" ? "success" : "uncertain"}">${escapeHtml(
        modeLabel(scan.mode)
      )}</span>
            <span class="timeline-summary">${summary}</span>
          </div>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Farm Report</title>
    <style>${reportStyles}</style>
  </head>
  <body>
    <p class="report-title">Farm Report</p>
    <p class="report-subtitle">${escapeHtml(companyName)} · ${escapeHtml(farm.name)} · ${formatDateShort(
    new Date()
  )}</p>

    <div class="report-section">
      <p class="report-section-title">Farm details</p>
      <div class="field-grid">
        <div class="field">
          <span class="field-label">Name</span>
          <span class="field-value">${escapeHtml(farm.name)}</span>
        </div>
        <div class="field">
          <span class="field-label">Location</span>
          <span class="field-value">${escapeHtml(farm.location || "—")}</span>
        </div>
        <div class="field">
          <span class="field-label">Size (hectares)</span>
          <span class="field-value">${farm.sizeHa != null ? farm.sizeHa : "—"}</span>
        </div>
        <div class="field">
          <span class="field-label">Farm since</span>
          <span class="field-value">${formatDateShort(farm.createdAt)}</span>
        </div>
      </div>
      <p class="finding-prose" style="margin-top:12px;">${overviewParts.join(" ")}</p>
      ${farm.notes ? `<p class="finding-prose muted">${escapeHtml(farm.notes)}</p>` : ""}
    </div>

    <div class="report-section">
      <p class="report-section-title">At a glance</p>
      <div class="stat-row">
        <div class="stat">
          <span class="stat-value">${scans.length}</span>
          <span class="stat-label">Total scans</span>
        </div>
        <div class="stat">
          <span class="stat-value">${totalImages}</span>
          <span class="stat-label">Images scanned</span>
        </div>
        <div class="stat">
          <span class="stat-value">${totalDiagnosed}</span>
          <span class="stat-label">Diagnosed images</span>
        </div>
      </div>
    </div>

    <div class="report-section">
      <p class="report-section-title">What we found</p>
      ${findingCards || `<p class="empty-note">No findings recorded yet.</p>`}
      ${reviewNoteParts.length > 0 ? `<p class="finding-prose muted">${escapeHtml(reviewNoteParts.join(" "))}</p>` : ""}
    </div>

    <div class="report-section">
      <p class="report-section-title">Scan history</p>
      ${
        scans.length === 0
          ? `<p class="empty-note">No scans recorded for this farm yet.</p>`
          : `<div class="timeline">${scanItems}</div>`
      }
    </div>
  </body>
</html>`;
}
