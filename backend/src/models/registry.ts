/**
 * The ModelDeck model catalogue.
 *
 * This is the model table for
 * ModelDeck, with the upstream identifiers resolved against the providers'
 * own published catalogues.
 *
 * Two things are separated on purpose:
 *
 *  - `providerUsd` is what the model provider charges. This is the real cost
 *    of running the model, and it is the number that matters when you want to
 *    pay only for the models you use.
 *  - credits are a local pricing policy derived from that cost (see
 *    `./pricing.ts`). The multiplier is ours to set.
 *
 * Models the reference routes through a provider we do not hold a key for are
 * marked `available: false` rather than being silently dropped, so the gap is
 * visible instead of absent.
 */

export type ProviderId = "fal" | "openai" | "direct";

export type ModelTask =
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video"
  | "video-to-video"
  | "upscale-image"
  | "upscale-video"
  | "image-to-text";

/** Canonical request fields the studio sends. */
export interface CanonicalInput {
  prompt?: string;
  /** Reference image URL(s). Many providers accept exactly one. */
  images?: string[];
  aspectRatio?: string;
  /** Tier for image models ("1K", "2K", "4K") or quality for video ("720p"). */
  resolution?: string;
  /** Video duration in seconds. */
  duration?: string;
  seed?: number;
  /** Provider-specific extras passed through untouched. */
  extra?: Record<string, unknown>;
}

/** Provider price for an image model, by output tier, in USD. */
export type ImagePriceTable = Record<string, number>;

/** Provider price for a video model, in USD. */
export interface VideoPriceTable {
  /** Price per second of output. */
  perSec?: number;
  /** Flat price per rendered video. */
  flat?: number;
  /** Base price that covers the first `baseSecs` seconds. */
  base?: number;
  baseSecs?: number;
  /** Extra per second when the model renders audio. */
  audioPerSec?: number;
  /** Tier-specific per-second prices. */
  perSec480?: number;
  perSec768?: number;
  perSec1080?: number;
  perSec2k?: number;
  perSec4k?: number;
  /** Reference videos are billed as input plus output. */
  editBillFactor?: number;
}

export interface ModelDefinition {
  /** Stable slug used by the API and stored on generated assets. */
  key: string;
  /** The name this model is shown under. */
  displayName: string;
  provider: ProviderId;
  /** The provider's own model identifier. */
  upstreamId: string;
  task: ModelTask;
  /** True when the model is not reachable on this host yet. */
  available: boolean;
  /** Why the model is unavailable, when it is. */
  unavailableReason?: string;
  /** Provider price for an image model. */
  providerUsd?: ImagePriceTable;
  /** Provider price for a video model. */
  providerVideoUsd?: VideoPriceTable;
  /** True when the model accepts one or more reference images. */
  acceptsReferenceImages: boolean;
  /** True when the model accepts a text prompt. */
  acceptsPrompt: boolean;
  /** True when the model is in the uncensored/spicy tier. Hidden by default. */
  spicy?: boolean;
  /** Aspect ratios the model accepts. Empty means "provider default". */
  aspectRatios: readonly string[];
  /** Output tiers or qualities the model accepts. */
  resolutions: readonly string[];
  /** Video durations in seconds, when the model is a video model. */
  durations: readonly string[];
  /** Whether the price scales with duration. */
  priceIsPerSecond: boolean;
  /**
   * Translation from the canonical request to the provider's request body.
   * `firstImage` is the reference image, when the provider takes only one.
   */
  buildInput: (input: CanonicalInput) => Record<string, unknown>;
}

const compact = (body: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
};

const textToImage = (
  input: CanonicalInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> =>
  compact({
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    seed: input.seed,
    num_images: 1,
    ...extra,
    ...input.extra,
  });

const imageToImage = (
  input: CanonicalInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> =>
  compact({
    prompt: input.prompt,
    image_url: input.images?.[0],
    image_urls:
      input.images && input.images.length > 1 ? input.images : undefined,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    seed: input.seed,
    num_images: 1,
    ...extra,
    ...input.extra,
  });

const imageToVideo = (
  input: CanonicalInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> =>
  compact({
    prompt: input.prompt,
    image_url: input.images?.[0],
    duration: input.duration,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    seed: input.seed,
    ...extra,
    ...input.extra,
  });

const textToVideo = (
  input: CanonicalInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> =>
  compact({
    prompt: input.prompt,
    duration: input.duration,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    seed: input.seed,
    ...extra,
    ...input.extra,
  });

const ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;
const SQUARE = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const TIERS = ["1K", "2K", "4K"] as const;

export const MODELS: readonly ModelDefinition[] = [
  // ── Image: text to image ────────────────────────────────────────────────
  {
    key: "flux-2-pro",
    displayName: "Flux 2 Pro",
    provider: "fal",
    upstreamId: "fal-ai/flux-2-pro",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.03, "2K": 0.075, "4K": 0.075 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "flux-2-max",
    displayName: "Flux 2 Max",
    provider: "fal",
    upstreamId: "fal-ai/flux-2-max",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.07, "2K": 0.16, "4K": 0.16 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "flux-2-flex",
    displayName: "Flux 2 Flex",
    provider: "fal",
    upstreamId: "fal-ai/flux-2-flex",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.03, "2K": 0.05, "4K": 0.05 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "flux-1.1-pro",
    displayName: "FLUX 1.1 Pro",
    provider: "fal",
    upstreamId: "fal-ai/flux-pro/v1.1",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.025, "2K": 0.05, "4K": 0.05 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: ["1K", "2K"],
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "flux-1.1-pro-ultra",
    displayName: "FLUX 1.1 Pro Ultra",
    provider: "fal",
    upstreamId: "fal-ai/flux-pro/v1.1-ultra",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.08, "4K": 0.08 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: ["1K", "2K"],
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "nano-banana-pro",
    displayName: "Nano Banana Pro",
    provider: "fal",
    upstreamId: "fal-ai/nano-banana-pro",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.15, "2K": 0.15, "4K": 0.3 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "nano-banana-2",
    displayName: "Nano Banana 2",
    provider: "fal",
    upstreamId: "fal-ai/nano-banana-2",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.08, "2K": 0.12, "4K": 0.16 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "nano-banana-lite",
    displayName: "Nano Banana Lite",
    provider: "fal",
    upstreamId: "google/nano-banana-lite",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "seedream-4.5",
    displayName: "Seedream 4.5",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "seedream-4.0",
    displayName: "Seedream 4.0",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4/text-to-image",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.03, "2K": 0.03, "4K": 0.03 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "gpt-image-2",
    displayName: "GPT Image 2",
    provider: "fal",
    upstreamId: "openai/gpt-image-2",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.21, "2K": 0.21, "4K": 0.4 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ["auto", "1:1", "2:3", "3:2"],
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "gpt-image-1",
    displayName: "GPT Image 1",
    provider: "fal",
    upstreamId: "fal-ai/gpt-image-1.5",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.02, "2K": 0.02, "4K": 0.02 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ["auto", "1:1", "2:3", "3:2"],
    resolutions: ["1K"],
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "soul-2.0",
    displayName: "Soul 2.0",
    provider: "direct",
    upstreamId: "higgsfield/soul-2.0",
    task: "text-to-image",
    available: false,
    unavailableReason:
      "Higgsfield is not a fal.ai model. It needs a direct Higgsfield account.",
    providerUsd: { "1K": 0.0032, "2K": 0.0057, "4K": 0.0057 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ["auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"],
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },
  {
    key: "z-image-turbo",
    displayName: "Z-Image Turbo",
    provider: "fal",
    upstreamId: "fal-ai/z-image/turbo",
    task: "text-to-image",
    available: true,
    providerUsd: { "1K": 0.02, "2K": 0.02, "4K": 0.02 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => textToImage(input),
  },

  // ── Image: image to image / editing ─────────────────────────────────────
  {
    key: "nano-banana-pro-edit",
    displayName: "Nano Banana Pro Edit",
    provider: "fal",
    upstreamId: "fal-ai/nano-banana-pro/edit",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.15, "2K": 0.15, "4K": 0.3 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "nano-banana-2-edit",
    displayName: "Nano Banana 2 Edit",
    provider: "fal",
    upstreamId: "fal-ai/nano-banana-2/edit",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.08, "2K": 0.12, "4K": 0.16 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "nano-banana-lite-edit",
    displayName: "Nano Banana Lite Edit",
    provider: "fal",
    upstreamId: "google/nano-banana-lite/edit",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "seedream-4.5-edit",
    displayName: "Seedream 4.5 Edit",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4.5/edit",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "flux-2-pro-edit",
    displayName: "FLUX 2 Pro Edit",
    provider: "fal",
    upstreamId: "fal-ai/flux-2-pro/edit",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.03, "2K": 0.075, "4K": 0.075 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "kontext-max",
    displayName: "Kontext Max",
    provider: "fal",
    upstreamId: "fal-ai/flux-pro/kontext/max",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.08, "4K": 0.08 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "qwen-image-edit",
    displayName: "Qwen Image Edit",
    provider: "fal",
    upstreamId: "fal-ai/qwen-image-edit-2511",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.075, "2K": 0.075, "4K": 0.075 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },

  // ── Video: image to video ───────────────────────────────────────────────
  {
    key: "kling-3.0",
    displayName: "Kling 3.0",
    provider: "fal",
    upstreamId: "fal-ai/kling-video/v3/pro/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.112, audioPerSec: 0.168 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "kling-2.6",
    displayName: "Kling 2.6",
    provider: "fal",
    upstreamId: "fal-ai/kling-video/v2.6/pro/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.07, audioPerSec: 0.14 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "kling-2.5-turbo",
    displayName: "Kling 2.5 Turbo",
    provider: "fal",
    upstreamId: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { base: 0.35, baseSecs: 5, perSec: 0.07 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "seedance-2.5",
    displayName: "Seedance 2.5",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.5/us/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.473, perSec480: 0.2205, perSec1080: 1.164 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "720p", "1080p"],
    durations: ["4", "5", "8", "10", "15", "20", "30"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "seedance-2.0",
    displayName: "Seedance 2.0",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.0/us/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.3034, perSec480: 0.14, perSec1080: 0.682 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "720p", "1080p"],
    durations: ["4", "5", "8", "10", "15"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "seedance-2.0-fast",
    displayName: "Seedance 2.0 Fast",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.0/fast/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.2419, perSec480: 0.11 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "720p"],
    durations: ["4", "5", "8", "10", "15"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "veo-3.1",
    displayName: "Veo 3.1",
    provider: "fal",
    upstreamId: "google/gemini-omni-flash/v1.1/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.4 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["720p", "1080p"],
    durations: ["4", "6", "8"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "veo-3.1-fast",
    displayName: "Veo 3.1 Fast",
    provider: "fal",
    upstreamId: "google/gemini-omni-flash/v1.1/text-to-video",
    task: "text-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.1, perSec4k: 0.3 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["720p", "1080p"],
    durations: ["4", "6", "8"],
    priceIsPerSecond: true,
    buildInput: (input) => textToVideo(input),
  },
  {
    key: "wan-2.7",
    displayName: "Wan 2.7",
    provider: "fal",
    upstreamId: "fal-ai/wan/v2.7/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.125, perSec1080: 0.1875 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "wan-2.2",
    displayName: "Wan 2.2",
    provider: "fal",
    upstreamId: "fal-ai/wan/v2.2-a14b/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.1 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "hailuo-2.3",
    displayName: "MiniMax Hailuo 2.3",
    provider: "fal",
    upstreamId: "fal-ai/minimax/hailuo-2.3/pro/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { flat: 0.49 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["6", "10"],
    priceIsPerSecond: false,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "hailuo",
    displayName: "MiniMax Hailuo",
    provider: "fal",
    upstreamId: "fal-ai/minimax/hailuo-02/pro/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.045 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["6", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "minimax-h3",
    displayName: "MiniMax H3",
    provider: "fal",
    upstreamId: "minimax/h3/text-to-video",
    task: "text-to-video",
    available: true,
    providerVideoUsd: {
      perSec: 0.26,
      perSec480: 0.16,
      perSec768: 0.16,
      perSec2k: 0.26,
      perSec4k: 0.26,
    },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "768p", "2k", "4k"],
    durations: ["5", "6", "8", "10", "15"],
    priceIsPerSecond: true,
    buildInput: (input) => textToVideo(input),
  },
  {
    key: "pixverse-v6",
    displayName: "PixVerse v6",
    provider: "fal",
    upstreamId: "fal-ai/pixverse/v6/image-to-video",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.045, perSec1080: 0.09 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5", "8"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "ltx-video",
    displayName: "LTX Video",
    provider: "fal",
    upstreamId: "lightricks/ltx-2.5/image-to-video/pro",
    task: "image-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "genjutsu",
    displayName: "Genjutsu",
    provider: "direct",
    upstreamId: "higgsfield/genjutsu",
    task: "video-to-video",
    available: false,
    unavailableReason:
      "Higgsfield is not a fal.ai model. It needs a direct Higgsfield account.",
    providerVideoUsd: { perSec: 0.681, perSec480: 0.318 },
    acceptsReferenceImages: false,
    acceptsPrompt: false,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        video_url: input.extra?.["video_url"],
        image_url: input.images?.[0],
        ...input.extra,
      }),
  },

  // ── Video: text to video ────────────────────────────────────────────────
  {
    key: "kling-3.0-text",
    displayName: "Kling 3.0 (text)",
    provider: "fal",
    upstreamId: "fal-ai/kling-video/v3/pro/text-to-video",
    task: "text-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.112, audioPerSec: 0.168 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => textToVideo(input),
  },
  {
    key: "sora-2",
    displayName: "Sora 2",
    provider: "openai",
    upstreamId: "sora-2",
    task: "text-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.1 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["720p", "1080p"],
    durations: ["4", "8", "12"],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        size: input.aspectRatio === "9:16" ? "720x1280" : "1280x720",
        seconds: input.duration ? Number(input.duration) : undefined,
        ...input.extra,
      }),
  },
  {
    key: "sora-2-pro",
    displayName: "Sora 2 Pro",
    provider: "openai",
    upstreamId: "sora-2-pro",
    task: "text-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.3, perSec1080: 0.5 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["720p", "1080p"],
    durations: ["4", "8", "12"],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        size: input.aspectRatio === "9:16" ? "720x1280" : "1280x720",
        seconds: input.duration ? Number(input.duration) : undefined,
        ...input.extra,
      }),
  },
  {
    key: "seedance-2.0-fast-text",
    displayName: "Seedance 2.0 Fast (text)",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.0/fast/text-to-video",
    task: "text-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.2419, perSec480: 0.11 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "720p"],
    durations: ["4", "5", "8", "10", "15"],
    priceIsPerSecond: true,
    buildInput: (input) => textToVideo(input),
  },

  // ── Video: video to video ───────────────────────────────────────────────
  {
    key: "seedance-2.5-edit",
    displayName: "Seedance 2.5 Edit",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.5/us/reference-to-video",
    task: "video-to-video",
    available: true,
    providerVideoUsd: {
      perSec: 0.15,
      perSec480: 0.075,
      perSec1080: 0.375,
      perSec4k: 0.75,
      editBillFactor: 2,
    },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "720p", "1080p"],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        video_url: input.extra?.["video_url"],
        ...input.extra,
      }),
  },
  {
    key: "seedance-2.0-edit",
    displayName: "Seedance 2.0 Edit",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.0/us/reference-to-video",
    task: "video-to-video",
    available: true,
    providerVideoUsd: {
      perSec: 0.15,
      perSec480: 0.075,
      perSec1080: 0.375,
      perSec4k: 0.75,
      editBillFactor: 2,
    },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: ["480p", "720p", "1080p"],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        video_url: input.extra?.["video_url"],
        ...input.extra,
      }),
  },
  {
    key: "wan-2.7-edit",
    displayName: "Wan 2.7 Edit",
    provider: "fal",
    upstreamId: "fal-ai/wan/v2.7/edit-video",
    task: "video-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.125, perSec1080: 0.1875 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        video_url: input.extra?.["video_url"],
        ...input.extra,
      }),
  },
  {
    key: "kling-motion-control",
    displayName: "Kling Motion Control Pro",
    provider: "fal",
    upstreamId: "fal-ai/kling-video/v3/pro/motion-control",
    task: "video-to-video",
    available: true,
    providerVideoUsd: { perSec: 0.112 },
    acceptsReferenceImages: true,
    acceptsPrompt: false,
    aspectRatios: ASPECTS,
    resolutions: [],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        image_url: input.images?.[0],
        video_url: input.extra?.["video_url"],
        ...input.extra,
      }),
  },

  // ── Upscale ──────────────────────────────────────────────────────────────
  {
    key: "topaz-image-upscale",
    displayName: "Topaz Image Upscale",
    provider: "fal",
    upstreamId: "topaz/upscale/image/precision",
    task: "upscale-image",
    available: true,
    providerUsd: { "1K": 0.02, "2K": 0.02, "4K": 0.02 },
    acceptsReferenceImages: true,
    acceptsPrompt: false,
    aspectRatios: [],
    resolutions: [],
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        image_url: input.images?.[0],
        output_format: "jpeg",
        ...input.extra,
      }),
  },
  {
    key: "topaz-video-upscale",
    displayName: "Topaz Video Upscale",
    provider: "fal",
    upstreamId: "topaz/upscale/video/precision",
    task: "upscale-video",
    available: true,
    providerVideoUsd: { perSec: 0.09 },
    acceptsReferenceImages: true,
    acceptsPrompt: false,
    aspectRatios: [],
    resolutions: [],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({
        video_url: input.extra?.["video_url"],
        ...input.extra,
      }),
  },
  {
    key: "seedvr-image-upscale",
    displayName: "SeedVR Image Upscale",
    provider: "fal",
    upstreamId: "fal-ai/seedvr/upscale/image",
    task: "upscale-image",
    available: true,
    providerUsd: { "1K": 0.01, "2K": 0.01, "4K": 0.01 },
    acceptsReferenceImages: true,
    acceptsPrompt: false,
    aspectRatios: [],
    resolutions: [],
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({ image_url: input.images?.[0], ...input.extra }),
  },
  {
    key: "seedvr-video-upscale",
    displayName: "SeedVR Video Upscale",
    provider: "fal",
    upstreamId: "fal-ai/seedvr/upscale/video",
    task: "upscale-video",
    available: true,
    providerVideoUsd: { perSec: 0.05 },
    acceptsReferenceImages: true,
    acceptsPrompt: false,
    aspectRatios: [],
    resolutions: [],
    durations: [],
    priceIsPerSecond: true,
    buildInput: (input) =>
      compact({ video_url: input.extra?.["video_url"], ...input.extra }),
  },

  // ── Identity kit generators ────────────────────────────────────────────────
  // Flux 2 LoRA gallery models that build a character kit from one face photo:
  // turnaround (six angles) and full-body pairs.
  {
    key: "flux-2-multiple-angles",
    displayName: "Flux 2 Multiple Angles (kit)",
    provider: "fal",
    upstreamId: "fal-ai/flux-2-lora-gallery/multiple-angles",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        image_url: input.images?.[0],
        prompt:
          input.prompt ??
          "six-view character turnaround of the same person, consistent face, front / 3/4 left / 3/4 right / profile left / profile right / back, neutral lighting, white background, full body, photorealistic",
        ...input.extra,
      }),
  },
  {
    key: "flux-2-full-portrait",
    displayName: "Flux 2 Full Portrait (kit)",
    provider: "fal",
    upstreamId: "fal-ai/flux-2-lora-gallery/face-to-full-portrait",
    task: "image-to-image",
    available: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        image_url: input.images?.[0],
        prompt:
          input.prompt ??
          "full body portrait of the same person, consistent face, neutral lighting, studio background, photorealistic",
        ...input.extra,
      }),
  },

  // ── Uncensored / spicy tier ────────────────────────────────────────────────
  // These models are hidden from the public catalogue unless ENABLE_SPICY_MODELS
  // is set, matching how the reference keeps its spicy tier behind Growth.
  {
    key: "qwen-image-edit-spicy",
    displayName: "Qwen Image Edit Spicy",
    provider: "fal",
    upstreamId: "fal-ai/qwen-image-edit-spicy",
    task: "image-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.075, "2K": 0.075, "4K": 0.075 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "seedream-v4-spicy",
    displayName: "Seedream 4.0 Spicy",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4/spicy",
    task: "text-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        seed: input.seed,
        num_images: 1,
        ...input.extra,
      }),
  },
  {
    key: "seedream-v4-spicy-edit",
    displayName: "Seedream 4.0 Edit Spicy",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4/spicy/edit",
    task: "image-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "seedream-v4.5-spicy",
    displayName: "Seedream 4.5 Spicy",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4.5/spicy",
    task: "text-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        seed: input.seed,
        num_images: 1,
        ...input.extra,
      }),
  },
  {
    key: "seedream-v4.5-spicy-edit",
    displayName: "Seedream 4.5 Edit Spicy",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v4.5/spicy/edit",
    task: "image-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.04, "2K": 0.04, "4K": 0.04 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "seedream-v5.0-pro-spicy",
    displayName: "Seedream 5.0 Pro Spicy",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v5.0-pro/spicy",
    task: "text-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.06, "2K": 0.06, "4K": 0.06 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        seed: input.seed,
        num_images: 1,
        ...input.extra,
      }),
  },
  {
    key: "seedream-v5.0-pro-spicy-edit",
    displayName: "Seedream 5.0 Pro Edit Spicy",
    provider: "fal",
    upstreamId: "fal-ai/bytedance/seedream/v5.0-pro/spicy/edit",
    task: "image-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.06, "2K": 0.06, "4K": 0.06 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) => imageToImage(input),
  },
  {
    key: "z-image-spicy",
    displayName: "Z-Image Spicy",
    provider: "fal",
    upstreamId: "fal-ai/z-image/spicy",
    task: "text-to-image",
    available: true,
    spicy: true,
    providerUsd: { "1K": 0.03, "2K": 0.03, "4K": 0.03 },
    acceptsReferenceImages: false,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: TIERS,
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        seed: input.seed,
        num_images: 1,
        ...input.extra,
      }),
  },

  // ── Spicy video ────────────────────────────────────────────────────────────
  {
    key: "seedance-2.0-spicy",
    displayName: "Seedance 2.0 Spicy",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.0/us/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.24, perSec480: 0.12, perSec1080: 0.60, perSec4k: 1.20 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "seedance-2.0-fast-spicy",
    displayName: "Seedance 2.0 Fast Spicy",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.0/fast/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.20, perSec480: 0.10, perSec1080: 0.50, perSec4k: 1.00 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "seedance-2.5-spicy",
    displayName: "Seedance 2.5 Spicy",
    provider: "fal",
    upstreamId: "bytedance/seedance-2.5/us/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.36, perSec480: 0.18, perSec1080: 0.90, perSec4k: 1.80 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5", "10"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "wan-2.2-spicy",
    displayName: "WAN 2.2 Spicy",
    provider: "fal",
    upstreamId: "fal-ai/wan/v2.2-a14b/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.06, perSec480: 0.03, perSec1080: 0.06 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "wan-2.7-spicy",
    displayName: "WAN 2.7 Spicy",
    provider: "fal",
    upstreamId: "fal-ai/wan/v2.6/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.1875, perSec480: 0.03, perSec1080: 0.125 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "wan-3.0-spicy",
    displayName: "WAN 3.0 Spicy",
    provider: "fal",
    upstreamId: "alibaba/wan-3.0/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.20, perSec480: 0.05, perSec1080: 0.10 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "wan-3.0-pro-spicy",
    displayName: "WAN 3.0 Pro Spicy",
    provider: "fal",
    upstreamId: "alibaba/wan-3.0-prime/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.23, perSec480: 0.05, perSec1080: 0.18 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },
  {
    key: "wan-3.0-prime-spicy",
    displayName: "WAN 3.0 Prime Spicy",
    provider: "fal",
    upstreamId: "alibaba/wan-3.0-prime/spicy",
    task: "image-to-video",
    available: true,
    spicy: true,
    providerVideoUsd: { perSec: 0.28, perSec480: 0.068, perSec1080: 0.14 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: SQUARE,
    resolutions: [],
    durations: ["5"],
    priceIsPerSecond: true,
    buildInput: (input) => imageToVideo(input),
  },

  // ── Image understanding ──────────────────────────────────────────────────
  {
    key: "bagel",
    displayName: "Bagel",
    provider: "fal",
    upstreamId: "fal-ai/bagel/understand",
    task: "image-to-text",
    available: true,
    providerUsd: { "1K": 0.01, "2K": 0.01, "4K": 0.01 },
    acceptsReferenceImages: true,
    acceptsPrompt: true,
    aspectRatios: [],
    resolutions: [],
    durations: [],
    priceIsPerSecond: false,
    buildInput: (input) =>
      compact({
        image_url: input.images?.[0],
        prompt: input.prompt,
        ...input.extra,
      }),
  },
];

const BY_KEY = new Map(MODELS.map((model) => [model.key, model]));

export const findModel = (key: string): ModelDefinition | undefined =>
  BY_KEY.get(key);

/** The catalogue as the API exposes it: no provider internals, no keys. */
export const publicCatalogue = (
  includeSpicy = false,
): Array<{
  key: string;
  displayName: string;
  task: ModelTask;
  available: boolean;
  unavailableReason?: string;
  acceptsReferenceImages: boolean;
  acceptsPrompt: boolean;
  aspectRatios: readonly string[];
  resolutions: readonly string[];
  durations: readonly string[];
  spicy?: boolean;
}> =>
  MODELS.map((model) => ({
    key: model.key,
    displayName: model.displayName,
    task: model.task,
    available: model.available,
    ...(model.unavailableReason === undefined
      ? {}
      : { unavailableReason: model.unavailableReason }),
    acceptsReferenceImages: model.acceptsReferenceImages,
    acceptsPrompt: model.acceptsPrompt,
    aspectRatios: model.aspectRatios,
    resolutions: model.resolutions,
    durations: model.durations,
    ...(model.spicy === undefined ? {} : { spicy: model.spicy }),
  }))
  .filter((model) => !model.spicy || includeSpicy);
