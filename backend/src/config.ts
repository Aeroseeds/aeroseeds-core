import "dotenv/config";
import path from "path";

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
export const maxBatchImages = process.env.MAX_BATCH_IMAGES
  ? Number(process.env.MAX_BATCH_IMAGES)
  : 1000;
export const maxBatchFileSizeBytes = process.env.BATCH_MAX_FILE_SIZE_MB
  ? Number(process.env.BATCH_MAX_FILE_SIZE_MB) * 1024 * 1024
  : 20 * 1024 * 1024;
export const batchConcurrency = process.env.BATCH_CONCURRENCY
  ? Number(process.env.BATCH_CONCURRENCY)
  : 6;
export const batchJobTtlMs = process.env.BATCH_JOB_TTL_MINUTES
  ? Number(process.env.BATCH_JOB_TTL_MINUTES) * 60 * 1000
  : 30 * 60 * 1000;
export const databaseUrl = process.env.DATABASE_URL || "";
export const directDatabaseUrl = process.env.DIRECT_URL || "";
export const letterheadImagePath =
  process.env.LETTERHEAD_IMAGE_PATH ||
  path.join(__dirname, "..", "assets", "aeroseeds-logo.png");
export const reportCompanyName = process.env.REPORT_COMPANY_NAME || "Aeroseeds";
export const reportCompanyAddress = process.env.REPORT_COMPANY_ADDRESS || "Lagos, Nigeria";
export const reportCompanyPhone = process.env.REPORT_COMPANY_PHONE || "+234 816 978 1059";
export const reportCompanyEmail = process.env.REPORT_COMPANY_EMAIL || "plant@aeroseeds.io";
export const reportCompanyWebsite = process.env.REPORT_COMPANY_WEBSITE || "www.aeroseeds.io";
