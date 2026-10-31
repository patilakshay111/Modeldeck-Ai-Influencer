/**
 * MCP endpoint.
 *
 *   POST /api/mcp
 *
 * A JSON-RPC 2.0 endpoint speaking the Model Context Protocol, so Claude,
 * Cursor or any MCP client can drive ModelDeck from a normal conversation:
 * list the catalogue, start a generation, check a job, list the caller's
 * characters, and check the credit balance.
 *
 * The endpoint uses the same session token as the rest of the API, sent as a
 * bearer token. There is no separate MCP credential.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { findModel, publicCatalogue } from "../models/registry.js";
import { priceRun } from "../models/pricing.js";
import { requireUser } from "./auth.js";
import { ProviderError } from "../providers/types.js";

const PROTOCOL_VERSION = "2025-06-18";

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: McpTool[] = [
  {
    name: "list_models",
    description:
      "List every image, video, upscale and understanding model available, with its cost and accepted inputs.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_avatars",
    description:
      "List the caller's saved characters (influencers). Use one as the reference image for a consistent character.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "generate",
    description:
      "Start a generation. Returns a job id immediately; poll job_status for the result.",
    inputSchema: {
      type: "object",
      properties: {
        modelKey: { type: "string", description: "Model key from list_models." },
        prompt: { type: "string" },
        images: {
          type: "array",
          items: { type: "string" },
          description: "Reference image URLs (for character consistency).",
        },
        aspectRatio: { type: "string" },
        duration: { type: "string" },
      },
      required: ["modelKey"],
      additionalProperties: false,
    },
  },
  {
    name: "job_status",
    description: "Report the state and output of a generation job.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" } },
      required: ["jobId"],
      additionalProperties: false,
    },
  },
  {
    name: "credit_balance",
    description: "Report the caller's remaining credit balance.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const textResult = (value: unknown): { content: Array<{ type: "text"; text: string }> } => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 1) }],
});

const generateInput = z.object({
  modelKey: z.string().min(1),
  prompt: z.string().max(20_000).optional(),
  images: z.array(z.string().url()).max(8).optional(),
  aspectRatio: z.string().max(32).optional(),
  duration: z.string().max(16).optional(),
});

export const registerMcpRoutes = (app: FastifyInstance, context: AppContext): void => {
  app.post("/api/mcp", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;

    const body = request.body as {
      jsonrpc?: string;
      id?: string | number | null;
      method?: string;
      params?: Record<string, unknown>;
    };
    if (body?.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return reply.code(400).send({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid JSON-RPC request." },
        id: body?.id ?? null,
      });
    }
    const id = body.id ?? null;

    switch (body.method) {
      case "initialize":
        return reply.send({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "modeldeck", version: "0.1.0" },
          },
        });

      case "notifications/initialized":
        return reply.code(202).send();

      case "tools/list":
        return reply.send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });

      case "tools/call": {
        const name = body.params?.["name"];
        const args = (body.params?.["arguments"] ?? {}) as Record<string, unknown>;
        try {
          if (name === "list_models") {
            return reply.send({
              jsonrpc: "2.0",
              id,
              result: textResult({ models: publicCatalogue() }),
            });
          }
          if (name === "list_avatars") {
            return reply.send({
              jsonrpc: "2.0",
              id,
              result: textResult({
                influencers: context.collections.listInfluencers(user.id),
              }),
            });
          }
          if (name === "credit_balance") {
            return reply.send({
              jsonrpc: "2.0",
              id,
              result: textResult({
                balanceMillicredits: user.balanceMillicredits,
                balanceCredits: user.balanceMillicredits / 1000,
              }),
            });
          }
          if (name === "job_status") {
            const jobId = String(args["jobId"] ?? "");
            const job = context.jobs.getForUser(jobId, user.id);
            if (!job) {
              return reply.send({
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: "Unknown job." },
              });
            }
            return reply.send({
              jsonrpc: "2.0",
              id,
              result: textResult({
                jobId: job.id,
                status: job.state,
                modelKey: job.modelKey,
                error: job.error,
                output: job.assets,
              }),
            });
          }
          if (name === "generate") {
            const parsed = generateInput.safeParse(args);
            if (!parsed.success) {
              return reply.send({
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: parsed.error.issues[0]?.message },
              });
            }
            const model = findModel(parsed.data.modelKey);
            if (!model) {
              return reply.send({
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: "Unknown model." },
              });
            }
            const provider = context.providerFor(model.provider);
            if (!provider?.configured) {
              return reply.send({
                jsonrpc: "2.0",
                id,
                error: { code: -32000, message: `${model.provider} is not configured.` },
              });
            }
            const price = priceRun(model, {
              durationSeconds: parsed.data.duration
                ? Number(parsed.data.duration)
                : undefined,
              edit: (parsed.data.images?.length ?? 0) > 0,
            });
            const submitted = await provider.submit(model, {
              prompt: parsed.data.prompt,
              images: parsed.data.images,
              aspectRatio: parsed.data.aspectRatio,
              duration: parsed.data.duration,
            });
            const job = context.jobs.create({
              userId: user.id,
              modelKey: model.key,
              provider: model.provider,
              providerJobId: submitted.providerJobId,
              prompt: parsed.data.prompt ?? "",
              referenceImages: parsed.data.images ?? [],
              costMillicredits: price.millicredits,
            });
            context.users.addBalance(user.id, -price.millicredits);
            return reply.send({
              jsonrpc: "2.0",
              id,
              result: textResult({ jobId: job.id, status: job.state }),
            });
          }
          return reply.send({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Unknown tool "${String(name)}".` },
          });
        } catch (cause) {
          const message =
            cause instanceof ProviderError || cause instanceof Error
              ? cause.message
              : "The tool call failed.";
          return reply.send({
            jsonrpc: "2.0",
            id,
            error: { code: -32000, message },
          });
        }
      }

      default:
        return reply.send({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown method "${body.method}".` },
        });
    }
  });
};
