import express from "express";
import { listUnassignedScans, getScan, assignScan } from "../controllers/scanController";

const router = express.Router();

router.get("/scans/unassigned", listUnassignedScans);
router.get("/scans/:id", getScan);
router.patch("/scans/:id/assign", assignScan);

export default router;
