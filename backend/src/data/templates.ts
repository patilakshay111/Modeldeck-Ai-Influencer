/**
 * Ready-made character templates.
 *
 * A template is a named look with a reference image. Claiming one creates a
 * character in the caller's account
 * templates tab does.
 *
 * The list is data, loaded from `data/character-templates.json`. Point
 * `TEMPLATE_SOURCE` at your own file to serve your own looks instead.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface CharacterTemplate {
  id: string;
  label: string;
  handle: string;
  /** Absolute URL of the reference image. */
  src: string;
}

interface TemplateFile {
  version: number;
  source: string;
  count: number;
  templates: CharacterTemplate[];
}

export class TemplateStore {
  private readonly templates: CharacterTemplate[];

  constructor(
    path: string = resolve(
      dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
      "..",
      "..",
      "data",
      "character-templates.json",
    ),
  ) {
    const file = JSON.parse(readFileSync(path, "utf8")) as TemplateFile;
    this.templates = Array.isArray(file.templates) ? file.templates : [];
  }

  list(): CharacterTemplate[] {
    return this.templates;
  }

  find(id: string): CharacterTemplate | undefined {
    return this.templates.find((template) => template.id === id);
  }

  findByHandle(handle: string): CharacterTemplate | undefined {
    const needle = handle.replace(/^@/, "").toLowerCase();
    return this.templates.find((template) => template.handle === needle);
  }
}
