import { diagnoseImage } from "./inferenceService";
import { checkImageQuality } from "./visionGateService";
import { crossExamineDiagnosis } from "./crossExamService";
import { getTreatmentAdvice, Recommendation } from "./treatmentAdvisorService";
import { confidenceThreshold } from "../config";

export interface Diagnosis {
  disease_name: string;
  cause?: string;
  symptoms?: string;
  treatment?: string;
  prevention?: string;
  recommendations?: Recommendation[];
}

const UNCERTAIN_MESSAGE =
  "We couldn't confidently diagnose this one. Please consult a local agricultural extension officer.";
const NOT_MAIZE_MESSAGE =
  "This doesn't look like a maize plant. Please upload a photo of a maize/corn plant or leaf.";
const UNCLEAR_MESSAGE =
  "Please upload a clearer close-up image of a maize plant.";

export type PipelineResult =
  | { kind: "rejected"; message: string }
  | { kind: "uncertain"; message: string; observed?: string }
  | { kind: "success"; diagnosis: Diagnosis; predictedClass: string }
  | { kind: "inference_error"; status: number; message: string };

export async function runDiagnosisPipeline(
  buffer: Buffer,
  originalname: string,
  mimetype: string
): Promise<PipelineResult> {
  let quality = "USABLE";
  try {
    quality = await checkImageQuality(buffer, mimetype);
  } catch (err: any) {
    console.error(
      "Vision gate check failed, falling back to direct inference:",
      err.message
    );
    quality = "USABLE";
  }

  if (quality === "NOT_MAIZE") {
    return { kind: "rejected", message: NOT_MAIZE_MESSAGE };
  }
  if (quality === "UNCLEAR") {
    return { kind: "rejected", message: UNCLEAR_MESSAGE };
  }

  try {
    const result = await diagnoseImage(buffer, originalname, mimetype);
    const belowThreshold =
      typeof result.confidence === "number" &&
      result.confidence < confidenceThreshold;

    if (belowThreshold) {
      return { kind: "uncertain", message: UNCERTAIN_MESSAGE };
    }

    let crossExam;
    try {
      crossExam = await crossExamineDiagnosis(
        buffer,
        mimetype,
        result.disease_name,
        result.symptoms || ""
      );
    } catch (err: any) {
      console.error(
        "Cross-exam step failed, falling back to CNN-only result:",
        err.message
      );
      crossExam = null;
    }

    const isSuccess =
      crossExam === null ? true : crossExam.verdict === "CONFIRM";

    if (isSuccess) {
      const diagnosis: Diagnosis = {
        disease_name: result.disease_name,
        cause: result.cause,
        symptoms: result.symptoms,
        treatment: result.treatment,
        prevention: result.prevention,
      };

      // A healthy plant needs no treatment products, so skip the web lookup.
      if (result.predicted_class !== "Healthy") {
        try {
          const advice = await getTreatmentAdvice(
            result.predicted_class,
            result.disease_name,
            result.symptoms || ""
          );
          diagnosis.recommendations = advice.recommendations;
        } catch (err: any) {
          console.error(
            "Treatment advisor failed, returning diagnosis without recommendations:",
            err.message
          );
        }
      }

      return {
        kind: "success",
        diagnosis,
        predictedClass: result.predicted_class,
      };
    }

    return {
      kind: "uncertain",
      message: UNCERTAIN_MESSAGE,
      observed: crossExam?.observed,
    };
  } catch (err: any) {
    const status = err.response?.status || 502;
    const message =
      err.response?.data?.detail || "Failed to reach inference service.";
    return { kind: "inference_error", status, message };
  }
}
