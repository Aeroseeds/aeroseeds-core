import axios from "axios";
import { openRouterApiKey, openRouterAdvisorModels } from "../config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 25000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TreatmentSource {
  title: string;
  url: string;
}

export interface TreatmentAdvice {
  recommendations: string[];
  sources: TreatmentSource[];
}

interface CacheEntry {
  advice: TreatmentAdvice;
  expiresAt: number;
}

// Per-disease cache. There are only five fixed classes, so at most a handful
// of entries ever live here. `pending` holds in-flight fetches so a burst of
// batch images sharing a disease triggers exactly one web-grounded call
// rather than one per image.
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<TreatmentAdvice>>();

function buildPrompt(diseaseName: string, symptomsVisible: string): string {
  return (
    "You are an agricultural extension advisor for smallholder maize farmers " +
    `in Nigeria. A maize crop has been diagnosed with: ${diseaseName}. ` +
    `Typical symptoms: ${symptomsVisible || "typical symptoms for this disease"}. ` +
    "Using current, reputable sources, recommend what a Nigerian farmer should " +
    "use to treat or manage this disease. Prefer options that are effective, " +
    "affordable, and actually available to smallholder farms in Nigeria. Do " +
    "not recommend any chemical that is banned or restricted in Nigeria.\n\n" +
    "Respond with 2 to 4 lines, one recommendation per line, each formatted " +
    "exactly as:\n" +
    "- <active ingredient> (<example product name(s) sold in Nigeria>): " +
    "<brief application note, e.g. timing or method>\n\n" +
    "Where a cultural or biological control is the best first step, include it " +
    "as one of the lines. Output only the list -- no heading, no preamble, and " +
    "no disclaimer."
  );
}

function parseRecommendations(text: string | undefined): string[] {
  return (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function parseSources(annotations: any): TreatmentSource[] {
  if (!Array.isArray(annotations)) return [];
  const seen = new Set<string>();
  const sources: TreatmentSource[] = [];
  for (const a of annotations) {
    const c = a?.url_citation;
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    sources.push({ title: c.title || c.url, url: c.url });
  }
  return sources;
}

async function callModel(model: string, prompt: string): Promise<TreatmentAdvice> {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      plugins: [{ id: "web", engine: "exa", max_results: 5 }],
    },
    {
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  const message = response.data?.choices?.[0]?.message;
  const recommendations = parseRecommendations(message?.content);
  if (recommendations.length === 0) {
    throw new Error("Model returned no usable recommendations.");
  }
  return { recommendations, sources: parseSources(message?.annotations) };
}

async function fetchAdvice(
  diseaseName: string,
  symptomsVisible: string
): Promise<TreatmentAdvice> {
  if (!openRouterApiKey) {
    throw new Error("OpenRouter is not configured (OPENROUTER_API_KEY missing).");
  }
  if (!openRouterAdvisorModels.length) {
    throw new Error("No OpenRouter advisor models configured (OPENROUTER_ADVISOR_MODELS).");
  }

  const prompt = buildPrompt(diseaseName, symptomsVisible);
  const failures: string[] = [];

  for (const model of openRouterAdvisorModels) {
    try {
      const advice = await callModel(model, prompt);
      console.info(`Treatment advisor: "${model}" answered (${advice.recommendations.length} recommendations).`);
      return advice;
    } catch (err: any) {
      const status = err.response?.status;
      const reason = status ? `HTTP ${status}` : err.code || err.message;
      console.warn(`Treatment advisor: model "${model}" failed (${reason}), trying next.`);
      failures.push(`${model}: ${reason}`);
    }
  }

  throw new Error(`All treatment advisor models failed: ${failures.join("; ")}`);
}

/**
 * Returns current, Nigeria-specific product recommendations for a diagnosed
 * disease, grounded in a web search via OpenRouter. Results are cached per
 * disease for 7 days; concurrent requests for the same disease share one
 * in-flight fetch. Throws only if the (uncached) fetch fails across every
 * configured model -- callers should treat that as "no recommendations" and
 * still return the core diagnosis.
 */
export async function getTreatmentAdvice(
  diseaseKey: string,
  diseaseName: string,
  symptomsVisible: string
): Promise<TreatmentAdvice> {
  const cached = cache.get(diseaseKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.advice;
  }

  const inflight = pending.get(diseaseKey);
  if (inflight) return inflight;

  const p = fetchAdvice(diseaseName, symptomsVisible)
    .then((advice) => {
      cache.set(diseaseKey, { advice, expiresAt: Date.now() + CACHE_TTL_MS });
      return advice;
    })
    .finally(() => {
      pending.delete(diseaseKey);
    });

  pending.set(diseaseKey, p);
  return p;
}
