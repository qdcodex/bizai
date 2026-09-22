import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  GEMINI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validates and returns process.env, throwing a clear error the first time a required var is missing. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join(", ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
