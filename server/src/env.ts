import "dotenv/config";
import { z } from "zod";
import { ragConfigSchema } from "./services/rag/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5201),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET is required"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5200"),
  CLIENT_URL: z.string().url().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Used only by the optional assistant/cache. Basic local setup has no Redis.
  REDIS_URL: z.string().default(""),
  // Optional: only required to actually upload images
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = envSchema.and(ragConfigSchema).safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production" && (!env.TURNSTILE_SECRET_KEY || /^[123]x0/.test(env.TURNSTILE_SECRET_KEY))) {
  throw new Error("A production TURNSTILE_SECRET_KEY is required; test keys are not allowed.");
}
