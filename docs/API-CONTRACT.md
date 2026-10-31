# API contract — ModelDeck

Base URL: `http://127.0.0.1:8787` in development, `/api` prefix in production.

Every route except `GET /api/health` requires
`Authorization: Bearer <token>`.

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name }` | `201 { token, user }` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { token, user }` |
| GET | `/api/auth/me` | — | `200 { user }` |
| POST | `/api/auth/logout` | — | `200 { ok }` |
| POST | `/api/users/age-check` | `{ confirmed: true }` | `200 { user }` |

Passwords need at least 10 characters. A new account starts with 5 credits.
Generation is refused with `403 age_attestation_required` until the age
attestation is recorded.

## Studio

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/studio/models` | — | `200 { models, providers }` |
| POST | `/api/studio/generate` | see below | `202 { jobId }` |
| GET | `/api/studio/status/:jobId` | — | `200 { jobId, status, modelKey, error, output }` |
| GET | `/api/studio/jobs` | — | `200 { jobs }` |
| GET | `/api/studio/library` | — | `200 { assets }` |
| GET | `/api/studio/credits` | — | `200 { balanceMillicredits, balanceCredits }` |
| POST | `/api/studio/uploads` | `{ dataUrl, filename }` | `201 { url, bytes }` |

Generate body:

```json
{
  "modelKey": "flux-2-max",
  "prompt": "a lighthouse at dusk",
  "images": ["https://…/reference.png"],
  "aspectRatio": "16:9",
  "resolution": "2K",
  "duration": "5"
}
```

`images` is required for models that take a reference image. `prompt` is
required for models that take one.

Error codes:

| Status | `error` | Meaning |
|---|---|---|
| 401 | `unauthorized` | No valid session |
| 402 | `insufficient_credits` | Balance below the model's price |
| 403 | `age_attestation_required` | Age not confirmed |
| 404 | `unknown_model` | No such model key |
| 503 | `provider_unavailable` | No provider key on this host |
| 503 | `model_unavailable` | The model needs a direct provider account |

## Characters (the face-lock store)

| Method | Path | Body |
|---|---|---|
| GET | `/api/studio/influencers` | — |
| POST | `/api/studio/influencers` | `{ handle, name, description, image }` |
| PATCH | `/api/studio/influencers/:id` | any subset |
| DELETE | `/api/studio/influencers/:id` | — |

A character is a handle, a name and one reference image URL. The image is the
likeness reference passed to models, which is what keeps a character
recognisable across models. Handles are normalised to lowercase `[a-z0-9_]`
and must be unique per account.

## Workflows

| Method | Path | Body |
|---|---|---|
| GET | `/api/studio/workflows` | — |
| POST | `/api/studio/workflows` | `{ name, modelKey, prompt, settings }` |
| PATCH | `/api/studio/workflows/:id` | any subset |
| DELETE | `/api/studio/workflows/:id` | — |

## Agent

| Method | Path | Body |
|---|---|---|
| GET | `/api/agent/chats` | — |
| POST | `/api/agent/chats` | `{ title }` |
| GET | `/api/agent/chats/:id` | — |
| DELETE | `/api/agent/chats/:id` | — |
| GET | `/api/agent/llms` | — |
| POST | `/api/agent/plan` | `{ chatId, input, llmModel?, autoRun? }` |
| GET | `/api/agent/jobs` | — |
| GET | `/api/agent/jobs/:id` | — |
| POST | `/api/agent/jobs/:id/approve` | `{ model?, duration?, prompt? }` |
| POST | `/api/agent/jobs/:id/stop` | — |
| DELETE | `/api/agent/outputs` | `{ chatId, url }` |
| GET | `/api/agent/skills` | — |
| GET | `/api/agent/memories` | — |
| POST | `/api/agent/memories` | `{ key, value }` |
| DELETE | `/api/agent/memories/:id` | — |
| GET | `/api/agent/connectors` | — |
| GET | `/api/agent/connectors/:provider/start` | — |
| DELETE | `/api/agent/connectors/:provider` | — |
| GET | `/api/agent/schedules` | — |
| POST | `/api/agent/schedules` | `{ expression, input }` |
| POST | `/api/agent/schedules/:id/toggle` | — |
| DELETE | `/api/agent/schedules/:id` | — |

## Canvas

| Method | Path | Body |
|---|---|---|
| GET | `/api/studio/canvases` | — |
| POST | `/api/studio/canvases` | `{ name }` |
| GET | `/api/studio/canvases/:id` | — |
| PATCH | `/api/studio/canvases/:id` | `{ name }` or `{ nodes }` |
| DELETE | `/api/studio/canvases/:id` | — |
| POST | `/api/studio/canvases/:id/run` | `{ nodeId }` |
| GET | `/api/studio/canvases/:id/node/:nodeId` | — |

## MCP

`POST /api/mcp` — JSON-RPC 2.0, same bearer token.

Methods: `initialize`, `notifications/initialized`, `tools/list`,
`tools/call`.

Tools: `list_models`, `list_avatars`, `generate`, `job_status`,
`credit_balance`.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "generate", "arguments": { "modelKey": "flux-2-max", "prompt": "a cat" } }
}
```

## Media

Generated media is copied into this service's own storage and served from
`/media/...`. Provider URLs are short-lived, so nothing depends on them
staying reachable.
