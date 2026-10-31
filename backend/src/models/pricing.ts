/**
 * Credit pricing.
 *
 * Credits are a local unit derived from the provider's own price. The formula
 * matches so the numbers a user sees are consistent
 * shape, but the multipliers are ours to change.
 *
 *   image credits = ceil(provider USD x IMAGE_MULTIPLIER)
 *   video credits = provider USD x VIDEO_MULTIPLIER
 *
 * The provider USD is the real cost of the model. Set IMAGE_MULTIPLIER and
 * VIDEO_MULTIPLIER to 1 to charge exactly what the provider charges, with no
 * subscription or credit pack in between.
 */

import type { ModelDefinition } from "./registry.js";

/** Credits per USD for an image run. */
export const IMAGE_MULTIPLIER = 250;

/** Credits per USD per second of video. */
export const VIDEO_MULTIPLIER = 320;

/**
 * An edit costs more than a create on these models, because the provider
 * bills the reference image as well.
 */
export const EDIT_MULTIPLIER = 1.3;

/**
 * Models whose provider price already covers the edit, and models whose
 * price does not vary by tier. These are charged flat.
 */
const FLAT_IMAGE_MODELS = new Set([
  "flux-2-pro-edit",
  "nano-banana-2-edit",
  "nano-banana-lite-edit",
  "seedream-4.5-edit",
  "z-image-turbo",
]);

export interface PriceOptions {
  /** Output tier for an image model. */
  resolution?: string | undefined;
  /** Duration in seconds for a video model. */
  durationSeconds?: number | undefined;
  /** True when the run edits an existing image. */
  edit?: boolean;
  /** Number of reference images, when the provider bills per extra image. */
  referenceCount?: number;
}

export interface PriceBreakdown {
  /** What the provider charges for this run, in USD. */
  providerUsd: number;
  /** What the customer is charged, in credits. */
  credits: number;
  /** Millicredits, for arithmetic that needs integers. */
  millicredits: number;
}

const roundUp = (value: number): number => Math.ceil(value - 1e-6);

const imageProviderUsd = (
  model: ModelDefinition,
  options: PriceOptions,
): number => {
  const table = model.providerUsd ?? {};
  const tier = options.resolution ?? "1K";
  const base = table[tier] ?? table["1K"] ?? 0;
  const flat = FLAT_IMAGE_MODELS.has(model.key);
  const editFactor =
    options.edit && !flat ? EDIT_MULTIPLIER : 1;
  return Number((base * editFactor).toFixed(6));
};

const videoProviderUsd = (
  model: ModelDefinition,
  options: PriceOptions,
): number => {
  const table = model.providerVideoUsd ?? {};
  if (table.flat !== undefined) return table.flat;

  const seconds = options.durationSeconds ?? 5;
  const quality = (options.resolution ?? "").toLowerCase();

  const perSecond = ((): number => {
    if (quality.includes("1080") && table.perSec1080 !== undefined) {
      return table.perSec1080;
    }
    if (quality.includes("480") && table.perSec480 !== undefined) {
      return table.perSec480;
    }
    if (quality.includes("768") && table.perSec768 !== undefined) {
      return table.perSec768;
    }
    if (quality.includes("4k") && table.perSec4k !== undefined) {
      return table.perSec4k;
    }
    if (quality.includes("2k") && table.perSec2k !== undefined) {
      return table.perSec2k;
    }
    return table.perSec ?? 0;
  })();

  const baseCost =
    table.base !== undefined && table.baseSecs !== undefined
      ? table.base + Math.max(0, seconds - table.baseSecs) * perSecond
      : perSecond * seconds;

  const audioCost = table.audioPerSec !== undefined ? table.audioPerSec * seconds : 0;

  // A reference-video edit is billed as input plus output.
  const editFactor =
    options.edit && table.editBillFactor !== undefined ? table.editBillFactor : 1;

  return Number(((baseCost + audioCost) * editFactor).toFixed(6));
};

/** The provider cost and the credit charge for one run. */
export const priceRun = (
  model: ModelDefinition,
  options: PriceOptions = {},
): PriceBreakdown => {
  const providerUsd = model.priceIsPerSecond
    ? videoProviderUsd(model, options)
    : imageProviderUsd(model, options);

  const multiplier = model.priceIsPerSecond ? VIDEO_MULTIPLIER : IMAGE_MULTIPLIER;
  const credits = model.priceIsPerSecond
    ? Number((providerUsd * multiplier).toFixed(3))
    : roundUp(providerUsd * multiplier);

  return {
    providerUsd,
    credits,
    millicredits: Math.round(credits * 1000),
  };
};

/** The price of one image at a given tier, for the catalogue. */
export const imageTierPrices = (
  model: ModelDefinition,
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const tier of model.resolutions) {
    out[tier] = priceRun(model, { resolution: tier }).credits;
  }
  return out;
};
