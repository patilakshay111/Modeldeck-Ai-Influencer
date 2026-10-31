/**
 * Provider contract.
 *
 * Every provider exposes the same three operations so the studio does not
 * care which upstream serves a model:
 *
 *   submit  → start a job, return the provider's job id
 *   status  → report where the job is
 *   result  → collect the finished assets
 *
 * A provider never receives caller credentials for another provider, and a
 * provider key is never included in a response.
 */

import type { CanonicalInput, ModelDefinition } from "../models/registry.js";

export type JobState = "queued" | "running" | "completed" | "failed";

export interface GeneratedAsset {
  /** Absolute URL the provider serves the asset from. */
  url: string;
  /** MIME type when the provider reports one. */
  contentType: string | null;
  width: number | null;
  height: number | null;
  /** True when the asset is a video rather than a still image. */
  isVideo: boolean;
}

export interface SubmitResult {
  providerJobId: string;
}

export interface StatusResult {
  state: JobState;
  /** 0..1 when the provider reports progress. */
  progress: number | null;
  /** Human-readable failure reason when `state` is "failed". */
  error: string | null;
  /** Provider queue position when the provider reports one. */
  queuePosition: number | null;
}

export interface ResultBundle {
  assets: GeneratedAsset[];
  /** Provider payload kept for the caller's own inspection. */
  raw: unknown;
}

export interface GenerationProvider {
  readonly id: "fal" | "openai" | "waveSpeed";
  /** True when this host holds a key for the provider. */
  readonly configured: boolean;
  submit(
    model: ModelDefinition,
    input: CanonicalInput,
    signal?: AbortSignal,
  ): Promise<SubmitResult>;
  status(
    model: ModelDefinition,
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<StatusResult>;
  result(
    model: ModelDefinition,
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<ResultBundle>;
}

/** Raised when a provider call fails in a way the caller can act on. */
export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly providerStatus: number | null;

  constructor(
    message: string,
    options: { retryable?: boolean; providerStatus?: number | null } = {},
  ) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options.retryable ?? false;
    this.providerStatus = options.providerStatus ?? null;
  }
}
