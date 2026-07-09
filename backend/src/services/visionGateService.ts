import axios from "axios";
import { openRouterApiKey, openRouterVisionModels } from "../config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 10000;

export type ImageQualityVerdict = "USABLE" | "NOT_MAIZE" | "UNCLEAR";

const GATE_PROMPT =
  "Respond with exactly one word: USABLE if this image shows a maize/corn " +
  "plant or leaf in enough detail to attempt a diagnosis (even if not " +
  "perfect); NOT_MAIZE if it clearly shows a different crop, plant, or " +
  "something unrelated to maize; UNCLEAR if it is too blurry, dark, or " +
  "zoomed out for anything to be assessed. When unsure whether it is maize, " +
  "answer USABLE.";

function parseVerdict(text: string | undefined): ImageQualityVerdict {
  const normalized = (text || "").trim().toUpperCase();
  if (normalized.includes("NOT_MAIZE") || normalized.includes("NOT MAIZE")) return "NOT_MAIZE";
  if (normalized.includes("UNCLEAR") || normalized.includes("REJECT")) return "UNCLEAR";
  if (normalized.includes("USABLE")) return "USABLE";
  throw new Error(`Unexpected vision gate response: "${normalized}"`);
}

async function callModel(model: string, dataUrl: string): Promise<ImageQualityVerdict> {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: GATE_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 10,
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
  return parseVerdict(text);
}

/**
 * Calls OpenRouter's vision models in fallback order to gate an uploaded
 * image before it is sent to the inference service. Returns "USABLE",
 * "NOT_MAIZE", or "UNCLEAR". Moves to the next model on error, timeout, or
 * rate limit; throws only if every model in the chain fails.
 */
export async function checkImageQuality(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ImageQualityVerdict> {
  if (!openRouterApiKey) {
    throw new Error("OpenRouter is not configured (OPENROUTER_API_KEY missing).");
  }
  if (!openRouterVisionModels.length) {
    throw new Error("No OpenRouter vision models configured (OPENROUTER_VISION_MODELS).");
  }

  const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const failures: string[] = [];

  for (const model of openRouterVisionModels) {
    try {
      const verdict = await callModel(model, dataUrl);
      console.info(`Vision gate: "${model}" answered the request (verdict: ${verdict}).`);
      return verdict;
    } catch (err: any) {
      const status = err.response?.status;
      const reason = status ? `HTTP ${status}` : err.code || err.message;
      console.warn(`Vision gate: model "${model}" failed (${reason}), trying next.`);
      failures.push(`${model}: ${reason}`);
    }
  }

  throw new Error(`All vision gate models failed: ${failures.join("; ")}`);
}
