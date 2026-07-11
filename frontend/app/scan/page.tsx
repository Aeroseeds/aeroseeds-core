"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import Recommendations from "../Recommendations";
import ScanActions from "../components/ScanActions";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface Recommendation {
  text: string;
  buyUrl?: string;
}

interface Diagnosis {
  disease_name: string;
  cause?: string;
  symptoms?: string;
  treatment?: string;
  prevention?: string;
  recommendations?: Recommendation[];
}

interface DiagnoseResponse {
  status: "success" | "rejected" | "uncertain";
  message?: string;
  diagnosis?: Diagnosis;
  observed?: string;
  scan_id?: string | null;
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const searchParams = useSearchParams();
  const farmIdParam = searchParams.get("farm_id");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollFadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleResultScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.classList.add("is-scrolling");
    if (scrollFadeTimeout.current) clearTimeout(scrollFadeTimeout.current);
    scrollFadeTimeout.current = setTimeout(() => {
      el.classList.remove("is-scrolling");
    }, 700);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);
    setError(null);
    setPreviewUrl(URL.createObjectURL(selected));

    void handleDiagnose(selected);
  }

  async function handleDiagnose(selected: File) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selected);

      const response = await fetch(`${BACKEND_URL}/diagnose`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Diagnosis failed.");
      }

      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="scan-page">
      <div className="scan-header">
        <h1 className="scan-title">New Analysis</h1>
        <p className="scan-subtitle">Upload your drone dataset to begin processing.</p>
        <div className="mode-toggle">
          <span className="mode-toggle-link mode-toggle-active">Single image</span>
          <Link href="/batch" className="mode-toggle-link">
            Batch
          </Link>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {!file && (
        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon">+</div>
          <p className="upload-title">Upload flight data</p>
          <p className="upload-hint">.TIFF, .JPG, or .ZIP archive</p>
        </div>
      )}

      {file && (
        <div className="upload-bar">
          <div className={`upload-icon ${loading ? "upload-icon-spinning" : ""}`}>
            {loading ? (
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
            ) : error ? (
              "!"
            ) : (
              "✓"
            )}
          </div>
          <div className="upload-bar-text">
            <p className="upload-bar-title">
              {loading ? "Analyzing…" : error ? "Analysis failed" : file.name}
            </p>
            <p className="upload-bar-hint">
              {loading ? file.name : ".TIFF, .JPG, or .ZIP archive"}
            </p>
          </div>
          <button
            type="button"
            className="upload-bar-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            Replace
          </button>
        </div>
      )}

      {error && <div className="scan-error">{error}</div>}

      {previewUrl && (result || error) && (
        <div className="scan-results">
          <div className="scan-image-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Uploaded flight data preview" />
          </div>

          {result && result.status === "success" && result.diagnosis && (
            <div className="result-panel">
              <div className="result-header">
                <p className="result-disease">{result.diagnosis.disease_name}</p>
              </div>
              <div className="result-body" onScroll={handleResultScroll}>
                <div className="result-section">
                  <p className="result-label">Cause</p>
                  <p className="result-text">{result.diagnosis.cause || "Not available."}</p>
                </div>
                <div className="result-section">
                  <p className="result-label">Symptoms</p>
                  <p className="result-text">{result.diagnosis.symptoms || "Not available."}</p>
                </div>
                <div className="result-section">
                  <p className="result-label">Treatment</p>
                  <p className="result-text">{result.diagnosis.treatment || "Not available."}</p>
                </div>
                <div className="result-section">
                  <p className="result-label">Prevention</p>
                  <p className="result-text">{result.diagnosis.prevention || "Not available."}</p>
                </div>
                <Recommendations recommendations={result.diagnosis.recommendations} />
              </div>
            </div>
          )}

          {result && (result.status === "rejected" || result.status === "uncertain") && (
            <div className="result-panel">
              <div className="result-body" onScroll={handleResultScroll}>
                <p className="result-text">{result.message}</p>
                {result.status === "uncertain" && result.observed && (
                  <p className="notice-secondary">{result.observed}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {result && result.scan_id && (
        <div className="scan-actions-wrap">
          <ScanActions scanId={result.scan_id} preselectedFarmId={farmIdParam} />
        </div>
      )}
    </main>
  );
}
