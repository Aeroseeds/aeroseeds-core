import { Request, Response } from "express";
import { prisma } from "../db/prismaClient";
import { getUnassignedScans, getScanById } from "../services/scanPersistenceService";

export async function listUnassignedScans(req: Request, res: Response) {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const scans = await getUnassignedScans(limit, offset);
  return res.json({ scans, limit, offset });
}

export async function getScan(req: Request, res: Response) {
  const scan = await getScanById(req.params.id);

  if (!scan) {
    return res.status(404).json({ error: "Scan not found." });
  }

  return res.json(scan);
}

export async function assignScan(req: Request, res: Response) {
  const { farm_id: farmId } = req.body;

  if (farmId !== null && typeof farmId !== "string") {
    return res.status(400).json({ error: "farm_id must be a string or null." });
  }

  const scan = await prisma.scan.findUnique({ where: { id: req.params.id } });
  if (!scan) {
    return res.status(404).json({ error: "Scan not found." });
  }

  if (farmId !== null) {
    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) {
      return res.status(404).json({ error: "Farm not found." });
    }
  }

  const updated = await prisma.scan.update({
    where: { id: req.params.id },
    data: { farmId },
  });

  return res.json(updated);
}
