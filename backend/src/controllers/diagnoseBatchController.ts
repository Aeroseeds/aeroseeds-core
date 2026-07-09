import { Request, Response } from "express";
import {
  runDiagnosisPipeline,
  PipelineResult,
  Diagnosis,
} from "../services/diagnosisPipeline";
import { runWithConcurrency } from "../utils/concurrency";
import { batchConcurrency } from "../config";
import {
  createBatchJob,
  getBatchJob,
  incrementBatchJobProgress,
  markBatchJobDone,
} from "../services/batchJobStore";

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

interface BatchResponseBody {
  summary: {
    total_images: number;
    rejected_images: number;
    diagnosed_images: number;
    by_status: { success: number; uncertain: number };
    by_disease: Record<DiseaseKey, number>;
    dominant_finding: string;
  };
  results: BatchResultItem[];
}

/**
 * Kicks off batch processing and returns a job id immediately -- with
 * batches of up to a few hundred images, each needing one or more
 * OpenRouter calls, the full run can take minutes, well past what any
 * reverse proxy or browser will hold a single request open for. The client
 * polls GET /diagnose-batch/:jobId for progress and the final result.
 */
export async function startDiagnoseBatch(req: Request, res: Response) {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No image files uploaded." });
  }

  const job = createBatchJob<BatchResponseBody>(files.length);
  res.status(202).json({ job_id: job.id, total: files.length });

  processBatch(job.id, files).catch((err: any) => {
    console.error(`Batch job ${job.id} failed unexpectedly:`, err.message);
  });
}

async function processBatch(jobId: string, files: Express.Multer.File[]): Promise<void> {
  const processed = await runWithConcurrency(files, batchConcurrency, async (file) => {
    const result = await runDiagnosisPipeline(file.buffer, file.originalname, file.mimetype);
    incrementBatchJobProgress(jobId);
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

  markBatchJobDone<BatchResponseBody>(jobId, {
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

export function getDiagnoseBatchStatus(req: Request, res: Response) {
  const job = getBatchJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Batch job not found or expired." });
  }

  if (job.status === "processing") {
    return res.json({
      status: "processing",
      total: job.total,
      processed: job.processedCount,
    });
  }

  return res.json({
    status: "done",
    total: job.total,
    processed: job.processedCount,
    ...job.result,
  });
}
