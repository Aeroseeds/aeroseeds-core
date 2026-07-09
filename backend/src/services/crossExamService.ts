import axios from "axios";
import { openRouterApiKey, openRouterVisionModels } from "../config";
import { withRateLimitRetry } from "../utils/openRouterRetry";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 10000;

export type CrossExamVerdict = "CONFIRM" | "CONTRADICT" | "UNCLEAR";

export interface CrossExamResult {
  verdict: CrossExamVerdict;
  observed?: string;
}

function buildPrompt(diseaseName: string, symptomsVisible: string): string {
  return (
    `A specialist model believes this maize leaf shows: ${diseaseName}. ` +
    `That disease typically shows: ${symptomsVisible}. Look at the image ` +
    "yourself. Reply with exactly one word first -- CONFIRM if what you see " +
    "is consistent with that disease, CONTRADICT if you see something " +
    "clearly inconsistent, or UNCLEAR if you cannot tell. Then on a new " +
    "line, briefly state what you actually see."
  );
}

function parseResponse(text: string | undefined): CrossExamResult {
  const trimmed = (text || "").trim();
  const [firstLine, ...rest] = trimmed.split(/\r?\n/);
  const normalized = (firstLine || "").trim().toUpperCase();

  let verdict: CrossExamVerdict;
  if (normalized.includes("CONTRADICT")) verdict = "CONTRADICT";
  else if (normalized.includes("UNCLEAR")) verdict = "UNCLEAR";
  else if (normalized.includes("CONFIRM")) verdict = "CONFIRM";
  else throw new Error(`Unexpected cross-exam response: "${normalized}"`);

  const observed = rest.join("\n").trim() || undefined;
  return { verdict, observed };
}

async function callModel(
  model: string,
  dataUrl: string,
  prompt: string
): Promise<CrossExamResult> {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 200,
    },
    {
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  const text = response.data?.choices?.[0]?.message?.content;
  return parseResponse(text);
}

/**
 * Asks OpenRouter's vision models (same fallback chain as the quality gate)
 * to independently confirm or contradict the CNN's diagnosis. The LLM never
 * names a disease of its own -- it only judges the CNN's stated prediction
 * against what it sees in the image. Throws only if every model fails.
 */
export async function crossExamineDiagnosis(
  fileBuffer: Buffer,
  mimeType: string,
  diseaseName: string,
  symptomsVisible: string
): Promise<CrossExamResult> {
  if (!openRouterApiKey) {
    throw new Error("OpenRouter is not configured (OPENROUTER_API_KEY missing).");
  }
  if (!openRouterVisionModels.length) {
    throw new Error("No OpenRouter vision models configured (OPENROUTER_VISION_MODELS).");
  }

  const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const prompt = buildPrompt(diseaseName, symptomsVisible || "typical symptoms for this disease");
  const failures: string[] = [];

  for (const model of openRouterVisionModels) {
    try {
      const result = await withRateLimitRetry(() => callModel(model, dataUrl, prompt));
      console.info(`Cross-exam: "${model}" answered the request (verdict: ${result.verdict}).`);
      return result;
    } catch (err: any) {
      const status = err.response?.status;
      const reason = status ? `HTTP ${status}` : err.code || err.message;
      console.warn(`Cross-exam: model "${model}" failed (${reason}), trying next.`);
      failures.push(`${model}: ${reason}`);
    }
  }

  throw new Error(`All cross-exam models failed: ${failures.join("; ")}`);
}
