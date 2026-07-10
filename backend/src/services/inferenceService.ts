import axios from "axios";
import FormData from "form-data";
import { inferenceServiceUrl } from "../config";

export interface DiagnosisResult {
  predicted_class: string;
  disease_name: string;
  cause?: string;
  symptoms?: string;
  treatment?: string;
  prevention?: string;
  confidence?: number;
}

// Render's free tier spins the inference container down after ~15 min idle;
// the first request after that hits it mid-boot and gets a non-JSON error
// page instead of a response. Measured cold starts run ~55s with variance,
// so the retry budget needs real headroom past that, not just past the average.
const COLD_START_RETRY_DELAYS_MS = [5000, 10000, 15000, 20000, 25000, 30000];

function isColdStartFailure(err: any): boolean {
  const status = err.response?.status;
  return !err.response || status === 502 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function diagnoseImage(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<DiagnosisResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const form = new FormData();
      form.append("file", fileBuffer, {
        filename: originalName,
        contentType: mimeType,
      });

      const response = await axios.post<DiagnosisResult>(
        `${inferenceServiceUrl}/predict`,
        form,
        {
          headers: form.getHeaders(),
        }
      );
      return response.data;
    } catch (err: any) {
      const delay = COLD_START_RETRY_DELAYS_MS[attempt];
      if (!delay || !isColdStartFailure(err)) {
        throw err;
      }
      await sleep(delay);
    }
  }
}
