import { Request, Response } from "express";
import {
  runDiagnosisPipeline,
  PipelineResult,
  Diagnosis,
} from "../services/diagnosisPipeline";
import { runWithConcurrency } from "../utils/concurrency";
import { batchConcurrency } from "../config";

type BatchStatus = "success" | "uncertain" | "rejected";

interface BatchResultItem {
  filename: string;
  status: BatchStatus;
  diagnosis: Diagnosis | null;
  message: string | null;
  observed?: string;
}

const DISEASE_KEYS = [
  "Healthy",
  "MSV",
  "MLB",
  "CommonRust",
  "GrayLeafSpot",
] as const;
type DiseaseKey = (typeof DISEASE_KEYS)[number];

interface ProcessedFile {
  item: BatchResultItem;
  predictedClass?: string;
}

function toProcessedFile(filename: string, result: PipelineResult): ProcessedFile {
  switch (result.kind) {
    case "rejected":
      return {
        item: { filename, status: "rejected", diagnosis: null, message: result.message },
      };
    case "inference_error":
      return {
        item: {
          filename,
          status: "rejected",
          diagnosis: null,
          message: "Could not process this image. Please try again.",
        },
      };
    case "uncertain":
      return {
        item: {
          filename,
          status: "uncertain",
          diagnosis: null,
          message: result.message,
          observed: result.observed,
        },
      };
    case "success":
      return {
        item: { filename, status: "success", diagnosis: result.diagnosis, message: null },
        predictedClass: result.predictedClass,
      };
  }
}

export async function diagnoseBatch(req: Request, res: Response) {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No image files uploaded." });
  }

  const processed = await runWithConcurrency(files, batchConcurrency, async (file) => {
    const result = await runDiagnosisPipeline(file.buffer, file.originalname, file.mimetype);
    return toProcessedFile(file.originalname, result);
  });

  const byDisease: Record<DiseaseKey, number> = {
    Healthy: 0,
    MSV: 0,
    MLB: 0,
    CommonRust: 0,
    GrayLeafSpot: 0,
  };

  let successCount = 0;
  let uncertainCount = 0;
  let rejectedCount = 0;

  for (const p of processed) {
    if (p.item.status === "success") {
      successCount++;
      if (p.predictedClass && p.predictedClass in byDisease) {
        byDisease[p.predictedClass as DiseaseKey]++;
      }
    } else if (p.item.status === "uncertain") {
      uncertainCount++;
    } else {
      rejectedCount++;
    }
  }

  let dominantFinding = "Inconclusive";
  if (successCount > 0 && successCount >= uncertainCount) {
    let topKey: DiseaseKey | null = null;
    let topCount = 0;
    for (const key of DISEASE_KEYS) {
      if (byDisease[key] > topCount) {
        topCount = byDisease[key];
        topKey = key;
      }
    }
    if (topKey) dominantFinding = topKey;
  }

  return res.json({
    summary: {
      total_images: files.length,
      rejected_images: rejectedCount,
      diagnosed_images: successCount + uncertainCount,
      by_status: { success: successCount, uncertain: uncertainCount },
      by_disease: byDisease,
      dominant_finding: dominantFinding,
    },
    results: processed.map((p) => p.item),
  });
}
