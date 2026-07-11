import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { runDiagnosisPipeline } from "../services/diagnosisPipeline";
import {
  createScanRecord,
  appendScanResult,
  completeScanRecord,
} from "../services/scanPersistenceService";

export async function diagnose(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded." });
  }

  const { buffer, originalname, mimetype } = req.file;

  let scanId: string | null = null;
  try {
    const scan = await createScanRecord({ mode: "single", totalImages: 1 });
    scanId = scan.id;
  } catch (err: any) {
    console.error("Failed to create scan record:", err.message);
  }

  const result = await runDiagnosisPipeline(buffer, originalname, mimetype);

  if (scanId) {
    try {
      switch (result.kind) {
        case "rejected":
          await appendScanResult(scanId, {
            filename: originalname,
            status: "rejected",
            message: result.message,
          });
          await completeScanRecord(scanId, {
            diagnosedCount: 0,
            rejectedCount: 1,
            uncertainCount: 0,
          });
          break;
        case "uncertain":
          await appendScanResult(scanId, {
            filename: originalname,
            status: "uncertain",
            message: result.message,
            observed: result.observed,
          });
          await completeScanRecord(scanId, {
            diagnosedCount: 0,
            rejectedCount: 0,
            uncertainCount: 1,
          });
          break;
        case "success":
          await appendScanResult(scanId, {
            filename: originalname,
            status: "success",
            diseaseName: result.diagnosis.disease_name,
            predictedClass: result.predictedClass,
            cause: result.diagnosis.cause,
            symptoms: result.diagnosis.symptoms,
            treatment: result.diagnosis.treatment,
            prevention: result.diagnosis.prevention,
            recommendations:
              (result.diagnosis.recommendations as unknown as Prisma.InputJsonValue) ?? null,
          });
          await completeScanRecord(scanId, {
            diagnosedCount: 1,
            rejectedCount: 0,
            uncertainCount: 0,
            dominantFinding: result.diagnosis.disease_name,
          });
          break;
        case "inference_error":
          // No usable result to persist; leave the scan in "processing" state.
          break;
      }
    } catch (err: any) {
      console.error(`Failed to persist scan result for scan ${scanId}:`, err.message);
    }
  }

  switch (result.kind) {
    case "rejected":
      return res.json({ status: "rejected", message: result.message, scan_id: scanId });
    case "uncertain":
      return res.json({
        status: "uncertain",
        message: result.message,
        observed: result.observed,
        scan_id: scanId,
      });
    case "success":
      return res.json({ status: "success", diagnosis: result.diagnosis, scan_id: scanId });
    case "inference_error":
      return res.status(result.status).json({ error: result.message });
  }
}
