/**
 * fal.ai queue adapter.
 *
 * fal runs every model as an asynchronous queue job:
 *
 *   submit → { requestId }
 *   status → IN_QUEUE | IN_PROGRESS | COMPLETED
 *   result → { images: [...] } or { video: { url } }
 *
 * The request body is produced by the model's own `buildInput`, so this
 * adapter stays a thin, provider-faithful transport.
 */

import { fal } from "@fal-ai/client";
import type { CanonicalInput, ModelDefinition } from "../models/registry.js";
import {
  ProviderError,
  type GeneratedAsset,
  type GenerationProvider,
  type ResultBundle,
  type StatusResult,
  type SubmitResult,
} from "./types.js";

type FalQueueStatus = {
  status?: string;
  queue_position?: number;
  error?: unknown;
};

const FAL_STATUS_MAP: Record<string, StatusResult["state"]> = {
  IN_QUEUE: "queued",
  IN_PROGRESS: "running",
  COMPLETED: "completed",
};

const readString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "detail", "error"]) {
      const candidate = record[key];
      if (typeof candidate === "string") return candidate;
    }
  }
  return null;
};

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Pull media URLs out of the several shapes fal result payloads use. */
const collectAssets = (payload: unknown): GeneratedAsset[] => {
  const assets: GeneratedAsset[] = [];
  const root = payload as Record<string, unknown> | null;
  if (!root || typeof root !== "object") return assets;

  const push = (entry: unknown): void => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as Record<string, unknown>;
    const url = readString(item.url);
    if (!url) return;
    const contentType = readString(item.content_type) ?? readString(item.mime_type);
    assets.push({
      url,
      contentType,
      width: readNumber(item.width),
      height: readNumber(item.height),
      isVideo:
        (contentType?.startsWith("video/") ?? false) ||
        /\.(mp4|webm|mov)(\?|$)/i.test(url),
    });
  };

  const images = root["images"];
  if (Array.isArray(images)) images.forEach(push);

  const video = root["video"];
  if (video && typeof video === "object") {
    const record = video as Record<string, unknown>;
    if (record["url"]) push(record);
  }
  if (typeof root["video"] === "string") {
    assets.push({
      url: root["video"],
      contentType: null,
      width: null,
      height: null,
      isVideo: true,
    });
  }

  // Some models return a single top-level `image` string.
  const single = root["image"];
  if (typeof single === "string") {
    assets.push({
      url: single,
      contentType: null,
      width: null,
      height: null,
      isVideo: false,
    });
  }

  return assets;
};

export class FalProvider implements GenerationProvider {
  readonly id = "fal" as const;
  readonly configured: boolean;

  constructor(apiKey: string | undefined) {
    this.configured = Boolean(apiKey);
    if (apiKey) fal.config({ credentials: apiKey });
  }

  async submit(
    model: ModelDefinition,
    input: CanonicalInput,
    signal?: AbortSignal,
  ): Promise<SubmitResult> {
    if (!this.configured) {
      throw new ProviderError(
        "fal.ai is not configured on this host. Set FAL_KEY.",
        { retryable: false },
      );
    }
    try {
      const submitted = (await fal.queue.submit(model.upstreamId, {
        input: model.buildInput(input),
      })) as unknown as { requestId?: string; request_id?: string };
      // The client has spelled the identifier both ways across releases.
      const requestId = submitted.requestId ?? submitted.request_id;
      if (typeof requestId !== "string" || requestId.length === 0) {
        throw new ProviderError("fal.ai returned no request id.", {
          retryable: true,
        });
      }
      return { providerJobId: requestId };
    } catch (cause) {
      if (cause instanceof ProviderError) throw cause;
      const message =
        cause instanceof Error ? cause.message : "fal.ai submit failed.";
      throw new ProviderError(message, { retryable: true });
    } finally {
      void signal;
    }
  }

  async status(
    model: ModelDefinition,
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<StatusResult> {
    if (!this.configured) {
      throw new ProviderError("fal.ai is not configured on this host.");
    }
    let raw: FalQueueStatus;
    try {
      raw = (await fal.queue.status(model.upstreamId, {
        requestId: providerJobId,
        logs: true,
      })) as FalQueueStatus;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "fal.ai status failed.";
      throw new ProviderError(message, { retryable: true });
    } finally {
      void signal;
    }

    const state = FAL_STATUS_MAP[String(raw.status ?? "").toUpperCase()];
    if (!state) {
      return {
        state: "running",
        progress: null,
        error: null,
        queuePosition: readNumber(raw.queue_position),
      };
    }
    return {
      state,
      progress: null,
      error: state === "failed" ? (readString(raw.error) ?? "fal.ai reported a failure.") : null,
      queuePosition: readNumber(raw.queue_position),
    };
  }

  async result(
    model: ModelDefinition,
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<ResultBundle> {
    if (!this.configured) {
      throw new ProviderError("fal.ai is not configured on this host.");
    }
    let payload: unknown;
    try {
      payload = await fal.queue.result(model.upstreamId, {
        requestId: providerJobId,
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "fal.ai result failed.";
      throw new ProviderError(message, { retryable: true });
    } finally {
      void signal;
    }
    return { assets: collectAssets(payload), raw: payload };
  }
}
