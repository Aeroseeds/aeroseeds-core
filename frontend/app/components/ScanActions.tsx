"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface Farm {
  id: string;
  name: string;
}

interface ScanActionsProps {
  scanId: string;
  preselectedFarmId?: string | null;
}

const NEW_FARM_VALUE = "__new__";

export default function ScanActions({ scanId, preselectedFarmId }: ScanActionsProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(preselectedFarmId || "");
  const [showNewFarmInput, setShowNewFarmInput] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const autoAssignedRef = useRef(false);

  useEffect(() => {
    async function loadFarms() {
      setLoadingFarms(true);
      try {
        const res = await fetch(`${BACKEND_URL}/farms`);
        const data = await res.json();
        if (res.ok) setFarms(data);
      } catch {
        // Farm list is a convenience here; leave the dropdown empty on failure.
      } finally {
        setLoadingFarms(false);
      }
    }
    void loadFarms();
  }, []);

  useEffect(() => {
    if (preselectedFarmId && !autoAssignedRef.current) {
      autoAssignedRef.current = true;
      setSelectedFarmId(preselectedFarmId);
      void assignFarm(preselectedFarmId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedFarmId, scanId]);

  async function assignFarm(farmId: string | null) {
    setAssigning(true);
    setAssignError(null);
    setConfirmation(null);
    try {
      const res = await fetch(`${BACKEND_URL}/scans/${scanId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farm_id: farmId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to assign scan.");
      }
      const farmName = farms.find((f) => f.id === farmId)?.name;
      setConfirmation(farmId ? `Assigned to ${farmName || "farm"}.` : "Unassigned.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setAssignError(message);
    } finally {
      setAssigning(false);
    }
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === NEW_FARM_VALUE) {
      setShowNewFarmInput(true);
      return;
    }
    setShowNewFarmInput(false);
    setSelectedFarmId(value);
    void assignFarm(value || null);
  }

  async function handleCreateAndAssignFarm(e: React.FormEvent) {
    e.preventDefault();
    if (!newFarmName.trim()) return;

    setAssigning(true);
    setAssignError(null);
    setConfirmation(null);

    try {
      const res = await fetch(`${BACKEND_URL}/farms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFarmName.trim() }),
      });
      const farm = await res.json();
      if (!res.ok) {
        throw new Error(farm.error || "Failed to create farm.");
      }

      setFarms((prev) => [...prev, { id: farm.id, name: farm.name }]);
      setSelectedFarmId(farm.id);
      setShowNewFarmInput(false);
      setNewFarmName("");
      await assignFarm(farm.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setAssignError(message);
      setAssigning(false);
    }
  }

  async function handleDownloadReport() {
    setDownloadingReport(true);
    setReportError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/reports/scan/${scanId}`);
      if (!res.ok) {
        throw new Error("Report generation isn't available yet.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scan-${scanId}-report.pdf`;
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

  return (
    <div className="scan-actions-panel">
      <div className="scan-actions-row">
        <div className="scan-actions-field">
          <label className="result-label" htmlFor="assign-farm-select">
            Assign to a farm
          </label>
          <select
            id="assign-farm-select"
            className="farm-input farm-select"
            value={showNewFarmInput ? NEW_FARM_VALUE : selectedFarmId}
            onChange={handleSelectChange}
            disabled={loadingFarms || assigning}
          >
            <option value="">Unassigned</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
            <option value={NEW_FARM_VALUE}>+ New farm</option>
          </select>
        </div>

        <button
          type="button"
          className="upload-bar-button"
          onClick={handleDownloadReport}
          disabled={downloadingReport}
        >
          {downloadingReport ? "Preparing…" : "Download report (PDF)"}
        </button>
      </div>

      {showNewFarmInput && (
        <form className="scan-actions-new-farm" onSubmit={handleCreateAndAssignFarm}>
          <input
            type="text"
            className="farm-input"
            placeholder="New farm name"
            value={newFarmName}
            onChange={(e) => setNewFarmName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="upload-bar-button" disabled={assigning}>
            Create &amp; assign
          </button>
        </form>
      )}

      {confirmation && <p className="notice-secondary scan-actions-confirmation">{confirmation}</p>}
      {assignError && <p className="notice-secondary scan-actions-error">{assignError}</p>}
      {reportError && <p className="notice-secondary scan-actions-error">{reportError}</p>}
    </div>
  );
}
