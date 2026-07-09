import { randomUUID } from "crypto";
import { batchJobTtlMs } from "../config";

export interface BatchJob<T> {
  id: string;
  total: number;
  processedCount: number;
  status: "processing" | "done";
  createdAt: number;
  result?: T;
}

// In-memory only: batch jobs live as long as this process does. Fine for a
// single-instance deployment; a restart mid-batch loses in-flight jobs, and
// the client's poll loop will surface that as a 404 rather than hang.
const jobs = new Map<string, BatchJob<any>>();

function sweepExpiredJobs(): void {
  const cutoff = Date.now() - batchJobTtlMs;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

export function createBatchJob<T>(total: number): BatchJob<T> {
  sweepExpiredJobs();
  const job: BatchJob<T> = {
    id: randomUUID(),
    total,
    processedCount: 0,
    status: "processing",
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getBatchJob(id: string): BatchJob<any> | undefined {
  return jobs.get(id);
}

export function incrementBatchJobProgress(id: string): void {
  const job = jobs.get(id);
  if (job) job.processedCount++;
}

export function markBatchJobDone<T>(id: string, result: T): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "done";
  job.result = result;
}
