# Model registry

Generated from `backend/src/models/registry.ts` by
`backend/scripts/generate-model-docs.mjs`. Do not edit by hand.

Every model names an upstream model on a provider this service holds a key for.
The **provider USD** column is what the provider charges. The **credits**
column is this service's own unit, derived from that cost — see
`backend/src/models/pricing.ts`.

Total: **50** models, 48 available on a host with fal + OpenAI keys, 2 needing a direct provider account.

## text-to-image

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Flux 2 Pro | `flux-2-pro` | fal | `fal-ai/flux-2-pro` | 1K $0.03, 2K $0.075, 4K $0.075 | 8 | — | no |
| Flux 2 Max | `flux-2-max` | fal | `fal-ai/flux-2-max` | 1K $0.07, 2K $0.16, 4K $0.16 | 18 | — | no |
| Flux 2 Flex | `flux-2-flex` | fal | `fal-ai/flux-2-flex` | 1K $0.03, 2K $0.05, 4K $0.05 | 8 | — | no |
| FLUX 1.1 Pro | `flux-1.1-pro` | fal | `fal-ai/flux-pro/v1.1` | 1K $0.025, 2K $0.05, 4K $0.05 | 7 | — | no |
| FLUX 1.1 Pro Ultra | `flux-1.1-pro-ultra` | fal | `fal-ai/flux-pro/v1.1-ultra` | 1K $0.04, 2K $0.08, 4K $0.08 | 10 | — | no |
| Nano Banana Pro | `nano-banana-pro` | fal | `fal-ai/nano-banana-pro` | 1K $0.15, 2K $0.15, 4K $0.3 | 38 | — | no |
| Nano Banana 2 | `nano-banana-2` | fal | `fal-ai/nano-banana-2` | 1K $0.08, 2K $0.12, 4K $0.16 | 20 | — | no |
| Nano Banana Lite | `nano-banana-lite` | fal | `google/nano-banana-lite` | 1K $0.04, 2K $0.04, 4K $0.04 | 10 | — | no |
| Seedream 4.5 | `seedream-4.5` | fal | `fal-ai/bytedance/seedream/v4.5/text-to-image` | 1K $0.04, 2K $0.04, 4K $0.04 | 10 | — | no |
| Seedream 4.0 | `seedream-4.0` | fal | `fal-ai/bytedance/seedream/v4/text-to-image` | 1K $0.03, 2K $0.03, 4K $0.03 | 8 | — | no |
| GPT Image 2 | `gpt-image-2` | fal | `openai/gpt-image-2` | 1K $0.21, 2K $0.21, 4K $0.4 | 53 | — | no |
| GPT Image 1 | `gpt-image-1` | fal | `fal-ai/gpt-image-1.5` | 1K $0.02, 2K $0.02, 4K $0.02 | 5 | — | no |
| Soul 2.0 *(needs direct account)* | `soul-2.0` | direct | `higgsfield/soul-2.0` | 1K $0.0032, 2K $0.0057, 4K $0.0057 | 1 | — | no |
| Z-Image Turbo | `z-image-turbo` | fal | `fal-ai/z-image/turbo` | 1K $0.02, 2K $0.02, 4K $0.02 | 5 | — | no |

## image-to-image

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Nano Banana Pro Edit | `nano-banana-pro-edit` | fal | `fal-ai/nano-banana-pro/edit` | 1K $0.15, 2K $0.15, 4K $0.3 | 38 | — | yes |
| Nano Banana 2 Edit | `nano-banana-2-edit` | fal | `fal-ai/nano-banana-2/edit` | 1K $0.08, 2K $0.12, 4K $0.16 | 20 | — | yes |
| Nano Banana Lite Edit | `nano-banana-lite-edit` | fal | `google/nano-banana-lite/edit` | 1K $0.04, 2K $0.04, 4K $0.04 | 10 | — | yes |
| Seedream 4.5 Edit | `seedream-4.5-edit` | fal | `fal-ai/bytedance/seedream/v4.5/edit` | 1K $0.04, 2K $0.04, 4K $0.04 | 10 | — | yes |
| FLUX 2 Pro Edit | `flux-2-pro-edit` | fal | `fal-ai/flux-2-pro/edit` | 1K $0.03, 2K $0.075, 4K $0.075 | 8 | — | yes |
| Kontext Max | `kontext-max` | fal | `fal-ai/flux-pro/kontext/max` | 1K $0.04, 2K $0.08, 4K $0.08 | 10 | — | yes |
| Qwen Image Edit | `qwen-image-edit` | fal | `fal-ai/qwen-image-edit-2511` | 1K $0.075, 2K $0.075, 4K $0.075 | 19 | — | yes |

## image-to-video

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Kling 3.0 | `kling-3.0` | fal | `fal-ai/kling-video/v3/pro/image-to-video` | perSec $0.112, audioPerSec $0.168 | 448 | 5, 10 | yes |
| Kling 2.6 | `kling-2.6` | fal | `fal-ai/kling-video/v2.6/pro/image-to-video` | perSec $0.07, audioPerSec $0.14 | 336 | 5, 10 | yes |
| Kling 2.5 Turbo | `kling-2.5-turbo` | fal | `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | base $0.35, baseSecs $5, perSec $0.07 | 112 | 5, 10 | yes |
| Seedance 2.5 | `seedance-2.5` | fal | `bytedance/seedance-2.5/us/image-to-video` | perSec $0.473, perSec480 $0.2205, perSec1080 $1.164 | 282.24 | 4, 5, 8, 10, 15, 20, 30 | yes |
| Seedance 2.0 | `seedance-2.0` | fal | `bytedance/seedance-2.0/us/image-to-video` | perSec $0.3034, perSec480 $0.14, perSec1080 $0.682 | 179.2 | 4, 5, 8, 10, 15 | yes |
| Seedance 2.0 Fast | `seedance-2.0-fast` | fal | `bytedance/seedance-2.0/fast/image-to-video` | perSec $0.2419, perSec480 $0.11 | 140.8 | 4, 5, 8, 10, 15 | yes |
| Veo 3.1 | `veo-3.1` | fal | `google/gemini-omni-flash/v1.1/image-to-video` | perSec $0.4 | 512 | 4, 6, 8 | yes |
| Wan 2.7 | `wan-2.7` | fal | `fal-ai/wan/v2.7/image-to-video` | perSec $0.125, perSec1080 $0.1875 | 200 | 5 | yes |
| Wan 2.2 | `wan-2.2` | fal | `fal-ai/wan/v2.2-a14b/image-to-video` | perSec $0.1 | 160 | 5 | yes |
| MiniMax Hailuo 2.3 | `hailuo-2.3` | fal | `fal-ai/minimax/hailuo-2.3/pro/image-to-video` | flat $0.49 | 0 | 6, 10 | yes |
| MiniMax Hailuo | `hailuo` | fal | `fal-ai/minimax/hailuo-02/pro/image-to-video` | perSec $0.045 | 86.4 | 6, 10 | yes |
| PixVerse v6 | `pixverse-v6` | fal | `fal-ai/pixverse/v6/image-to-video` | perSec $0.045, perSec1080 $0.09 | 72 | 5, 8 | yes |
| LTX Video | `ltx-video` | fal | `lightricks/ltx-2.5/image-to-video/pro` | perSec $0.04 | 64 | 5, 10 | yes |

## text-to-video

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Veo 3.1 Fast | `veo-3.1-fast` | fal | `google/gemini-omni-flash/v1.1/text-to-video` | perSec $0.1, perSec4k $0.3 | 128 | 4, 6, 8 | no |
| MiniMax H3 | `minimax-h3` | fal | `minimax/h3/text-to-video` | perSec $0.26, perSec480 $0.16, perSec768 $0.16, perSec2k $0.26, perSec4k $0.26 | 256 | 5, 6, 8, 10, 15 | no |
| Kling 3.0 (text) | `kling-3.0-text` | fal | `fal-ai/kling-video/v3/pro/text-to-video` | perSec $0.112, audioPerSec $0.168 | 448 | 5, 10 | no |
| Sora 2 | `sora-2` | openai | `sora-2` | perSec $0.1 | 128 | 4, 8, 12 | no |
| Sora 2 Pro | `sora-2-pro` | openai | `sora-2-pro` | perSec $0.3, perSec1080 $0.5 | 384 | 4, 8, 12 | no |
| Seedance 2.0 Fast (text) | `seedance-2.0-fast-text` | fal | `bytedance/seedance-2.0/fast/text-to-video` | perSec $0.2419, perSec480 $0.11 | 140.8 | 4, 5, 8, 10, 15 | no |

## video-to-video

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Genjutsu *(needs direct account)* | `genjutsu` | direct | `higgsfield/genjutsu` | perSec $0.681, perSec480 $0.318 | 1089.6 | — | no |
| Seedance 2.5 Edit | `seedance-2.5-edit` | fal | `bytedance/seedance-2.5/us/reference-to-video` | perSec $0.15, perSec480 $0.075, perSec1080 $0.375, perSec4k $0.75, editBillFactor $2 | 120 | — | no |
| Seedance 2.0 Edit | `seedance-2.0-edit` | fal | `bytedance/seedance-2.0/us/reference-to-video` | perSec $0.15, perSec480 $0.075, perSec1080 $0.375, perSec4k $0.75, editBillFactor $2 | 120 | — | no |
| Wan 2.7 Edit | `wan-2.7-edit` | fal | `fal-ai/wan/v2.7/edit-video` | perSec $0.125, perSec1080 $0.1875 | 200 | — | no |
| Kling Motion Control Pro | `kling-motion-control` | fal | `fal-ai/kling-video/v3/pro/motion-control` | perSec $0.112 | 179.2 | — | yes |

## upscale-image

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Topaz Image Upscale | `topaz-image-upscale` | fal | `topaz/upscale/image/precision` | 1K $0.02, 2K $0.02, 4K $0.02 | 5 | — | yes |
| SeedVR Image Upscale | `seedvr-image-upscale` | fal | `fal-ai/seedvr/upscale/image` | 1K $0.01, 2K $0.01, 4K $0.01 | 3 | — | yes |

## upscale-video

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Topaz Video Upscale | `topaz-video-upscale` | fal | `topaz/upscale/video/precision` | perSec $0.09 | 144 | — | yes |
| SeedVR Video Upscale | `seedvr-video-upscale` | fal | `fal-ai/seedvr/upscale/video` | perSec $0.05 | 80 | — | yes |

## image-to-text

| Model | Key | Provider | Upstream id | Provider USD | Credits | Durations | Ref |
|---|---|---|---|---|---|---|---|
| Bagel | `bagel` | fal | `fal-ai/bagel/understand` | 1K $0.01, 2K $0.01, 4K $0.01 | 3 | — | yes |

## Spicy / uncensored tier

Hidden behind `ENABLE_SPICY_MODELS=1` in `backend/.env`. When enabled:

**Image:** Qwen Image Edit Spicy, Seedream 4.0 Spicy/Edit, Seedream 4.5 Spicy/Edit, Seedream 5.0 Pro Spicy/Edit, Z-Image Spicy

**Video:** Seedance 2.0 Spicy/Fast, Seedance 2.5 Spicy, WAN 2.2 Spicy, WAN 2.7 Spicy, WAN 3.0 Spicy/Pro/Prime

Add more models to `MODELS` in `backend/src/models/registry.ts` with `spicy: true` to hide them from the public catalogue unless the flag is set.
other change.

## Adding a model

1. Add an entry to `MODELS` in `backend/src/models/registry.ts`.
2. Give it the provider's own upstream id and the provider's USD price.
3. Write the `buildInput` that translates the canonical request into
   that provider's request body.
4. Run `npm run typecheck` and `node scripts/smoke.mjs`.
5. Regenerate this document.
