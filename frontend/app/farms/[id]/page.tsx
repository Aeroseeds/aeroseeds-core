"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface Farm {
  id: string;
  name: string;
  location: string | null;
  sizeHa: number | null;
  notes: string | null;
  scanCount: number;
  lastScanAt: string | null;
}

type ScanMode = "single" | "batch";
type ScanStatus = "processing" | "done" | "failed";

interface FarmScan {
  id: string;
  mode: ScanMode;
  status: ScanStatus;
  totalImages: number;
  diagnosedCount: number;
  rejectedCount: number;
  uncertainCount: number;
  dominantFinding: string | null;
  createdAt: string;
}

interface DiseaseBreakdownEntry {
  name: string;
  count: number;
}

function scanStatusPillClass(status: ScanStatus): string {
  if (status === "done") return "batch-status-success";
  if (status === "processing") return "batch-status-uncertain";
  return "batch-status-rejected";
}

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const farmId = params.id;

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scans, setScans] = useState<FarmScan[]>([]);
  const [diseaseBreakdown, setDiseaseBreakdown] = useState<DiseaseBreakdownEntry[]>([]);
  const [loadingScans, setLoadingScans] = useState(true);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sizeHa, setSizeHa] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  async function loadFarm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/farms/${farmId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load farm.");
      }
      setFarm(data);
      setName(data.name || "");
      setLocation(data.location || "");
      setSizeHa(data.sizeHa != null ? String(data.sizeHa) : "");
      setNotes(data.notes || "");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFarmScans() {
    setLoadingScans(true);
    try {
      const res = await fetch(`${BACKEND_URL}/farms/${farmId}/scans`);
      const data = await res.json();
      if (res.ok) {
        setScans(data.scans);
        setDiseaseBreakdown(data.diseaseBreakdown);
      }
    } catch {
      // Scan history is a secondary panel here; leave it empty on failure.
    } finally {
      setLoadingScans(false);
    }
  }

  useEffect(() => {
    if (farmId) {
      void loadFarm();
      void loadFarmScans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError("Name is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/farms/${farmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || null,
          sizeHa: sizeHa ? Number(sizeHa) : null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save farm.");
      }
      setFarm(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadReport() {
    setDownloadingReport(true);
    setReportError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/reports/farm/${farmId}`);
      if (!res.ok) {
        throw new Error("Report generation isn't available yet.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `farm-${farmId}-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Report generation isn't available yet.";
      setReportError(message);
    } finally {
      setDownloadingReport(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/farms/${farmId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete farm.");
      }
      router.push("/farms");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setDeleteError(message);
      setDeleting(false);
    }
  }

  return (
    <main className="scan-page">
      <div className="scan-header">
        <h1 className="scan-title">{loading ? "Farm" : farm?.name || "Farm"}</h1>
        <p className="scan-subtitle">
          <Link href="/farms" className="farm-back-link">
            ← Back to farms
          </Link>
        </p>
      </div>

      <div className="farms-page-body">
        {loading && <p className="result-text">Loading farm…</p>}
        {error && <div className="scan-error">{error}</div>}

        {!loading && !error && farm && (
          <>
            <div className="farm-card-stats farm-detail-stats">
              <div className="farm-card-stat">
                <p className="batch-stat-value farm-card-stat-value">{farm.scanCount}</p>
                <p className="batch-stat-label">Scans</p>
              </div>
              <div className="farm-card-stat">
                <p className="farm-card-stat-value">
                  {farm.lastScanAt ? new Date(farm.lastScanAt).toLocaleDateString() : "—"}
                </p>
                <p className="batch-stat-label">Last scan</p>
              </div>
              <button
                type="button"
                className="upload-bar-button"
                onClick={handleDownloadReport}
                disabled={downloadingReport}
              >
                {downloadingReport ? "Preparing…" : "Download farm report (PDF)"}
              </button>
            </div>
            {reportError && <p className="notice-secondary scan-actions-error">{reportError}</p>}

            <form className="farm-form" onSubmit={handleSave}>
              <div className="farm-form-row">
                <label className="result-label" htmlFor="farm-name">
                  Name
                </label>
                <input
                  id="farm-name"
                  className="farm-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="farm-form-row">
                <label className="result-label" htmlFor="farm-location">
                  Location
                </label>
                <input
                  id="farm-location"
                  className="farm-input"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="farm-form-row">
                <label className="result-label" htmlFor="farm-size">
                  Size (hectares)
                </label>
                <input
                  id="farm-size"
                  className="farm-input"
                  type="number"
                  step="any"
                  min="0"
                  value={sizeHa}
                  onChange={(e) => setSizeHa(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="farm-form-row">
                <label className="result-label" htmlFor="farm-notes">
                  Notes
                </label>
                <textarea
                  id="farm-notes"
                  className="farm-input farm-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {saveError && <div className="scan-error">{saveError}</div>}

              <div className="scan-actions farm-form-actions">
                <button type="submit" className="batch-run-button" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="farm-delete-button"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete farm"}
                </button>
              </div>

              {deleteError && <div className="scan-error">{deleteError}</div>}
            </form>

            {diseaseBreakdown.length > 0 && (
              <div className="farm-scan-history">
                <p className="result-label">Disease breakdown</p>
                <div className="batch-breakdown-list">
                  {diseaseBreakdown.map((entry) => (
                    <div className="batch-breakdown-row" key={entry.name}>
                      <span className="batch-breakdown-name">{entry.name}</span>
                      <span className="batch-breakdown-count">
                        {entry.count} image{entry.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="farm-scan-history">
              <p className="result-label">Scan history</p>
              {loadingScans && <p className="result-text">Loading scans…</p>}
              {!loadingScans && scans.length === 0 && (
                <p className="result-text">No scans assigned to this farm yet.</p>
              )}
              {!loadingScans && scans.length > 0 && (
                <div className="unassigned-scan-list">
                  {scans.map((scan) => (
                    <div key={scan.id} className="unassigned-scan-row">
                      <div className="unassigned-scan-row-info">
                        <div className="unassigned-scan-row-header">
                          <span className={`batch-status-pill ${scanStatusPillClass(scan.status)}`}>
                            {scan.status}
                          </span>
                          <p className="unassigned-scan-row-mode">
                            {scan.mode === "single" ? "Single scan" : "Batch scan"}
                          </p>
                          <p className="unassigned-scan-row-date">
                            {new Date(scan.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="result-text">
                          {scan.dominantFinding || "No finding yet"} · {scan.totalImages} image
                          {scan.totalImages === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
