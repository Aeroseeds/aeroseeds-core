"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface RecentScan {
  id: string;
  farm_id: string | null;
  farm_name: string;
  created_at: string;
  mode: "single" | "batch";
  dominant_finding: string | null;
}

interface DiseaseBreakdownEntry {
  name: string;
  count: number;
}

interface DashboardSummary {
  total_scans: number;
  total_farms: number;
  total_images_processed: number;
  recent_scans: RecentScan[];
  disease_breakdown: DiseaseBreakdownEntry[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/dashboard/summary`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load dashboard.");
      }
      setSummary(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <main className="scan-page">
      <div className="scan-header">
        <h1 className="scan-title">Dashboard</h1>
        <p className="scan-subtitle">An overview of scans and findings across your farms.</p>
      </div>

      <div className="dashboard-body">
        {loading && <p className="result-text">Loading dashboard…</p>}
        {error && <div className="scan-error">{error}</div>}

        {!loading && !error && summary && (
          <>
            <div className="dashboard-stats">
              <div className="batch-stat">
                <p className="batch-stat-value">{summary.total_scans}</p>
                <p className="batch-stat-label">Total scans</p>
              </div>
              <div className="batch-stat">
                <p className="batch-stat-value">{summary.total_farms}</p>
                <p className="batch-stat-label">Total farms</p>
              </div>
              <div className="batch-stat">
                <p className="batch-stat-value">{summary.total_images_processed}</p>
                <p className="batch-stat-label">Images processed</p>
              </div>
            </div>

            <div className="dashboard-section">
              <p className="dashboard-section-title">Recent scans</p>
              {summary.recent_scans.length === 0 && (
                <p className="result-text">No scans yet.</p>
              )}
              {summary.recent_scans.length > 0 && (
                <div className="dashboard-scan-list">
                  {summary.recent_scans.map((scan) => (
                    <Link
                      key={scan.id}
                      href={scan.farm_id ? `/farms/${scan.farm_id}` : "/scans/unassigned"}
                      className="dashboard-scan-row"
                    >
                      <div className="dashboard-scan-row-info">
                        {scan.farm_id ? (
                          <p className="dashboard-scan-row-farm">{scan.farm_name}</p>
                        ) : (
                          <span className="dashboard-unassigned-pill">Unassigned</span>
                        )}
                        <p className="dashboard-scan-row-meta">
                          {new Date(scan.created_at).toLocaleString()} ·{" "}
                          {scan.mode === "single" ? "Single scan" : "Batch scan"}
                        </p>
                      </div>
                      <p className="dashboard-scan-row-finding">
                        {scan.dominant_finding || "No finding yet"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-section">
              <p className="dashboard-section-title">Disease breakdown</p>
              {summary.disease_breakdown.length === 0 && (
                <p className="result-text">No findings recorded yet.</p>
              )}
              {summary.disease_breakdown.length > 0 && (
                <div className="batch-breakdown-list">
                  {summary.disease_breakdown.map((entry) => (
                    <div className="batch-breakdown-row" key={entry.name}>
                      <span className="batch-breakdown-name">{entry.name}</span>
                      <span className="batch-breakdown-count">
                        {entry.count} image{entry.count === 1 ? "" : "s"}
                      </span>
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
