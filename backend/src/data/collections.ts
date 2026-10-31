/**
 * User-owned collections: influencers (the face-lock character store) and
 * workflows (saved generation recipes).
 *
 * An influencer is now an **identity kit**: one face anchor plus generated
 * turnaround and full-body references, a written spec, and a version number.
 * The kit is what keeps the same face and body recognisable across models,
 * shots and years. `image` is kept as the primary anchor for backward
 * compatibility; `references` holds the full kit.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface CharacterReference {
  /** Absolute URL of the reference image. */
  url: string;
  /** What this image represents in the kit. */
  role:
    | "anchor"
    | "turnaround-front"
    | "turnaround-3-quarter-left"
    | "turnaround-3-quarter-right"
    | "turnaround-profile-left"
    | "turnaround-profile-right"
    | "turnaround-back"
    | "full-body-front"
    | "full-body-side";
  /** Where the image came from. */
  source: "upload" | "generated-multiple-angles" | "generated-full-body";
}

export interface InfluencerKitJob {
  modelKey: string;
  providerJobId: string;
  role: string;
}

export interface Influencer {
  id: string;
  /** The account that owns this character. */
  ownerId: string;
  /** Lowercase handle without the leading "@". */
  handle: string;
  name: string;
  description: string;
  /** Primary face anchor (backward compatibility). */
  image: string;
  /** Full identity kit: anchor + turnaround + full body references. */
  references: CharacterReference[];
  /** AI-written prompt fragment describing the character. Appended to every prompt. */
  spec: string;
  /** Bumped whenever the kit changes, so generations re-pin the right look. */
  version: number;
  /** kit building state. */
  kitStatus: "none" | "building" | "ready" | "failed";
  /** In-flight kit generation jobs, keyed by model. */
  kitJobs: InfluencerKitJob[];
  createdAt: number;
}

export interface Workflow {
  id: string;
  /** The account that owns this workflow. */
  ownerId: string;
  name: string;
  modelKey: string;
  prompt: string;
  /** Model settings such as aspect ratio, resolution and duration. */
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface CollectionFile {
  version: 1;
  influencers: Influencer[];
  workflows: Workflow[];
}

export const normalizeHandle = (value: string): string =>
  String(value ?? "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

export class CollectionStore {
  private readonly path: string;
  private file: CollectionFile;

  constructor(path: string) {
    this.path = path;
    try {
      this.file = JSON.parse(readFileSync(path, "utf8")) as CollectionFile;
    } catch {
      this.file = { version: 1, influencers: [], workflows: [] };
    }
    if (!Array.isArray(this.file.influencers)) this.file.influencers = [];
    if (!Array.isArray(this.file.workflows)) this.file.workflows = [];
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.file, null, 1), "utf8");
  }

  // ── Influencers ───────────────────────────────────────────────────────────

  listInfluencers(userId: string): Influencer[] {
    return this.file.influencers
      .filter((item) => item.ownerId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  createInfluencer(
    userId: string,
    input: {
      handle: string;
      name: string;
      description: string;
      image: string;
      kitStatus?: Influencer["kitStatus"];
      references?: CharacterReference[];
      spec?: string;
      kitJobs?: InfluencerKitJob[];
    },
  ): Influencer {
    const handle = normalizeHandle(input.handle);
    if (!handle) throw new Error("A handle is required.");
    const clash = this.file.influencers.find(
      (item) => item.ownerId === userId && item.handle === handle,
    );
    if (clash) throw new Error(`@${handle} already exists.`);
    const influencer: Influencer = {
      id: `inf_${randomBytes(10).toString("hex")}`,
      ownerId: userId,
      handle,
      name: input.name.trim() || handle,
      description: input.description.trim(),
      image: input.image,
      references: input.references ?? [
        { url: input.image, role: "anchor", source: "upload" },
      ],
      spec: input.spec ?? "",
      version: 1,
      kitStatus: input.kitStatus ?? "none",
      kitJobs: input.kitJobs ?? [],
      createdAt: Date.now(),
    };
    this.file.influencers.push(influencer);
    this.persist();
    return influencer;
  }

  updateInfluencer(
    userId: string,
    id: string,
    patch: Partial<Omit<Influencer, "id" | "createdAt">>,
  ): Influencer | undefined {
    const item = this.file.influencers.find(
      (entry) => entry.id === id && entry.ownerId === userId,
    );
    if (!item) return undefined;
    if (patch.handle !== undefined) {
      const handle = normalizeHandle(patch.handle);
      if (!handle) throw new Error("A handle is required.");
      item.handle = handle;
    }
    if (patch.name !== undefined) item.name = patch.name;
    if (patch.description !== undefined) item.description = patch.description;
    if (patch.image !== undefined) item.image = patch.image;
    if (patch.references !== undefined) item.references = patch.references;
    if (patch.spec !== undefined) item.spec = patch.spec;
    if (patch.version !== undefined) item.version = patch.version;
    if (patch.kitStatus !== undefined) item.kitStatus = patch.kitStatus;
    if (patch.kitJobs !== undefined) item.kitJobs = patch.kitJobs;
    this.persist();
    return item;
  }

  /** Replace the whole kit (references + spec) and bump the version. */
  applyKit(
    userId: string,
    id: string,
    input: {
      references: CharacterReference[];
      spec: string;
    },
  ): Influencer | undefined {
    const item = this.file.influencers.find(
      (entry) => entry.id === id && entry.ownerId === userId,
    );
    if (!item) return undefined;
    item.references = input.references;
    item.spec = input.spec.trim();
    item.version = item.version + 1;
    item.kitStatus = "ready";
    item.kitJobs = [];
    this.persist();
    return item;
  }

  deleteInfluencer(userId: string, id: string): boolean {
    const index = this.file.influencers.findIndex(
      (entry) => entry.id === id && entry.ownerId === userId,
    );
    if (index < 0) return false;
    this.file.influencers.splice(index, 1);
    this.persist();
    return true;
  }

  // ── Workflows ─────────────────────────────────────────────────────────────

  listWorkflows(userId: string): Workflow[] {
    return this.file.workflows
      .filter((item) => item.ownerId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  createWorkflow(
    userId: string,
    input: {
      name: string;
      modelKey: string;
      prompt: string;
      settings: Record<string, unknown>;
    },
  ): Workflow {
    const now = Date.now();
    const workflow: Workflow = {
      id: `wfl_${randomBytes(10).toString("hex")}`,
      ownerId: userId,
      name: input.name.trim() || "Untitled workflow",
      modelKey: input.modelKey,
      prompt: input.prompt,
      settings: input.settings ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.file.workflows.push(workflow);
    this.persist();
    return workflow;
  }

  updateWorkflow(
    userId: string,
    id: string,
    patch: Partial<Omit<Workflow, "id" | "createdAt">>,
  ): Workflow | undefined {
    const item = this.file.workflows.find(
      (entry) => entry.id === id && entry.ownerId === userId,
    );
    if (!item) return undefined;
    if (patch.name !== undefined) item.name = patch.name;
    if (patch.modelKey !== undefined) item.modelKey = patch.modelKey;
    if (patch.prompt !== undefined) item.prompt = patch.prompt;
    if (patch.settings !== undefined) item.settings = patch.settings;
    item.updatedAt = Date.now();
    this.persist();
    return item;
  }

  deleteWorkflow(userId: string, id: string): boolean {
    const index = this.file.workflows.findIndex(
      (entry) => entry.id === id && entry.ownerId === userId,
    );
    if (index < 0) return false;
    this.file.workflows.splice(index, 1);
    this.persist();
    return true;
  }
}
