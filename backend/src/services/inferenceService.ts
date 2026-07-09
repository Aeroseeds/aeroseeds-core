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

export async function diagnoseImage(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<DiagnosisResult> {
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
}
