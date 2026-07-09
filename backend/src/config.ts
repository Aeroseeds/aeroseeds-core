import "dotenv/config";

const DEFAULT_VISION_MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4.6",
  "qwen/qwen2.5-vl-72b-instruct",
  "mistralai/mistral-large-2512",
  "meta-llama/llama-4-maverick",
  "x-ai/grok-4.3",
];

const DEFAULT_ADVISOR_MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4.6",
];

export const port = process.env.PORT ? Number(process.env.PORT) : 4000;
export const inferenceServiceUrl =
  process.env.INFERENCE_SERVICE_URL || "http://localhost:8000";
export const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
export const openRouterVisionModels: string[] = process.env.OPENROUTER_VISION_MODELS
  ? process.env.OPENROUTER_VISION_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
  : DEFAULT_VISION_MODELS;
export const openRouterAdvisorModels: string[] = process.env.OPENROUTER_ADVISOR_MODELS
  ? process.env.OPENROUTER_ADVISOR_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
  : DEFAULT_ADVISOR_MODELS;
export const confidenceThreshold = process.env.CONFIDENCE_THRESHOLD
  ? Number(process.env.CONFIDENCE_THRESHOLD)
  : 0.65;
export const maxBatchImages = 200;
export const batchConcurrency = process.env.BATCH_CONCURRENCY
  ? Number(process.env.BATCH_CONCURRENCY)
  : 6;
