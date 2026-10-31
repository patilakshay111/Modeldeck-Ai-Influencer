/**
 * ModelDeck API server.
 *
 * Boot order: configuration → stores → providers → routes → listen.
 * A provider without a key is still registered; it reports itself as
 * unconfigured and the routes refuse work that needs it, rather than the
 * service failing to start.
 */

import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { loadConfig } from "./config.js";
import { loadEnvFile } from "./env.js";
import { UserStore } from "./auth/users.js";
import { JobStore } from "./jobs/store.js";
import { CollectionStore } from "./data/collections.js";
import { CanvasStore } from "./data/canvases.js";
import { TemplateStore } from "./data/templates.js";
import { AgentStore } from "./agent/store.js";
import { LocalStorage } from "./storage/local.js";
import { FalProvider } from "./providers/fal.js";
import { OpenAiProvider } from "./providers/openai.js";
import { MODELS } from "./models/registry.js";
import type { GenerationProvider } from "./providers/types.js";
import { authenticate, registerAuthRoutes } from "./routes/auth.js";
import { registerStudioRoutes } from "./routes/studio.js";
import { registerMcpRoutes } from "./routes/mcp.js";
import { registerCanvasRoutes } from "./routes/canvas.js";
import { registerAgentRoutes } from "./routes/agent.js";
import type { AppContext } from "./context.js";

export const buildApp = async (): Promise<Fastify.FastifyInstance> => {
  // Keys may live in backend/.env. A real environment variable always wins.
  loadEnvFile();
  const config = loadConfig();
  const storageRoot = resolve(process.cwd(), config.STORAGE_DIR);
  const dataRoot = join(storageRoot, "..", "data");
  // The static media root must exist before the plugin registers it.
  mkdirSync(join(storageRoot, "media"), { recursive: true });
  mkdirSync(dataRoot, { recursive: true });

  const providers = new Map<string, GenerationProvider>([
    ["fal", new FalProvider(config.FAL_KEY)],
    ["openai", new OpenAiProvider(config.OPENAI_API_KEY)],
  ]);

  const context: AppContext = {
    config,
    users: new UserStore(join(dataRoot, "users.json")),
    jobs: new JobStore(),
    collections: new CollectionStore(join(dataRoot, "collections.json")),
    canvases: new CanvasStore(join(dataRoot, "canvases.json")),
    templates: new TemplateStore(join(dataRoot, "character-templates.json")),
    agent: new AgentStore(join(dataRoot, "agent.json")),
    storage: new LocalStorage(join(storageRoot, "media"), config.PUBLIC_ORIGIN),
    providers,
    providerFor: (providerId: string) => providers.get(providerId),
  };

  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
      ],
    },
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || context.config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed."), false);
    },
    credentials: true,
  });

  await app.register(fastifyStatic, {
    root: join(storageRoot, "media"),
    prefix: "/media/",
    decorateReply: false,
  });
  app.addHook("onRequest", async (request, reply) => {
    await authenticate(context, request, reply, () => undefined);
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "modeldeck",
    providers: context.config.providers,
    models: publicModelCount(),
  }));

  registerAuthRoutes(app, context);
  registerStudioRoutes(app, context);
  registerCanvasRoutes(app, context);
  registerAgentRoutes(app, context);
  registerMcpRoutes(app, context);

  return app;
};

const publicModelCount = (): number => MODELS.length;

const start = async (): Promise<void> => {
  const app = await buildApp();
  const { HOST, PORT } = loadConfig();
  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info(`ModelDeck API listening on http://${HOST}:${PORT}`);
  } catch (cause) {
    app.log.error(cause);
    process.exit(1);
  }
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  /server\.(ts|js)$/.test(process.argv[1] ?? "");

if (invokedDirectly) {
  void start();
}
