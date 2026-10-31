/**
 * The agent's planner.
 *
 * An LLM turns what the user wrote into a plan: which model, what prompt,
 * how long. When no LLM is configured, or the LLM's answer does not name a
 * usable model, the caller falls back to `fallbackPlan`.
 *
 * The LLM is told about the models that are actually available, so it cannot
 * invent one.
 */

import { MODELS } from "../models/registry.js";
import { AGENT_SKILLS, type AgentPlan } from "./store.js";

export interface PlannerConfig {
  openaiKey?: string | undefined;
  anthropicKey?: string | undefined;
  /** Which LLM to plan with. */
  model?: string | undefined;
}

export interface PlannerInput {
  input: string;
  /** Saved memories, so the agent keeps facts it was told. */
  memories: ReadonlyArray<{ key: string; value: string }>;
  /** The characters the caller has, so @mentions can be resolved. */
  characters: ReadonlyArray<{ handle: string; name: string }>;
}

const AVAILABLE = MODELS.filter((model) => model.available).map((model) => ({
  key: model.key,
  displayName: model.displayName,
  task: model.task,
  acceptsPrompt: model.acceptsPrompt,
  durations: model.durations,
}));

const systemPrompt = `You plan image and video generation jobs for a studio.

Reply with one JSON object and nothing else:
{"kind":"image"|"video","model":"<model key>","prompt":"<the prompt to send>","duration":<seconds or null>,"summary":"<one line>","steps":["<step>","<step>"]}

Rules:
- Pick a model key from the list below. Never invent one.
- kind is "video" when the user asks for a clip, animation or motion; otherwise "image".
- duration is in seconds and must be one the model allows; use null for an image.
- The prompt is what will be sent to the model. Keep the user's wording and any @mentions.
- summary is one short sentence for the user.

Available models:
${JSON.stringify(AVAILABLE)}

Skills:
${JSON.stringify(AGENT_SKILLS.map((skill) => `${skill.name}: ${skill.description}`))}`;

const buildUserPrompt = (input: PlannerInput): string => {
  const lines: string[] = [];
  if (input.memories.length > 0) {
    lines.push("Known facts:");
    for (const memory of input.memories) {
      lines.push(`- ${memory.key}: ${memory.value}`);
    }
    lines.push("");
  }
  if (input.characters.length > 0) {
    lines.push(
      `Saved characters: ${input.characters.map((c) => `@${c.handle} (${c.name})`).join(", ")}`,
      "",
    );
  }
  lines.push(`Request: ${input.input}`);
  return lines.join("\n");
};

const parsePlan = (raw: string): AgentPlan | null => {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(text);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const model = typeof record["model"] === "string" ? record["model"] : "";
  const prompt = typeof record["prompt"] === "string" ? record["prompt"] : "";
  if (!model || !prompt) return null;
  const steps = Array.isArray(record["steps"])
    ? record["steps"]
        .filter((step): step is string => typeof step === "string")
        .map((label, index) => ({
          id: `step-${index + 1}`,
          label,
          status: "pending",
        }))
    : [];
  return {
    kind: record["kind"] === "video" ? "video" : "image",
    model,
    prompt,
    duration:
      record["duration"] === null || record["duration"] === undefined
        ? null
        : String(record["duration"]),
    summary:
      typeof record["summary"] === "string" && record["summary"].length > 0
        ? record["summary"]
        : prompt.split(". ")[0] ?? prompt,
    steps,
  };
};

const planWithOpenAi = async (
  config: PlannerConfig,
  input: PlannerInput,
): Promise<AgentPlan | null> => {
  const model = config.model ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.openaiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `The planner model returned HTTP ${response.status} ${response.statusText}.`,
    );
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  return typeof content === "string" ? parsePlan(content) : null;
};

const planWithAnthropic = async (
  config: PlannerConfig,
  input: PlannerInput,
): Promise<AgentPlan | null> => {
  const model = config.model ?? "claude-sonnet-4-5";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicKey ?? "",
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `The planner model returned HTTP ${response.status} ${response.statusText}.`,
    );
  }
  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  return typeof text === "string" ? parsePlan(text) : null;
};

/**
 * Plan a job. Returns null when no LLM is configured, so the caller can fall
 * back. Throws when an LLM is configured but the call failed — the caller
 * decides whether to fall back or report.
 */
export const planWithLlm = async (
  config: PlannerConfig,
  input: PlannerInput,
): Promise<AgentPlan | null> => {
  if (config.openaiKey) return planWithOpenAi(config, input);
  if (config.anthropicKey) return planWithAnthropic(config, input);
  return null;
};

/** The LLMs the planner can be pointed at. */
export const PLANNER_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" },
];
