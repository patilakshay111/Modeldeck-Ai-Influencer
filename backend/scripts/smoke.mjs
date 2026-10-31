/**
 * ModelDeck API smoke test.
 *
 * Exercises every route the service publishes, in order, against a running
 * backend. It is a real HTTP client test — not a unit test of internals.
 *
 *   node scripts/smoke.mjs [baseUrl]
 */

const base = process.argv[2] ?? "http://127.0.0.1:8787";
let token = null;
let passed = 0;
let failed = 0;

const call = async (path, init = {}) => {
  const headers = new Headers(init.headers ?? {});
  headers.set("accept", "application/json");
  // A caller may pass either `json` (serialized here) or a raw `body`.
  const body = init.json !== undefined ? init.json : init.body;
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : null;
  return { status: response.status, payload };
};

const check = (name, condition, detail = "") => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name} ${detail}`);
  }
};

/**
 * A run may legitimately end in three ways: it started, no provider key is
 * configured, or the provider refused — a locked account, an exhausted
 * balance, a bad request. The last one is the provider's own answer and must
 * reach the caller rather than being swallowed.
 */
const providerOutcome = (status, payload) =>
  status === 202 ||
  (status === 503 && payload?.error === "provider_unavailable") ||
  (status === 502 && payload?.error === "provider_error");

console.log(`ModelDeck smoke test against ${base}\n`);

// ── Health ────────────────────────────────────────────────────────────────
{
  const { status, payload } = await call("/api/health");
  check("health returns ok", status === 200 && payload.ok === true, JSON.stringify(payload));
  check("catalogue is not empty", (payload.models ?? 0) > 0, `models=${payload.models}`);
}

// ── Unauthenticated access is refused ─────────────────────────────────────
{
  const { status } = await call("/api/studio/models");
  check("studio requires a session", status === 401, `status=${status}`);
}

// ── Registration and session ──────────────────────────────────────────────
const email = `smoke-${Date.now()}@modeldeck.test`;
const password = "modeldeck-smoke-pass-1";
{
  const { status, payload } = await call("/api/auth/register", {
    method: "POST",
    body: { email, password, name: "Smoke" },
  });
  check("register succeeds", status === 201 && typeof payload.token === "string", JSON.stringify(payload));
  token = payload.token;
}
{
  const { status, payload } = await call("/api/auth/me");
  check("session resolves the user", status === 200 && payload.user.email === email, JSON.stringify(payload));
}
{
  const { status } = await call("/api/auth/register", {
    method: "POST",
    body: { email, password, name: "Smoke" },
  });
  check("duplicate registration is refused", status === 409, `status=${status}`);
}
{
  const { status } = await call("/api/auth/login", {
    method: "POST",
    body: { email, password, password: "wrong-password-here" },
  });
  check("bad password is refused", status === 401, `status=${status}`);
}

// ── Age attestation gates generation ──────────────────────────────────────
{
  const { status, payload } = await call("/api/studio/generate", {
    method: "POST",
    body: { modelKey: "flux-2-max", prompt: "a test image" },
  });
  check("generation needs an age attestation", status === 403, `status=${status} ${JSON.stringify(payload)}`);
}
{
  const { status } = await call("/api/users/age-check", { method: "POST", body: { confirmed: true } });
  check("age attestation is recorded", status === 200, `status=${status}`);
}

// ── Catalogue and credits ────────────────────────────────────────────────
{
  const { status, payload } = await call("/api/studio/models");
  check("catalogue is returned", status === 200 && payload.models.length > 0, `status=${status}`);
  const keys = new Set(payload.models.map((m) => m.key));
  check("catalogue has no duplicate keys", keys.size === payload.models.length);
  check(
    "catalogue exposes no provider internals",
    payload.models.every((m) => !("upstreamId" in m) && !("provider" in m)),
  );
}
{
  const { status, payload } = await call("/api/studio/credits");
  check(
    "credit balance is returned",
    status === 200 && payload.balanceCredits === 500,
    JSON.stringify(payload),
  );
}

// ── Unknown model ─────────────────────────────────────────────────────────
{
  const { status } = await call("/api/studio/generate", {
    method: "POST",
    body: { modelKey: "no-such-model", prompt: "x" },
  });
  check("unknown model is refused", status === 404, `status=${status}`);
}

// ── Influencers ───────────────────────────────────────────────────────────
let influencerId = null;
{
  const { status, payload } = await call("/api/studio/influencers", {
    method: "POST",
    body: {
      handle: "gavi",
      name: "Gavi",
      description: "test character",
      image: "https://example.test/gavi.png",
    },
  });
  check("influencer is created", status === 201 && payload.influencer.handle === "gavi", JSON.stringify(payload));
  influencerId = payload.influencer?.id ?? null;
}
{
  const { status } = await call("/api/studio/influencers", {
    method: "POST",
    body: { handle: "gavi", image: "https://example.test/gavi.png" },
  });
  check("duplicate handle is refused", status === 409, `status=${status}`);
}
{
  const { status, payload } = await call("/api/studio/influencers");
  check("influencers are listed", status === 200 && payload.influencers.length === 1, JSON.stringify(payload));
}
{
  const { status } = await call(`/api/studio/influencers/${influencerId}`, { method: "DELETE" });
  check("influencer is deleted", status === 200, `status=${status}`);
}

// ── Workflows ─────────────────────────────────────────────────────────────
let workflowId = null;
{
  const { status, payload } = await call("/api/studio/workflows", {
    method: "POST",
    body: { name: "test", modelKey: "flux-2-max", prompt: "a cat", settings: { aspectRatio: "1:1" } },
  });
  check("workflow is created", status === 201, JSON.stringify(payload));
  workflowId = payload.workflow?.id ?? null;
}
{
  const { status } = await call(`/api/studio/workflows/${workflowId}`, { method: "DELETE" });
  check("workflow is deleted", status === 200, `status=${status}`);
}

// ── Generation ────────────────────────────────────────────────────────────
{
  const { status, payload } = await call("/api/studio/generate", {
    method: "POST",
    body: { modelKey: "flux-2-max", prompt: "a test image" },
  });
  check(
    "generate either starts or reports the provider's answer",
    providerOutcome(status, payload),
    `status=${status} ${JSON.stringify(payload)}`,
  );
}

// ── MCP ───────────────────────────────────────────────────────────────────
{
  const { status, payload } = await call("/api/mcp", {
    method: "POST",
    body: { jsonrpc: "2.0", id: 1, method: "initialize" },
  });
  check("mcp initialize responds", status === 200 && payload.result?.serverInfo?.name === "modeldeck", JSON.stringify(payload));
}
{
  const { status, payload } = await call("/api/mcp", {
    method: "POST",
    body: { jsonrpc: "2.0", id: 2, method: "tools/list" },
  });
  const names = (payload?.result?.tools ?? []).map((t) => t.name);
  check("mcp lists its tools", status === 200 && names.includes("generate"), JSON.stringify(names));
}
{
  const { status, payload } = await call("/api/mcp", {
    method: "POST",
    body: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_models" } },
  });
  const text = payload?.result?.content?.[0]?.text ?? "";
  check("mcp list_models returns the catalogue", status === 200 && text.includes("models"), text.slice(0, 200));
}
{
  const { status, payload } = await call("/api/mcp", {
    method: "POST",
    body: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "credit_balance" } },
  });
  const text = payload?.result?.content?.[0]?.text ?? "";
  check("mcp credit_balance reports the balance", status === 200 && text.includes("balanceCredits"), text.slice(0, 200));
}
{
  const { status } = await call("/api/mcp", { method: "POST", body: { jsonrpc: "1.0", id: 5, method: "x" } });
  check("mcp rejects a bad JSON-RPC request", status === 400, `status=${status}`);
}

// ── Library ───────────────────────────────────────────────────────────────
{
  const { status, payload } = await call("/api/studio/library");
  check("library is returned", status === 200 && Array.isArray(payload.assets), JSON.stringify(payload));
}

// ── Ready-made looks ──────────────────────────────────────────────────────
{
  const { status, payload } = await call("/api/studio/templates");
  check("templates are returned", status === 200 && payload.templates.length > 0, `status=${status}`);
  check(
    "every template has a name, a handle and an image",
    payload.templates.every(
      (t) => t.label && t.handle && t.src && t.src.startsWith("http"),
    ),
  );
  globalThis.__template = payload.templates[0];
}
{
  const template = globalThis.__template;
  const { status, payload } = await call(
    `/api/studio/templates/${template.id}/claim`,
    { method: "POST", json: {} },
  );
  check(
    "a template can be claimed as a character",
    status === 201 && payload.influencer.handle === template.handle,
    JSON.stringify(payload),
  );
  globalThis.__claimedId = payload.influencer?.id ?? null;
}
{
  const { status } = await call(
    `/api/studio/templates/${globalThis.__template.id}/claim`,
    { method: "POST", json: {} },
  );
  check("claiming the same template twice is refused", status === 409, `status=${status}`);
}
{
  const { status } = await call("/api/studio/templates/tpl_nope/claim", {
    method: "POST",
    json: {},
  });
  check("claiming an unknown template is refused", status === 404, `status=${status}`);
}

// ── Canvases ──────────────────────────────────────────────────────────────
let canvasId = null;
{
  const { status, payload } = await call("/api/studio/canvases", {
    method: "POST",
    json: { name: "Smoke canvas" },
  });
  check("a canvas is created", status === 201 && typeof payload.canvas.id === "string", JSON.stringify(payload));
  canvasId = payload.canvas?.id ?? null;
}
{
  const node = {
    id: "nd_1",
    kind: "image",
    x: 120,
    y: 140,
    data: {
      model: "flux-2-max",
      prompt: "a lighthouse at dusk",
      aspect: "1:1",
      quality: "1K",
      sourceNodeIds: [],
    },
  };
  const { status, payload } = await call(`/api/studio/canvases/${canvasId}`, {
    method: "PATCH",
    json: { nodes: [node] },
  });
  check("canvas nodes are saved", status === 200 && payload.canvas.nodes.length === 1, JSON.stringify(payload));
}
{
  const { status, payload } = await call(`/api/studio/canvases/${canvasId}/run`, {
    method: "POST",
    json: { nodeId: "nd_1" },
  });
  check(
    "running a node either starts or reports the provider's answer",
    providerOutcome(status, payload),
    `status=${status} ${JSON.stringify(payload)}`,
  );
}
{
  const { status, payload } = await call(`/api/studio/canvases/${canvasId}/node/nd_1`);
  check("a node's state is readable", status === 200 && payload.node?.id === "nd_1", JSON.stringify(payload));
}

// ── The wire direction ───────────────────────────────────────────────────
// A node wired to another node consumes that node's output. The API reports
// the reference images each node would send, so the direction is checkable
// rather than assumed.
{
  const a = "nd_src";
  const b = "nd_dst";
  const nodes = [
    {
      id: a,
      kind: "image",
      x: 0,
      y: 0,
      data: {
        model: "flux-2-max",
        prompt: "a face",
        aspect: "1:1",
        quality: "1K",
        output: "https://example.test/a.png",
        sourceNodeIds: [],
        status: "completed",
        error: null,
      },
    },
    {
      id: b,
      kind: "video",
      x: 0,
      y: 0,
      data: {
        model: "kling-3.0",
        prompt: "she moves",
        aspect: "16:9",
        quality: "720p",
        sourceNodeIds: [a],
        status: "idle",
        error: null,
      },
    },
  ];
  const saved = await call(`/api/studio/canvases/${canvasId}`, {
    method: "PATCH",
    json: { nodes },
  });
  check(
    "two nodes with a wire are saved",
    saved.status === 200 && saved.payload.canvas.nodes.length === 2,
    JSON.stringify(saved.payload),
  );
  const read = await call(`/api/studio/canvases/${canvasId}`);
  const byId = new Map(
    (read.payload.canvas?.nodes ?? []).map((n) => [n.id, n]),
  );
  check(
    "the source node has no references",
    (byId.get(a)?.data?.resolvedReferences ?? []).length === 0,
    JSON.stringify(byId.get(a)?.data),
  );
  check(
    "the wired node consumes the source output",
    (byId.get(b)?.data?.resolvedReferences ?? []).includes(
      "https://example.test/a.png",
    ),
    JSON.stringify(byId.get(b)?.data),
  );
}
{
  const { status, payload } = await call("/api/studio/canvases");
  check("canvases are listed", status === 200 && payload.canvases.length >= 1, JSON.stringify(payload));
}
{
  // Rename, and confirm the new name persists.
  const renamed = await call(`/api/studio/canvases/${canvasId}`, {
    method: "PATCH",
    json: { name: "Renamed canvas" },
  });
  check(
    "a canvas can be renamed",
    renamed.status === 200 && renamed.payload.canvas.name === "Renamed canvas",
    JSON.stringify(renamed.payload),
  );
  const read = await call(`/api/studio/canvases/${canvasId}`);
  check(
    "the new name persists",
    read.payload.canvas?.name === "Renamed canvas",
    JSON.stringify(read.payload),
  );
  const listed = await call("/api/studio/canvases");
  check(
    "the new name appears in the list",
    (listed.payload.canvases ?? []).some((c) => c.name === "Renamed canvas"),
    JSON.stringify(listed.payload),
  );
}
{
  const { status } = await call(`/api/studio/canvases/${canvasId}`, { method: "DELETE" });
  check("a canvas is deleted", status === 200, `status=${status}`);
}

// ── Agent ────────────────────────────────────────────────────────────────
let agentChatId = null;
{
  const { status, payload } = await call("/api/agent/chats", {
    method: "POST",
    json: { title: "Smoke chat" },
  });
  check("an agent chat is created", status === 201 && !!payload.chat?.id, JSON.stringify(payload));
  agentChatId = payload.chat?.id ?? null;
}
{
  const { status, payload } = await call("/api/agent/chats");
  check("agent chats are listed", status === 200 && payload.chats.length >= 1, JSON.stringify(payload));
}
{
  const { status, payload } = await call("/api/agent/llms");
  check("the planner list is returned", status === 200 && Array.isArray(payload.models), JSON.stringify(payload));
}
{
  const { status, payload } = await call("/api/agent/skills");
  check("agent skills are listed", status === 200 && payload.skills.length > 0, JSON.stringify(payload));
}
{
  // Plan a job. Without a planner key the deterministic fallback is used.
  const { status, payload } = await call("/api/agent/plan", {
    method: "POST",
    json: { chatId: agentChatId, input: "a lighthouse at dusk, cinematic" },
  });
  check(
    "a job is planned",
    status === 201 && !!payload.job?.plan?.model,
    JSON.stringify(payload),
  );
  check(
    "the plan names a model this service has",
    (payload.job?.plan?.model ?? "") !== "",
    String(payload.job?.plan?.model),
  );
  check(
    "the plan waits for approval",
    payload.job?.status === "awaiting_approval",
    String(payload.job?.status),
  );
  globalThis.__agentJobId = payload.job?.id ?? null;
}
{
  const { status, payload } = await call(
    `/api/agent/jobs/${globalThis.__agentJobId}`,
  );
  check("an agent job is readable", status === 200 && payload.job?.id === globalThis.__agentJobId, JSON.stringify(payload));
}
{
  // Approving without a provider key must fail the job, not crash the service.
  const { status } = await call(
    `/api/agent/jobs/${globalThis.__agentJobId}/approve`,
    { method: "POST", json: {} },
  );
  check("approving a job is accepted", status === 200, `status=${status}`);
  const { payload } = await call(`/api/agent/jobs/${globalThis.__agentJobId}`);
  check(
    "the job reports the missing provider",
    payload.job?.status === "failed" || payload.job?.status === "running",
    JSON.stringify(payload.job),
  );
}
{
  const { status, payload } = await call("/api/agent/memories", {
    method: "POST",
    json: { key: "brand", value: "warm lighting" },
  });
  check("a memory is saved", status === 201 && payload.memory?.key === "brand", JSON.stringify(payload));
}
{
  const { status, payload } = await call("/api/agent/memories");
  check("memories are listed", status === 200 && payload.memories.length >= 1, JSON.stringify(payload));
}
{
  const { status, payload } = await call("/api/agent/schedules", {
    method: "POST",
    json: { expression: "0 9 * * *", input: "a portrait" },
  });
  check("a schedule is created", status === 201 && !!payload.schedule?.id, JSON.stringify(payload));
}
{
  const { status, payload } = await call("/api/agent/schedules");
  check("schedules are listed", status === 200 && payload.schedules.length >= 1, JSON.stringify(payload));
}
{
  const { status } = await call(`/api/agent/chats/${agentChatId}`, { method: "DELETE" });
  check("an agent chat is deleted", status === 200, `status=${status}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
