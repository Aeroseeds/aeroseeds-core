import axios from "axios";
import { openRouterApiKey, openRouterVisionModels } from "../config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 10000;

export type ImageQualityVerdict = "USABLE" | "REJECT";

const GATE_PROMPT =
  "Respond with one word: USABLE if this image shows a maize/corn plant or " +
  "leaf in enough detail to attempt a diagnosis (even if not perfect), or " +
  "REJECT only if it is clearly not maize, or so blurry/dark that nothing " +
  "can be assessed. When unsure, answer USABLE.";

function parseVerdict(text: string | undefined): ImageQualityVerdict {
  const normalized = (text || "").trim().toUpperCase();
  if (normalized.includes("REJECT")) return "REJECT";
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
 * image before it is sent to the inference service. Returns "USABLE" or
 * "REJECT". Moves to the next model on error, timeout, or rate limit;
 * throws only if every model in the chain fails.
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
