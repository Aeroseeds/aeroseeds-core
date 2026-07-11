import express, { Request, Response } from "express";
import { renderScanReportPdf, renderFarmReportPdf } from "../services/pdfReportService";

const router = express.Router();

function sendPdfError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : "Failed to generate report.";
  const status = message.endsWith("not found.") ? 404 : 500;
  return res.status(status).json({ error: message });
}

router.get("/reports/scan/:scanId", async (req: Request, res: Response) => {
  try {
    const pdf = await renderScanReportPdf(req.params.scanId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="scan-${req.params.scanId}-report.pdf"`
    );
    return res.send(pdf);
  } catch (err) {
    return sendPdfError(res, err);
  }
});

router.get("/reports/farm/:farmId", async (req: Request, res: Response) => {
  try {
    const pdf = await renderFarmReportPdf(req.params.farmId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="farm-${req.params.farmId}-report.pdf"`
    );
    return res.send(pdf);
  } catch (err) {
    return sendPdfError(res, err);
  }
});

export default router;
