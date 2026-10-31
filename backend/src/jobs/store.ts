/**
 * Generation jobs.
 *
 * The studio contract is deliberately the same shape the reference
 * application's backend uses, because that is what its client expects:
 *
 *   POST /studio/generate   → { jobId }
 *   GET  /studio/status/:id → { status, output }
 *
 * A job is a thin local record over a provider job id. The provider remains
 * the owner of the work; this store owns the mapping from a job id a caller
 * holds to the provider job that is actually running.
 */

import { randomBytes } from "node:crypto";
import type { ProviderId } from "../models/registry.js";
import type { GeneratedAsset, JobState } from "../providers/types.js";

export interface Job {
  id: string;
  userId: string;
  modelKey: string;
  provider: ProviderId;
  providerJobId: string;
  state: JobState;
  prompt: string;
  referenceImages: string[];
  createdAt: number;
  updatedAt: number;
  assets: GeneratedAsset[];
  error: string | null;
  /** Millicredits charged for this job. */
  costMillicredits: number;
}

export interface NewJob {
  userId: string;
  modelKey: string;
  provider: ProviderId;
  providerJobId: string;
  prompt: string;
  referenceImages: string[];
  costMillicredits: number;
}

export class JobStore {
  private readonly jobs = new Map<string, Job>();

  create(input: NewJob): Job {
    const now = Date.now();
    const job: Job = {
      id: `job_${randomBytes(12).toString("hex")}`,
      userId: input.userId,
      modelKey: input.modelKey,
      provider: input.provider,
      providerJobId: input.providerJobId,
      state: "queued",
      prompt: input.prompt,
      referenceImages: input.referenceImages,
      createdAt: now,
      updatedAt: now,
      assets: [],
      error: null,
      costMillicredits: input.costMillicredits,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /** Look up a job and confirm it belongs to the given user. */
  getForUser(id: string, userId: string): Job | undefined {
    const job = this.jobs.get(id);
    if (!job || job.userId !== userId) return undefined;
    return job;
  }

  update(id: string, patch: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: Date.now() });
    return job;
  }

  listForUser(userId: string): Job[] {
    return [...this.jobs.values()]
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}
