import express from "express";
import {
  listFarms,
  createFarm,
  getFarm,
  getFarmScans,
  updateFarm,
  deleteFarm,
} from "../controllers/farmController";

const router = express.Router();

router.get("/farms", listFarms);
router.post("/farms", createFarm);
router.get("/farms/:id", getFarm);
router.get("/farms/:id/scans", getFarmScans);
router.patch("/farms/:id", updateFarm);
router.delete("/farms/:id", deleteFarm);

export default router;
