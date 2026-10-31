/**
 * Templates and canvases.
 *
 *   GET    /api/studio/templates             the ready-made looks
 *   POST   /api/studio/templates/:id/claim   turn one into a character
 *   GET    /api/studio/canvases              the caller's canvases
 *   POST   /api/studio/canvases              create a canvas
 *   GET    /api/studio/canvases/:id          one canvas
 *   PATCH  /api/studio/canvases/:id          rename, or save its nodes
 *   DELETE /api/studio/canvases/:id          delete a canvas
 *   POST   /api/studio/canvases/:id/run      run one node
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { requireUser } from "./auth.js";
import { findModel } from "../models/registry.js";
import { priceRun } from "../models/pricing.js";
import { resolveNodeReferences, type CanvasNode } from "../data/canvases.js";
import { ProviderError } from "../providers/types.js";

const nodeSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["image", "video", "text"]),
  x: z.number().finite(),
  y: z.number().finite(),
  data: z
    .object({
      model: z.string().max(64).optional(),
      prompt: z.string().max(20_000).optional(),
      aspect: z.string().max(32).optional(),
      quality: z.string().max(32).optional(),
      duration: z.string().max(16).optional(),
      output: z.string().max(2000).optional(),
      outputKind: z.enum(["image", "video"]).optional(),
      sourceNodeIds: z.array(z.string().max(64)).max(8).optional(),
      jobId: z.string().max(64).optional(),
      status: z
        .enum(["idle", "queued", "running", "completed", "failed"])
        .optional(),
      error: z.string().max(2000).nullable().optional(),
      /** Read-only: the reference images this node would send. */
      resolvedReferences: z.array(z.string().max(2000)).max(8).optional(),
    })
    .strict(),
});

export const registerCanvasRoutes = (
  app: FastifyInstance,
  context: AppContext,
): void => {
  // ── Ready-made looks ────────────────────────────────────────────────────

  app.get("/api/studio/templates", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ templates: context.templates.list() });
  });

  app.post("/api/studio/templates/:id/claim", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const template = context.templates.find(id);
    if (!template) {
      return reply.code(404).send({
        error: "not_found",
        message: "No such template.",
      });
    }
    try {
      const influencer = context.collections.createInfluencer(user.id, {
        handle: template.handle,
        name: template.label,
        description: `Ready-made look: ${template.label}.`,
        image: template.src,
      });
      return reply.code(201).send({ influencer });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not claim.";
      return reply.code(409).send({ error: "conflict", message });
    }
  });

  // ── Canvases ────────────────────────────────────────────────────────────

  app.get("/api/studio/canvases", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ canvases: context.canvases.list(user.id) });
  });

  app.post("/api/studio/canvases", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = z
      .object({ name: z.string().max(200).optional() })
      .safeParse(request.body ?? {});
    const canvas = context.canvases.create(user.id, parsed.success ? (parsed.data.name ?? "") : "");
    return reply.code(201).send({ canvas });
  });

  app.get("/api/studio/canvases/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const canvas = context.canvases.find(id, user.id);
    if (!canvas) {
      return reply.code(404).send({ error: "not_found", message: "Unknown canvas." });
    }
    // Each node reports the reference images it would send, so the direction
    // of every wire is visible: a node's references are the outputs of the
    // nodes it is wired to.
    const nodes = canvas.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        resolvedReferences: resolveNodeReferences(canvas, node),
      },
    }));
    return reply.send({ canvas: { ...canvas, nodes } });
  });

  app.patch("/api/studio/canvases/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        name: z.string().max(200).optional(),
        nodes: z.array(nodeSchema).max(200).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return reply.code(400).send({
        error: "invalid_input",
        message: issue
          ? `${issue.path.join(".") || "body"}: ${issue.message}`
          : "Invalid canvas.",
        issues: parsed.error.issues.slice(0, 5),
      });
    }
    try {
      const canvas = context.canvases.update(id, user.id, parsed.data);
      if (!canvas) {
        return reply.code(404).send({ error: "not_found", message: "Unknown canvas." });
      }
      return reply.send({ canvas });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save.";
      return reply.code(400).send({ error: "invalid_input", message });
    }
  });

  app.delete("/api/studio/canvases/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const removed = context.canvases.remove(id, user.id);
    if (!removed) {
      return reply.code(404).send({ error: "not_found", message: "Unknown canvas." });
    }
    return reply.send({ ok: true });
  });

  // ── Running one node ────────────────────────────────────────────────────

  app.post("/api/studio/canvases/:id/run", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ nodeId: z.string().min(1).max(64) })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: "A node id is required." });
    }
    const canvas = context.canvases.find(id, user.id);
    if (!canvas) {
      return reply.code(404).send({ error: "not_found", message: "Unknown canvas." });
    }
    const node = canvas.nodes.find(
      (entry) => entry.id === parsed.data.nodeId,
    );
    if (!node) {
      return reply.code(404).send({ error: "not_found", message: "Unknown node." });
    }
    const modelKey = node.data.model;
    if (!modelKey) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: "This node has no model." });
    }
    const model = findModel(modelKey);
    if (!model) {
      return reply
        .code(404)
        .send({ error: "unknown_model", message: `Unknown model "${modelKey}".` });
    }
    if (!model.available) {
      return reply.code(503).send({
        error: "model_unavailable",
        message:
          model.unavailableReason ??
          `Model "${model.displayName}" is not available on this host.`,
      });
    }
    const provider = context.providerFor(model.provider);
    if (!provider?.configured) {
      return reply.code(503).send({
        error: "provider_unavailable",
        message: `No ${model.provider} provider is configured on this host.`,
      });
    }

    const references = resolveNodeReferences(canvas, node);
    if (model.acceptsReferenceImages && references.length === 0) {
      return reply.code(400).send({
        error: "invalid_input",
        message: `${model.displayName} needs a reference image. Wire an upstream node into this one.`,
      });
    }
    if (model.acceptsPrompt && !node.data.prompt?.trim()) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: `${model.displayName} needs a prompt.` });
    }
    const price = priceRun(model, {
      resolution: node.data.quality,
      durationSeconds: node.data.duration
        ? Number(node.data.duration)
        : undefined,
      edit: references.length > 0,
    });
    if (user.balanceMillicredits < price.millicredits) {
      return reply.code(402).send({
        error: "insufficient_credits",
        message: "Not enough credits for this model.",
        balanceMillicredits: user.balanceMillicredits,
        requiredMillicredits: price.millicredits,
      });
    }

    try {
      const submitted = await provider.submit(model, {
        prompt: node.data.prompt,
        images: references.length > 0 ? references : undefined,
        aspectRatio: node.data.aspect,
        resolution: node.data.quality,
        duration: node.data.duration,
      });
      const job = context.jobs.create({
        userId: user.id,
        modelKey: model.key,
        provider: model.provider,
        providerJobId: submitted.providerJobId,
        prompt: node.data.prompt ?? "",
        referenceImages: references,
        costMillicredits: price.millicredits,
      });
      context.users.addBalance(user.id, -price.millicredits);
      const updated = context.canvases.update(id, user.id, {
        nodes: canvas.nodes.map((entry) =>
          entry.id === node.id
            ? {
                ...entry,
                data: {
                  ...entry.data,
                  jobId: job.id,
                  status: "queued" as const,
                  error: null,
                },
              }
            : entry,
        ),
      });
      return reply.code(202).send({
        jobId: job.id,
        references,
        canvas: updated,
      });
    } catch (cause) {
      if (cause instanceof ProviderError) {
        return reply.code(cause.retryable ? 502 : 400).send({
          error: "provider_error",
          message: cause.message,
        });
      }
      const message =
        cause instanceof Error ? cause.message : "The generation request failed.";
      return reply.code(502).send({ error: "provider_error", message });
    }
  });

  // ── Reading a node's result back ───────────────────────────────────────

  app.get("/api/studio/canvases/:id/node/:nodeId", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id, nodeId } = request.params as { id: string; nodeId: string };
    const canvas = context.canvases.find(id, user.id);
    if (!canvas) {
      return reply.code(404).send({ error: "not_found", message: "Unknown canvas." });
    }
    const node = canvas.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return reply.code(404).send({ error: "not_found", message: "Unknown node." });
    }
    const jobId = node.data.jobId;
    if (!jobId) {
      return reply.send({ node });
    }
    const job = context.jobs.getForUser(jobId, user.id);
    if (!job) {
      return reply.send({ node });
    }
    // Poll the provider once and fold the result into the node.
    const provider = context.providerFor(job.provider);
    const model = findModel(job.modelKey);
    if (provider && model) {
      try {
        const status = await provider.status(model, job.providerJobId);
        if (status.state === "completed") {
          const bundle = await provider.result(model, job.providerJobId);
          const assets = [];
          for (const asset of bundle.assets) {
            assets.push(await context.storage.copyRemote(asset));
          }
          const raw = bundle.raw as {
            kind?: string;
            bytes?: Buffer;
            contentType?: string;
          };
          if (raw?.kind === "openai-video-bytes" && raw.bytes) {
            assets.push(
              await context.storage.saveBytes(
                raw.bytes,
                raw.contentType ?? "video/mp4",
                "sora",
              ),
            );
          }
          context.jobs.update(job.id, { state: "completed", assets });
        } else if (status.state === "failed") {
          context.jobs.update(job.id, {
            state: "failed",
            error: status.error ?? "The provider reported a failure.",
          });
        }
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "The provider call failed.";
        context.jobs.update(job.id, { state: "failed", error: message });
      }
    }
    const current = context.jobs.get(job.id)!;
    const updated = context.canvases.update(id, user.id, {
      nodes: canvas.nodes.map((entry) =>
        entry.id === nodeId
          ? {
              ...entry,
              data: {
                ...entry.data,
                status: current.state,
                error: current.error,
                output: current.assets[0]?.url ?? entry.data.output,
                outputKind: current.assets[0]?.isVideo ? "video" : "image",
              },
            }
          : entry,
      ),
    });
    return reply.send({ node: updated?.nodes.find((entry) => entry.id === nodeId) });
  });
};
