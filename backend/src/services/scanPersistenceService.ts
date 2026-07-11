import { Prisma, ScanMode, ScanResultStatus } from "@prisma/client";
import { prisma } from "../db/prismaClient";

export interface CreateScanRecordInput {
  mode: ScanMode;
  totalImages: number;
}

export interface AppendScanResultInput {
  filename: string;
  status: ScanResultStatus;
  diseaseName?: string | null;
  predictedClass?: string | null;
  cause?: string | null;
  symptoms?: string | null;
  treatment?: string | null;
  prevention?: string | null;
  recommendations?: Prisma.InputJsonValue | null;
  message?: string | null;
  observed?: string | null;
}

export interface CompleteScanRecordInput {
  diagnosedCount: number;
  rejectedCount: number;
  uncertainCount: number;
  byDisease?: Prisma.InputJsonValue | null;
  dominantFinding?: string | null;
}

export function createScanRecord(input: CreateScanRecordInput) {
  return prisma.scan.create({
    data: {
      mode: input.mode,
      totalImages: input.totalImages,
    },
  });
}

export function appendScanResult(scanId: string, row: AppendScanResultInput) {
  return prisma.scanResult.create({
    data: {
      scanId,
      filename: row.filename,
      status: row.status,
      diseaseName: row.diseaseName ?? null,
      predictedClass: row.predictedClass ?? null,
      cause: row.cause ?? null,
      symptoms: row.symptoms ?? null,
      treatment: row.treatment ?? null,
      prevention: row.prevention ?? null,
      recommendations: row.recommendations ?? Prisma.JsonNull,
      message: row.message ?? null,
      observed: row.observed ?? null,
    },
  });
}

export function completeScanRecord(scanId: string, input: CompleteScanRecordInput) {
  return prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "done",
      diagnosedCount: input.diagnosedCount,
      rejectedCount: input.rejectedCount,
      uncertainCount: input.uncertainCount,
      byDisease: input.byDisease ?? Prisma.JsonNull,
      dominantFinding: input.dominantFinding ?? null,
      completedAt: new Date(),
    },
  });
}

export function assignScanToFarm(scanId: string, farmId: string | null) {
  return prisma.scan.update({
    where: { id: scanId },
    data: { farmId },
  });
}

export function getUnassignedScans(limit: number, offset: number) {
  return prisma.scan.findMany({
    where: { farmId: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export function getScansByFarm(farmId: string) {
  return prisma.scan.findMany({
    where: { farmId },
    orderBy: { createdAt: "desc" },
  });
}

export function getScanById(scanId: string) {
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: { results: true },
  });
}

export function computeDiseaseBreakdown(
  scans: { byDisease: Prisma.JsonValue | null }[]
): { name: string; count: number }[] {
  const diseaseCounts: Record<string, number> = {};
  for (const scan of scans) {
    const byDisease = scan.byDisease as Record<string, number> | null;
    if (!byDisease) continue;
    for (const [name, count] of Object.entries(byDisease)) {
      diseaseCounts[name] = (diseaseCounts[name] ?? 0) + (Number(count) || 0);
    }
  }
  return Object.entries(diseaseCounts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
