import { Request, Response } from "express";
import { prisma } from "../db/prismaClient";
import { computeDiseaseBreakdown } from "../services/scanPersistenceService";

export async function getDashboardSummary(req: Request, res: Response) {
  const [totalScans, totalFarms, imageAgg, recentScans, allScans] = await Promise.all([
    prisma.scan.count(),
    prisma.farm.count(),
    prisma.scan.aggregate({ _sum: { totalImages: true } }),
    prisma.scan.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { farm: { select: { name: true } } },
    }),
    prisma.scan.findMany({ select: { byDisease: true } }),
  ]);

  const diseaseBreakdown = computeDiseaseBreakdown(allScans);

  return res.json({
    total_scans: totalScans,
    total_farms: totalFarms,
    total_images_processed: imageAgg._sum.totalImages ?? 0,
    recent_scans: recentScans.map((scan) => ({
      id: scan.id,
      farm_id: scan.farmId,
      farm_name: scan.farm?.name ?? "Unassigned",
      created_at: scan.createdAt,
      mode: scan.mode,
      dominant_finding: scan.dominantFinding,
    })),
    disease_breakdown: diseaseBreakdown,
  });
}
