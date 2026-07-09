"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import Recommendations from "../Recommendations";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface TreatmentSource {
  title: string;
  url: string;
}

interface Diagnosis {
  disease_name: string;
  cause?: string;
  symptoms?: string;
  treatment?: string;
  prevention?: string;
  recommendations?: string[];
  sources?: TreatmentSource[];
}

type BatchStatus = "success" | "uncertain" | "rejected";

interface BatchResultItem {
  filename: string;
  status: BatchStatus;
  diagnosis: Diagnosis | null;
  message: string | null;
  observed?: string;
}

interface BatchSummary {
  total_images: number;
  rejected_images: number;
  diagnosed_images: number;
  by_status: { success: number; uncertain: number };
  by_disease: Record<string, number>;
  dominant_finding: string;
}

interface BatchResponse {
  summary: BatchSummary;
  results: BatchResultItem[];
}

interface SelectedImage {
  file: File;
  previewUrl: string;
}

function statusLabel(item: BatchResultItem): string {
  if (item.status === "success") return item.diagnosis?.disease_name || "Diagnosed";
  if (item.status === "uncertain") return "Needs expert review";
  return "Rejected";
}

export default function BatchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const scrollFadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleResultScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.classList.add("is-scrolling");
    if (scrollFadeTimeout.current) clearTimeout(scrollFadeTimeout.current);
    scrollFadeTimeout.current = setTimeout(() => {
      el.classList.remove("is-scrolling");
    }, 700);
  }

  const total = selected.length;

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const images = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const next = images.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setSelected((prev) => [...prev, ...next]);
    setResponse(null);
    setError(null);
  }

  function removeSelected(index: number) {
    setSelected((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  }

  function clearSelected() {
    selected.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setSelected([]);
    setResponse(null);
    setError(null);
  }

  function startFakeProgress(count: number) {
    setProcessedCount(0);
    const stepMs = Math.min(2000, Math.max(300, Math.round(15000 / count)));
    progressTimer.current = setInterval(() => {
      setProcessedCount((prev) => (prev < count - 1 ? prev + 1 : prev));
    }, stepMs);
  }

  function stopFakeProgress() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  async function handleRunBatch() {
    if (selected.length === 0) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setExpandedIndex(null);
    startFakeProgress(selected.length);

    try {
      const formData = new FormData();
      selected.forEach((s) => formData.append("images", s.file));

      const res = await fetch(`${BACKEND_URL}/diagnose-batch`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Batch diagnosis failed.");
      }

      setProcessedCount(selected.length);
      setResponse(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      stopFakeProgress();
      setLoading(false);
    }
  }

  const diseaseBreakdown = useMemo(() => {
    if (!response) return [];
    return Object.entries(response.summary.by_disease).filter(([, count]) => count > 0);
  }, [response]);

  return (
    <main className="scan-page">
      <div className="scan-header">
        <h1 className="scan-title">Batch Analysis</h1>
        <p className="scan-subtitle">
          Upload multiple images to scan a whole field at once.
        </p>
        <div className="mode-toggle">
          <Link href="/scan" className="mode-toggle-link">
            Single image
          </Link>
          <span className="mode-toggle-link mode-toggle-active">Batch</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => addFiles(e.target.files)}
        style={{ display: "none" }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error non-standard attributes for folder selection
        webkitdirectory=""
        directory=""
        onChange={(e) => addFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {selected.length === 0 && (
        <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
          <div className="upload-icon">+</div>
          <p className="upload-title">Select images</p>
          <p className="upload-hint">Choose multiple images (up to 200 per batch)</p>
          <button
            type="button"
            className="batch-folder-button"
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
          >
            or select a folder
          </button>
        </div>
      )}

      {selected.length > 0 && !response && (
        <div className="batch-selection">
          <div className="batch-selection-header">
            <p className="batch-selection-count">
              {total} image{total === 1 ? "" : "s"} selected
            </p>
            <div className="batch-selection-actions">
              <button
                type="button"
                className="upload-bar-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                Add more
              </button>
              <button
                type="button"
                className="upload-bar-button"
                onClick={clearSelected}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="batch-thumb-grid">
            {selected.map((s, i) => (
              <div className="batch-thumb" key={`${s.file.name}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.previewUrl} alt={s.file.name} />
                {!loading && (
                  <button
                    type="button"
                    className="batch-thumb-remove"
                    onClick={() => removeSelected(i)}
                    aria-label={`Remove ${s.file.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {!loading && (
            <div className="scan-actions">
              <button type="button" className="batch-run-button" onClick={handleRunBatch}>
                Scan {total} image{total === 1 ? "" : "s"}
              </button>
            </div>
          )}

          {loading && (
            <div className="batch-progress">
              <div className="upload-icon upload-icon-spinning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="42"
                    strokeDashoffset="16"
                    opacity="0.9"
                  />
                </svg>
              </div>
              <p className="batch-progress-text">
                Processing {processedCount} of {total} images…
              </p>
            </div>
          )}
        </div>
      )}

      {error && <div className="scan-error">{error}</div>}

      {response && (
        <div className="batch-results">
          <div className="batch-summary">
            <div className="batch-summary-stats">
              <div className="batch-stat">
                <p className="batch-stat-value">{response.summary.total_images}</p>
                <p className="batch-stat-label">Images scanned</p>
              </div>
              <div className="batch-stat">
                <p className="batch-stat-value">{response.summary.diagnosed_images}</p>
                <p className="batch-stat-label">Diagnosed images</p>
              </div>
              <div className="batch-stat">
                <p className="batch-stat-value">{response.summary.rejected_images}</p>
                <p className="batch-stat-label">Rejected images</p>
              </div>
              <div className="batch-stat">
                <p className="batch-stat-value">{response.summary.by_status.uncertain}</p>
                <p className="batch-stat-label">Needs expert review</p>
              </div>
            </div>

            <div className="batch-dominant">
              <p className="result-label">Dominant finding</p>
              <p className="batch-dominant-value">{response.summary.dominant_finding}</p>
            </div>

            {diseaseBreakdown.length > 0 && (
              <div className="batch-breakdown">
                <p className="result-label">Images by finding</p>
                <div className="batch-breakdown-list">
                  {diseaseBreakdown.map(([name, count]) => (
                    <div className="batch-breakdown-row" key={name}>
                      <span className="batch-breakdown-name">{name}</span>
                      <span className="batch-breakdown-count">
                        {count} image{count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="batch-result-grid">
            {response.results.map((item, i) => (
              <button
                type="button"
                key={`${item.filename}-${i}`}
                className={`batch-result-cell batch-result-${item.status}`}
                onClick={() => setExpandedIndex(i)}
              >
                {selected[i] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected[i].previewUrl} alt={item.filename} />
                )}
                <div className="batch-result-cell-label">
                  <span className={`batch-status-pill batch-status-${item.status}`}>
                    {item.status === "success"
                      ? "Diagnosed"
                      : item.status === "uncertain"
                      ? "Uncertain"
                      : "Rejected"}
                  </span>
                  <p className="batch-result-cell-text">{statusLabel(item)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="scan-actions">
            <button
              type="button"
              className="upload-bar-button"
              onClick={() => {
                clearSelected();
              }}
            >
              Start a new batch
            </button>
          </div>
        </div>
      )}

      {response && expandedIndex !== null && response.results[expandedIndex] && (
        <div className="batch-modal-overlay" onClick={() => setExpandedIndex(null)}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="batch-modal-close"
              onClick={() => setExpandedIndex(null)}
              aria-label="Close"
            >
              ×
            </button>

            {selected[expandedIndex] && (
              <div className="scan-image-panel batch-modal-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected[expandedIndex].previewUrl}
                  alt={response.results[expandedIndex].filename}
                />
              </div>
            )}

            {response.results[expandedIndex].status === "success" &&
              response.results[expandedIndex].diagnosis && (
                <div className="result-panel">
                  <div className="result-header">
                    <p className="result-disease">
                      {response.results[expandedIndex].diagnosis!.disease_name}
                    </p>
                  </div>
                  <div className="result-body" onScroll={handleResultScroll}>
                    <div className="result-section">
                      <p className="result-label">Cause</p>
                      <p className="result-text">
                        {response.results[expandedIndex].diagnosis!.cause || "Not available."}
                      </p>
                    </div>
                    <div className="result-section">
                      <p className="result-label">Symptoms</p>
                      <p className="result-text">
                        {response.results[expandedIndex].diagnosis!.symptoms || "Not available."}
                      </p>
                    </div>
                    <div className="result-section">
                      <p className="result-label">Treatment</p>
                      <p className="result-text">
                        {response.results[expandedIndex].diagnosis!.treatment || "Not available."}
                      </p>
                    </div>
                    <div className="result-section">
                      <p className="result-label">Prevention</p>
                      <p className="result-text">
                        {response.results[expandedIndex].diagnosis!.prevention || "Not available."}
                      </p>
                    </div>
                    <Recommendations
                      recommendations={response.results[expandedIndex].diagnosis!.recommendations}
                      sources={response.results[expandedIndex].diagnosis!.sources}
                    />
                  </div>
                </div>
              )}

            {response.results[expandedIndex].status !== "success" && (
              <div className="result-panel">
                <div className="result-body" onScroll={handleResultScroll}>
                  <p className="result-text">{response.results[expandedIndex].message}</p>
                  {response.results[expandedIndex].status === "uncertain" &&
                    response.results[expandedIndex].observed && (
                      <p className="notice-secondary">
                        {response.results[expandedIndex].observed}
                      </p>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
