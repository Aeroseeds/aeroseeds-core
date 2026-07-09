import { Request, Response } from "express";
import { runDiagnosisPipeline } from "../services/diagnosisPipeline";

export async function diagnose(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded." });
  }

  const { buffer, originalname, mimetype } = req.file;
  const result = await runDiagnosisPipeline(buffer, originalname, mimetype);

  switch (result.kind) {
    case "rejected":
      return res.json({ status: "rejected", message: result.message });
    case "uncertain":
      return res.json({
        status: "uncertain",
        message: result.message,
        observed: result.observed,
      });
    case "success":
      return res.json({ status: "success", diagnosis: result.diagnosis });
    case "inference_error":
      return res.status(result.status).json({ error: result.message });
  }
}
