"use client";

import { useEffect, useState } from "react";
import ScanActions from "../../components/ScanActions";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type ScanMode = "single" | "batch";
type ScanStatus = "processing" | "done" | "failed";

interface Scan {
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

function statusPillClass(status: ScanStatus): string {
  if (status === "done") return "batch-status-success";
  if (status === "processing") return "batch-status-uncertain";
  return "batch-status-rejected";
}

export default function UnassignedScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadScans() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/scans/unassigned`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load scans.");
      }
      setScans(data.scans);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadScans();
  }, []);

  return (
    <main className="scan-page">
      <div className="scan-header">
        <h1 className="scan-title">Unassigned Scans</h1>
        <p className="scan-subtitle">Scans not yet linked to a farm.</p>
      </div>

      <div className="farms-page-body">
        {loading && <p className="result-text">Loading scans…</p>}
        {error && <div className="scan-error">{error}</div>}

        {!loading && !error && scans.length === 0 && (
          <p className="result-text">No unassigned scans.</p>
        )}

        {!loading && !error && scans.length > 0 && (
          <div className="unassigned-scan-list">
            {scans.map((scan) => (
              <div key={scan.id} className="unassigned-scan-row">
                <div className="unassigned-scan-row-info">
                  <div className="unassigned-scan-row-header">
                    <span className={`batch-status-pill ${statusPillClass(scan.status)}`}>
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
                <ScanActions scanId={scan.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
