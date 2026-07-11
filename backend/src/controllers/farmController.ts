import { Request, Response } from "express";
import { prisma } from "../db/prismaClient";
import { getScansByFarm, computeDiseaseBreakdown } from "../services/scanPersistenceService";

export async function listFarms(req: Request, res: Response) {
  const farms = await prisma.farm.findMany({ orderBy: { createdAt: "desc" } });

  const stats = await prisma.scan.groupBy({
    by: ["farmId"],
    where: { farmId: { in: farms.map((farm) => farm.id) } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const statsByFarmId = new Map(
    stats.map((s) => [s.farmId, { scanCount: s._count._all, lastScanAt: s._max.createdAt }])
  );

  const withScanStats = farms.map((farm) => ({
    ...farm,
    scanCount: statsByFarmId.get(farm.id)?.scanCount ?? 0,
    lastScanAt: statsByFarmId.get(farm.id)?.lastScanAt ?? null,
  }));
  return res.json(withScanStats);
}

export async function createFarm(req: Request, res: Response) {
  const { name, location, sizeHa, notes } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "name is required." });
  }

  const farm = await prisma.farm.create({
    data: {
      name,
      location: location ?? null,
      sizeHa: sizeHa === undefined || sizeHa === null ? null : Number(sizeHa),
      notes: notes ?? null,
    },
  });

  return res.status(201).json(farm);
}

export async function getFarm(req: Request, res: Response) {
  const farm = await prisma.farm.findUnique({ where: { id: req.params.id } });

  if (!farm) {
    return res.status(404).json({ error: "Farm not found." });
  }

  const stats = await prisma.scan.aggregate({
    where: { farmId: farm.id },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  return res.json({
    ...farm,
    scanCount: stats._count._all,
    lastScanAt: stats._max.createdAt,
  });
}

export async function getFarmScans(req: Request, res: Response) {
  const farm = await prisma.farm.findUnique({ where: { id: req.params.id } });
  if (!farm) {
    return res.status(404).json({ error: "Farm not found." });
  }

  const scans = await getScansByFarm(farm.id);
  const diseaseBreakdown = computeDiseaseBreakdown(scans);

  return res.json({
    scans: scans.map((scan) => ({
      id: scan.id,
      mode: scan.mode,
      status: scan.status,
      totalImages: scan.totalImages,
      diagnosedCount: scan.diagnosedCount,
      rejectedCount: scan.rejectedCount,
      uncertainCount: scan.uncertainCount,
      dominantFinding: scan.dominantFinding,
      createdAt: scan.createdAt,
    })),
    diseaseBreakdown,
  });
}

export async function updateFarm(req: Request, res: Response) {
  const { name, location, sizeHa, notes } = req.body;

  const existing = await prisma.farm.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "Farm not found." });
  }

  const farm = await prisma.farm.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(sizeHa !== undefined ? { sizeHa: sizeHa === null ? null : Number(sizeHa) } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });

  return res.json(farm);
}

export async function deleteFarm(req: Request, res: Response) {
  const existing = await prisma.farm.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "Farm not found." });
  }

  await prisma.farm.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}
