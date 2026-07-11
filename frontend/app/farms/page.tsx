"use client";

import Link from "next/link";
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

export default function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sizeHa, setSizeHa] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadFarms() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/farms`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load farms.");
      }
      setFarms(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFarms();
  }, []);

  function resetForm() {
    setName("");
    setLocation("");
    setSizeHa("");
    setNotes("");
    setFormError(null);
  }

  async function handleCreateFarm(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/farms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || undefined,
          sizeHa: sizeHa ? Number(sizeHa) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create farm.");
      }

      resetForm();
      setShowForm(false);
      void loadFarms();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="scan-page">
      <div className="scan-header">
        <h1 className="scan-title">Farms</h1>
        <p className="scan-subtitle">Manage farm profiles and scan history.</p>
      </div>

      <div className="farms-page-body">
        <div className="farms-toolbar">
          <p className="batch-selection-count">
            {farms.length} farm{farms.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            className="upload-bar-button"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "New farm"}
          </button>
        </div>

        {showForm && (
          <form className="farm-form" onSubmit={handleCreateFarm}>
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
                placeholder="Farm name"
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

            {formError && <div className="scan-error">{formError}</div>}

            <div className="scan-actions">
              <button type="submit" className="batch-run-button" disabled={submitting}>
                {submitting ? "Creating…" : "Create farm"}
              </button>
            </div>
          </form>
        )}

        {loading && <p className="result-text">Loading farms…</p>}
        {error && <div className="scan-error">{error}</div>}

        {!loading && !error && farms.length === 0 && !showForm && (
          <p className="result-text">No farms yet. Create one to get started.</p>
        )}

        {!loading && !error && farms.length > 0 && (
          <div className="farm-grid">
            {farms.map((farm) => (
              <Link key={farm.id} href={`/farms/${farm.id}`} className="farm-card">
                <p className="farm-card-name">{farm.name}</p>
                <p className="farm-card-location">{farm.location || "No location set"}</p>
                <div className="farm-card-stats">
                  <div className="farm-card-stat">
                    <p className="batch-stat-value farm-card-stat-value">{farm.scanCount}</p>
                    <p className="batch-stat-label">Scans</p>
                  </div>
                  <div className="farm-card-stat">
                    <p className="farm-card-stat-value">
                      {farm.lastScanAt
                        ? new Date(farm.lastScanAt).toLocaleDateString()
                        : "—"}
                    </p>
                    <p className="batch-stat-label">Last scan</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
