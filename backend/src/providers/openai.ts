/**
 * OpenAI video adapter.
 *
 * fal.ai does not host Sora, so Sora models go to OpenAI directly. OpenAI's
 * video API is a job API of the same shape as fal's queue:
 *
 *   POST /v1/videos            → { id, status }
 *   GET  /v1/videos/{id}       → { id, status, progress }
 *   GET  /v1/videos/{id}/content → the rendered video bytes
 *
 * The content endpoint returns bytes rather than a URL, so the completed asset
 * is served from this service's own storage.
 */

import type { CanonicalInput, ModelDefinition } from "../models/registry.js";
import {
  ProviderError,
  type GeneratedAsset,
  type GenerationProvider,
  type ResultBundle,
  type StatusResult,
  type SubmitResult,
} from "./types.js";

const OPENAI_BASE = "https://api.openai.com/v1";

const OPENAI_STATUS_MAP: Record<string, StatusResult["state"]> = {
  queued: "queued",
  in_progress: "running",
  processing: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "failed",
};

type OpenAiVideo = {
  id?: string;
  status?: string;
  progress?: number;
  error?: { message?: string } | null;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    return (
      body.error?.message ??
      body.message ??
      `HTTP ${response.status} ${response.statusText}`
    );
  } catch {
    return `HTTP ${response.status} ${response.statusText}`;
  }
};

export class OpenAiProvider implements GenerationProvider {
  readonly id = "openai" as const;
  readonly configured: boolean;
  private readonly apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
    this.configured = Boolean(apiKey);
  }

  private headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new ProviderError(
        "OpenAI is not configured on this host. Set OPENAI_API_KEY.",
        { retryable: false },
      );
    }
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }

  async submit(
    model: ModelDefinition,
    input: CanonicalInput,
    signal?: AbortSignal,
  ): Promise<SubmitResult> {
    const body = model.buildInput(input);
    let response: Response;
    try {
      response = await fetch(`${OPENAI_BASE}/videos`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ model: model.upstreamId, ...body }),
        signal,
      });
    } catch (cause) {
      throw new ProviderError(
        cause instanceof Error ? cause.message : "OpenAI submit failed.",
        { retryable: true },
      );
    }
    if (!response.ok) {
      throw new ProviderError(await readErrorMessage(response), {
        retryable: response.status === 429 || response.status >= 500,
        providerStatus: response.status,
      });
    }
    const payload = (await response.json()) as OpenAiVideo;
    if (typeof payload.id !== "string") {
      throw new ProviderError("OpenAI returned no video id.", {
        retryable: true,
      });
    }
    return { providerJobId: payload.id };
  }

  async status(
    _model: ModelDefinition,
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<StatusResult> {
    let response: Response;
    try {
      response = await fetch(`${OPENAI_BASE}/videos/${providerJobId}`, {
        headers: this.headers(),
        signal,
      });
    } catch (cause) {
      throw new ProviderError(
        cause instanceof Error ? cause.message : "OpenAI status failed.",
        { retryable: true },
      );
    }
    if (!response.ok) {
      throw new ProviderError(await readErrorMessage(response), {
        retryable: response.status === 429 || response.status >= 500,
        providerStatus: response.status,
      });
    }
    const payload = (await response.json()) as OpenAiVideo;
    const raw = String(payload.status ?? "").toLowerCase();
    const state = OPENAI_STATUS_MAP[raw] ?? "running";
    return {
      state,
      progress:
        typeof payload.progress === "number" && payload.progress >= 0
          ? payload.progress > 1
            ? payload.progress / 100
            : payload.progress
          : null,
      error:
        state === "failed"
          ? (payload.error?.message ?? `OpenAI reported status "${raw}".`)
          : null,
      queuePosition: null,
    };
  }

  async result(
    _model: ModelDefinition,
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<ResultBundle> {
    // The content endpoint returns bytes. The caller stores them; the asset
    // URL is filled in by the storage layer, so the raw payload is returned
    // with an empty asset list and a `video` marker the storage layer reads.
    let response: Response;
    try {
      response = await fetch(`${OPENAI_BASE}/videos/${providerJobId}/content`, {
        headers: this.headers(),
        signal,
      });
    } catch (cause) {
      throw new ProviderError(
        cause instanceof Error ? cause.message : "OpenAI content fetch failed.",
        { retryable: true },
      );
    }
    if (!response.ok) {
      throw new ProviderError(await readErrorMessage(response), {
        retryable: response.status >= 500,
        providerStatus: response.status,
      });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const assets: GeneratedAsset[] = [];
    return {
      assets,
      raw: {
        kind: "openai-video-bytes",
        contentType: response.headers.get("content-type") ?? "video/mp4",
        bytes: buffer,
      },
    };
  }
}
