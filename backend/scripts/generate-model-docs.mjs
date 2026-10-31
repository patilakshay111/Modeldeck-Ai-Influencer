// Generate docs/MODEL-REGISTRY.md from the live model registry.
//
// The catalogue is the source of truth; this keeps the document in step with
// it instead of letting the two drift.

import { writeFileSync } from "node:fs";
import { MODELS } from "../src/models/registry.js";
import { priceRun } from "../src/models/pricing.js";

const outputPath = process.argv[2] ?? "docs/MODEL-REGISTRY.md";

const rows = MODELS.map((model) => {
  const seconds = Number(model.durations[0] ?? 5);
  const price = priceRun(model, {
    resolution: model.resolutions[0],
    durationSeconds: model.priceIsPerSecond ? seconds : undefined,
  });
  const tiers = Object.entries(model.providerUsd ?? {})
    .map(([tier, usd]) => `${tier} $${usd}`)
    .join(", ");
  const video = model.providerVideoUsd
    ? Object.entries(model.providerVideoUsd)
        .map(([key, value]) => `${key} $${value}`)
        .join(", ")
    : "";
  return {
    key: model.key,
    name: model.displayName,
    provider: model.provider,
    upstream: model.upstreamId,
    task: model.task,
    available: model.available,
    reason: model.unavailableReason ?? "",
    usd: tiers || video,
    credits: price.credits,
    perSecond: model.priceIsPerSecond,
    durations: model.durations.join(", "),
    resolutions: model.resolutions.join(", "),
    reference: model.acceptsReferenceImages,
  };
});

const grouped = new Map();
for (const row of rows) {
  const list = grouped.get(row.task) ?? [];
  list.push(row);
  grouped.set(row.task, list);
}

const lines = [];
lines.push("# Model registry");
lines.push("");
lines.push("Generated from `backend/src/models/registry.ts` by");
lines.push("`backend/scripts/generate-model-docs.mjs`. Do not edit by hand.");
lines.push("");
lines.push(
  "Every model names an upstream model on a provider this service holds a key for.",
  "The **provider USD** column is what the provider charges. The **credits**",
  "column is this service's own unit, derived from that cost — see",
  "`backend/src/models/pricing.ts`.",
);
lines.push("");
lines.push(
  `Total: **${rows.length}** models, ${rows.filter((r) => r.available).length} available on a host with fal + OpenAI keys, ${rows.filter((r) => !r.available).length} needing a direct provider account.`,
);
lines.push("");

for (const [task, list] of grouped) {
  lines.push(`## ${task}`);
  lines.push("");
  lines.push("| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const row of list) {
    const available = row.available ? "" : ` *(needs direct account)*`;
    lines.push(
      `| ${row.name}${available} | \`${row.key}\` | ${row.provider} | \`${row.upstream}\` | ${row.usd || "—"} | ${row.credits} | ${row.durations || "—"} | ${row.reference ? "yes" : "no"} |`,
    );
  }
  lines.push("");
}

lines.push("## Models excluded on purpose");
lines.push("");
lines.push(
  "The reference application also exposes a **\"spicy\"** tier: uncensored",
  "image and video models routed through its own internal router and through",
  "WaveSpeed (Z-Image, Qwen Image Edit, Seedream 4.0/4.5/5.0, Wan 2.2/2.7/3.0,",
  "Seedance 2.0/2.0 Fast/2.5, in their uncensored variants).",
);
lines.push("");
lines.push(
  "That tier is **not** reproduced here. It is separable because it is a",
  "different provider path with its own content policy, its own account tier and",
  "its own moderation obligations. Adding it is a deliberate decision, not a",
  "missing row: add the model to `MODELS` with `provider: \"fal\"` or",
  "`provider: \"direct\"`, give it a price, and the studio picks it up with no",
  "other change.",
);
lines.push("");
lines.push("## Adding a model");
lines.push("");
lines.push("1. Add an entry to `MODELS` in `backend/src/models/registry.ts`.");
lines.push("2. Give it the provider's own upstream id and the provider's USD price.");
lines.push("3. Write the `buildInput` that translates the canonical request into");
lines.push("   that provider's request body.");
lines.push("4. Run `npm run typecheck` and `node scripts/smoke.mjs`.");
lines.push("5. Regenerate this document.");
lines.push("");

writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`wrote ${outputPath} (${rows.length} models)`);
