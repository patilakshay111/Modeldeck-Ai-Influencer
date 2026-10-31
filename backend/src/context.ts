/**
 * Shared application context.
 *
 * One context is created at boot and handed to every route module, so a
 * provider, a store and the configuration have exactly one owner.
 */

import type { Config } from "./config.js";
import type { UserStore, User } from "./auth/users.js";
import type { JobStore } from "./jobs/store.js";
import type { CollectionStore } from "./data/collections.js";
import type { CanvasStore } from "./data/canvases.js";
import type { TemplateStore } from "./data/templates.js";
import type { AgentStore } from "./agent/store.js";
import type { LocalStorage } from "./storage/local.js";
import type { GenerationProvider } from "./providers/types.js";

export interface AppContext {
  config: Config;
  users: UserStore;
  jobs: JobStore;
  collections: CollectionStore;
  canvases: CanvasStore;
  templates: TemplateStore;
  agent: AgentStore;
  storage: LocalStorage;
  /** Provider adapter per provider id. */
  providers: Map<string, GenerationProvider>;
  /** Resolve the provider that serves a model. */
  providerFor: (providerId: string) => GenerationProvider | undefined;
}

export type { User };
