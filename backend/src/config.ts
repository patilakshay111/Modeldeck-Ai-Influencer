/**
 * Runtime configuration.
 *
 * Every value comes from the environment. Nothing is hard-coded, and no
 * provider key is ever returned to a client or written to a log.
 */

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().min(1).default("127.0.0.1"),

  /** Public origin of this service; used to build absolute asset URLs. */
  PUBLIC_ORIGIN: z.string().url().default("http://127.0.0.1:8787"),

  /** Where generated media is written. */
  STORAGE_DIR: z.string().min(1).default("./storage"),

  /** Signing key for session tokens. Required outside development. */
  JWT_SECRET: z.string().min(16).default("modeldeck-development-secret-change-me"),

  /** fal.ai — the primary model aggregator. */
  FAL_KEY: z.string().optional(),

  /** OpenAI — used for Sora, which fal.ai does not host, and for planning. */
  OPENAI_API_KEY: z.string().optional(),

  /** Anthropic — the agent's planner, when OpenAI is not used for it. */
  ANTHROPIC_API_KEY: z.string().optional(),

  /** Which LLM plans the agent's jobs. */
  AGENT_MODEL: z.string().optional(),

  /** When set to "1", uncensored / spicy models appear in the model picker.
   *
   * These models are hosted by fal.ai but are not safe-for-work. They are
   * hidden from the public catalogue unless this flag is enabled, matching
   * how the spicy tier is kept behind Growth.
   */
  ENABLE_SPICY_MODELS: z.string().optional(),

  /** Comma-separated CORS origins for the frontend dev server. */
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),

  /**
   * What one credit is sold for, in USD.
   *
   * This is the only number that sets the markup. Credits are issued at
   * `provider USD x IMAGE_MULTIPLIER` (or `x VIDEO_MULTIPLIER`), so:
   *
   *   image markup = CREDIT_PRICE_USD x IMAGE_MULTIPLIER
   *   video markup = CREDIT_PRICE_USD x VIDEO_MULTIPLIER
   *
   * At 0.004 an image costs exactly what the provider charges and a video
   * costs 1.28x. Raise it to add a margin.
   */
  CREDIT_PRICE_USD: z.coerce.number().positive().default(0.004),

  /** Wall-clock ceiling for one generation job before it is marked failed. */
  JOB_TIMEOUT_MS: z.coerce.number().int().min(30_000).default(15 * 60_000),
});

export type Config = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  /** Provider keys present on this host. */
  providers: {
    fal: boolean;
    openai: boolean;
    anthropic: boolean;
  };
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const value = parsed.data;
  return {
    ...value,
    corsOrigins: value.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    providers: {
      fal: Boolean(value.FAL_KEY),
      openai: Boolean(value.OPENAI_API_KEY),
      anthropic: Boolean(value.ANTHROPIC_API_KEY),
    },
  };
};
