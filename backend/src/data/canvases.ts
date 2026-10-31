/**
 * Canvases.
 *
 * A canvas is a saved node graph. Each node is one generation step: what to
 * make, with which model, and — when it has run — what came out. A node can
 * take its reference images from another node's output, which is how a
 * canvas chains a character into a scene.
 *
 * The shape follows a workflow where a canvas is a workflow
 * whose `nodes` each carry a `data` object with a `kind` and an `output`.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CanvasNodeKind = "image" | "video" | "text";
export type CanvasNodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface CanvasNodeData {
  /** Model key from the registry. */
  model?: string;
  prompt?: string;
  aspect?: string;
  quality?: string;
  duration?: string;
  /** Media URL produced by the last run. */
  output?: string;
  outputKind?: "image" | "video";
  /** Nodes whose output feeds this one. */
  sourceNodeIds?: string[];
  /** Job id of the last run, for polling. */
  jobId?: string;
  status?: CanvasNodeStatus;
  error?: string | null;
}

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  /** Position on the canvas surface, in pixels. */
  x: number;
  y: number;
  data: CanvasNodeData;
}

export interface Canvas {
  id: string;
  ownerId: string;
  name: string;
  nodes: CanvasNode[];
  createdAt: number;
  updatedAt: number;
}

interface CanvasFile {
  version: 1;
  canvases: Canvas[];
}

const MAX_NODES = 200;

export class CanvasStore {
  private readonly path: string;
  private file: CanvasFile;

  constructor(path: string) {
    this.path = path;
    try {
      this.file = JSON.parse(readFileSync(path, "utf8")) as CanvasFile;
    } catch {
      this.file = { version: 1, canvases: [] };
    }
    if (!Array.isArray(this.file.canvases)) this.file.canvases = [];
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.file, null, 1), "utf8");
  }

  list(ownerId: string): Canvas[] {
    return this.file.canvases
      .filter((canvas) => canvas.ownerId === ownerId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  find(id: string, ownerId: string): Canvas | undefined {
    return this.file.canvases.find(
      (canvas) => canvas.id === id && canvas.ownerId === ownerId,
    );
  }

  create(ownerId: string, name: string): Canvas {
    const now = Date.now();
    const canvas: Canvas = {
      id: `cvs_${randomBytes(10).toString("hex")}`,
      ownerId,
      name: name.trim() || "Untitled canvas",
      nodes: [],
      createdAt: now,
      updatedAt: now,
    };
    this.file.canvases.push(canvas);
    this.persist();
    return canvas;
  }

  update(
    id: string,
    ownerId: string,
    patch: Partial<Pick<Canvas, "name" | "nodes">>,
  ): Canvas | undefined {
    const canvas = this.find(id, ownerId);
    if (!canvas) return undefined;
    if (patch.name !== undefined) canvas.name = patch.name.trim() || canvas.name;
    if (patch.nodes !== undefined) {
      if (patch.nodes.length > MAX_NODES) {
        throw new Error(`A canvas holds at most ${MAX_NODES} nodes.`);
      }
      canvas.nodes = patch.nodes;
    }
    canvas.updatedAt = Date.now();
    this.persist();
    return canvas;
  }

  remove(id: string, ownerId: string): boolean {
    const index = this.file.canvases.findIndex(
      (canvas) => canvas.id === id && canvas.ownerId === ownerId,
    );
    if (index < 0) return false;
    this.file.canvases.splice(index, 1);
    this.persist();
    return true;
  }
}

/**
 * The reference images a node should send: the outputs of the nodes it is
 * wired to, in the order those nodes are wired.
 */
export const resolveNodeReferences = (
  canvas: Canvas,
  node: CanvasNode,
): string[] => {
  const byId = new Map(canvas.nodes.map((entry) => [entry.id, entry]));
  const urls: string[] = [];
  for (const sourceId of node.data.sourceNodeIds ?? []) {
    const source = byId.get(sourceId);
    const output = source?.data.output;
    if (typeof output === "string" && output.length > 0 && !urls.includes(output)) {
      urls.push(output);
    }
  }
  return urls;
};
