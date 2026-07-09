import express, { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { diagnose } from "../controllers/diagnoseController";
import { diagnoseBatch } from "../controllers/diagnoseBatchController";
import { maxBatchImages } from "../config";

const upload = multer({ storage: multer.memoryStorage() });
const batchUpload = multer({ storage: multer.memoryStorage() }).array(
  "images",
  maxBatchImages
);

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
        const message = err instanceof Error ? err.message : "Upload failed.";
        return res.status(400).json({ error: message });
      }
      next();
    });
  },
  diagnoseBatch
);

export default router;
