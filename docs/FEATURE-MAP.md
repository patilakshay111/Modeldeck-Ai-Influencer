# Feature map — ModelDeck

This document lists what ModelDeck implements. Status markers:

| Marker | Meaning |
|---|---|
| **built** | Implemented and exercised by the smoke test |
| **partial** | Implemented in a narrower form |
| **planned** | Specified here, not yet built |
| **excluded** | Deliberately not reproduced |

---

## Studio

| Feature | Status | Where |
|---|---|---|
| Model picker, grouped by task | **built** | `frontend/src/components/ModelPicker.tsx` |
| Prompt bar | **built** | `frontend/src/pages/Studio.tsx` |
| Aspect / quality / duration pickers | **built** | Options from the model registry |
| Reference images per generation (up to 8) | **built** | `frontend/src/pages/Studio.tsx` |
| Start-and-poll generation | **built** | `POST` → `jobId`, poll `status` |
| Out-of-credit handling | **built** | `402 insufficient_credits` with balance |
| Generation error messages | **built** | Structured errors |
| Upscale tab | **built** | Topaz and SeedVR in registry |
| Image-to-prompt (Bagel) | **built** | Task `image-to-text` |
| Workflows CRUD | **built** | `/api/studio/workflows` |
| Canvas (node graph) | **built** | `frontend/src/components/CanvasEditor.tsx` |

---

## Characters — face-lock feature

| Feature | Status | Where |
|---|---|---|
| Character store with `@handle` | **built** | `backend/src/data/collections.ts` |
| Handle normalisation (`@` stripped, `[a-z0-9_]`) | **built** | Same rule |
| `@handle` resolution into a generation | **built** | Picking a character adds its image as reference |
| Likeness reference for video models | **built** | Image-to-video models accept reference images |
| Identity kit (turnaround, full body, spec) | **built** | Built automatically on character creation |
| Character identity screening | **planned** | Moderation endpoint for character uploads |

---

## Accounts

| Feature | Status | Where |
|---|---|---|
| Email sign-in, session token | **built** | Local accounts, scrypt hashes, HS256 JWT |
| Age gate and attestation | **built** | Generation refused until recorded |
| OAuth sign-in | **planned** | Endpoint contract documented |
| Password reset | **planned** | |
| Legal pages (2257, AUP, privacy, terms) | **planned** | Required before serving users |
| Content moderation | **planned** | |
| Takedown and complaints | **planned** | |

---

## Payments

ModelDeck skips the subscription layer: users pay the model provider directly
(fal.ai / OpenAI), so there is no subscription, no credit pack, and no
checkout to build. The credit ledger still exists to make run costs visible.

| Feature | Status | Notes |
|---|---|---|
| Credit ledger and balance | **built** | Every job deducts millicredits |
| Credit pricing (`CREDIT_PRICE_USD`) | **built** | The only markup knob |
| Subscription plans | **excluded** | Not part of this project |
| Credit packs | **excluded** | Not part of this project |
| Checkout flow | **excluded** | Not part of this project |

---

## MCP

| Feature | Status | Where |
|---|---|---|
| MCP server (JSON-RPC 2.0) | **built** | `backend/src/routes/mcp.ts` |
| `list_models` tool | **built** | |
| `list_avatars` tool | **built** | |
| `generate` tool | **built** | |
| `job_status` tool | **built** | |
| `credit_balance` tool | **built** | |
| Personal API keys | **planned** | Session token used today; separate key table next |

---

## Before serving real users

These are not optional:

1. **Age verification with record keeping.** Retain age-verification records.
2. **Consent for likeness.** A character store is a likeness system. Do not let
   anyone create a character from a real person without documented consent.
3. **Labelling of synthetic media.** EU AI Act and several US state laws
   require synthetic media to be labelled.
4. **Moderation before serving.** Reference images and prompts are user
   content — filter them before they reach a provider.
5. **A takedown path.** Someone must be able to remove content and complain
   about it.
6. **Terms and privacy pages.** Required if you serve anyone.
