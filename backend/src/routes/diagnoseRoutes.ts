import express, { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { diagnose } from "../controllers/diagnoseController";
import {
  startDiagnoseBatch,
  getDiagnoseBatchStatus,
} from "../controllers/diagnoseBatchController";
import { maxBatchImages, maxBatchFileSizeBytes } from "../config";

const upload = multer({ storage: multer.memoryStorage() });
const batchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBatchFileSizeBytes },
}).array("images", maxBatchImages);

const router = express.Router();

router.post("/diagnose", upload.single("image"), diagnose);

router.post(
  "/diagnose-batch",
  (req: Request, res: Response, next: NextFunction) => {
    batchUpload(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            error: `Too many images in one request. Please split into batches of ${maxBatchImages} images or fewer.`,
          });
        }
        if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: `One or more images exceed the ${Math.round(
              maxBatchFileSizeBytes / (1024 * 1024)
            )}MB per-image limit.`,
          });
        }
        const message = err instanceof Error ? err.message : "Upload failed.";
        return res.status(400).json({ error: message });
      }
      next();
    });
  },
  startDiagnoseBatch
);

router.get("/diagnose-batch/:jobId", getDiagnoseBatchStatus);

export default router;
