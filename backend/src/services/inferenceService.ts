import axios from "axios";
import FormData from "form-data";
import { inferenceServiceUrl, inferenceTimeoutMs } from "../config";

export interface DiagnosisResult {
  predicted_class: string;
  disease_name: string;
  cause?: string;
  symptoms?: string;
  treatment?: string;
  prevention?: string;
  confidence?: number;
}

// If the inference container is restarting (deploy, crash recovery), requests
// hit it mid-boot while the model is still loading. Retry with backoff instead
// of failing the user's scan.
const RETRY_DELAYS_MS = [5000, 15000, 30000];

function isServiceUnavailable(err: any): boolean {
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
          timeout: inferenceTimeoutMs,
        }
      );
      return response.data;
    } catch (err: any) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (!delay || !isServiceUnavailable(err)) {
        throw err;
      }
      await sleep(delay);
    }
  }
}
