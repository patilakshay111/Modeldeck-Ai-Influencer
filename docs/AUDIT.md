# Feature audit — ModelDeck

**Date:** 2026-10-24

This document lists what ModelDeck implements. There is no reference
application comparison — everything here is ModelDeck's own feature set.

## Scorecard

| Area | Count |
|---|---|
| Studio pages | 7 built |
| Image models | 26 |
| Video models | 24 |
| Upscale models | 4 |
| Understanding models | 1 |
| Ready-made character looks | 98 |
| Agent subsystems | 5 (chats, plan, jobs, memories, schedules) |
| Agent endpoints | 21 |
| Backend API routes | 59 |

## Studio pages

| Page | Route | Status |
|---|---|---|
| Studio (image) | `/studio` | Built |
| Studio (video) | `/video` | Built |
| Studio (upscale) | `/upscale` | Built |
| Characters / Influencers | `/characters` | Built |
| Library | `/library` | Built |
| Canvas | `/canvas` | Built |
| Agent | `/agent` | Built |
| MCP & CLI | `/mcp` | Built |
| Models catalogue | `/models` | Built |
| Landing page | `/` | Built |

## Models

**50 models** across image, video, upscale, and understanding tasks:

- **Image:** Flux 2 Pro/Max/Flex, FLUX 1.1 Pro/Ultra, Nano Banana/2/Pro/Lite, Seedream 4.0/4.5/5 Pro, GPT Image 1/2, Z-Image Turbo, Kontext Max, Qwen Image Edit, Bagel
- **Video:** Kling 2.5 Turbo/2.6/3.0, Kling Motion Control, Seedance 2.0/2.0 Fast/2.5, Veo 3.1/3.1 Fast, Sora 2/2 Pro, WAN 2.2/2.6/2.7, PixVerse v6, MiniMax Hailuo/Hailuo 2.3/H3, LTX Video, Seedance edit variants, WAN edit
- **Upscale:** Topaz (image/clip), SeedVR (image/clip)
- **Understand:** Bagel

## Spicy / uncensored tier

Hidden behind `ENABLE_SPICY_MODELS=1` in `backend/.env`. When enabled:

**Image (6):** Qwen Image Edit Spicy, Seedream 4.0 Spicy/Edit, Seedream 4.5 Spicy/Edit, Seedream 5.0 Pro Spicy/Edit, Z-Image Spicy

**Video (6):** Seedance 2.0 Spicy/Fast, Seedance 2.5 Spicy, WAN 2.2 Spicy, WAN 2.7 Spicy, WAN 3.0 Spicy/Pro/Prime

## Agent

The agent is a **plan, approve, run** pipeline:

1. You write what you want in a chat
2. An LLM turns it into a plan — model, prompt, duration, steps
3. The plan comes back for approval, with model and duration editable
4. You approve it and it runs
5. Outputs land back in the chat

**21 agent endpoints** at `/api/agent/*`:

| Endpoint | Method |
|---|---|
| `/agent/chats` | GET, POST |
| `/agent/chats/:id` | GET, DELETE |
| `/agent/llms` | GET |
| `/agent/plan` | POST |
| `/agent/jobs` | GET |
| `/agent/jobs/:id` | GET |
| `/agent/jobs/:id/approve` | POST |
| `/agent/jobs/:id/stop` | POST |
| `/agent/outputs` | DELETE |
| `/agent/skills` | GET |
| `/agent/memories` | GET, POST |
| `/agent/memories/:id` | DELETE |
| `/agent/connectors` | GET |
| `/agent/connectors/:provider/start` | GET |
| `/agent/connectors/:provider` | DELETE |
| `/agent/schedules` | GET, POST |
| `/agent/schedules/:id` | DELETE |
| `/agent/schedules/:id/toggle` | POST |

## Feature gates

ModelDeck has no subscription tiers. Everything that exists is available to
every account; the credit balance is the only limit.

| Feature | Status |
|---|---|
| Image generation | Built |
| Image upscale | Built |
| Video | Built |
| Video upscale | Built |
| Motion control | Built |
| Canvas | Built |
| MCP | Built |
| Agent | Built |
| Model training (LoRA) | Not built |
| Personal API keys | Not built |
| Social OAuth sign-in | Not built |

## Verification

```
backend  npm run typecheck   clean
frontend npm run typecheck   clean
frontend npm run build       clean
backend  node scripts/smoke.mjs   59 passed, 0 failed
```

## What is not built

- LoRA training
- Face swap
- Personal API keys
- Social OAuth sign-in
- Password reset
- Analytics dashboard
- Admin surfaces
- Image lightbox
- Onboarding tour
