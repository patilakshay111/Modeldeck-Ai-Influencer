/**
 * A minimal `.env` loader.
 *
 * The service reads its configuration from the environment. This lets a
 * developer keep keys in `backend/.env` instead of exporting them in every
 * shell. A real environment variable always wins over the file, so a
 * deployment can override anything.
 *
 * No dependency: the format is `KEY=value`, `#` starts a comment, and a
 * value may be wrapped in single or double quotes.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

export const loadEnvFile = (
  path: string = resolve(process.cwd(), ".env"),
  environment: NodeJS.ProcessEnv = process.env,
): Record<string, string> => {
  const loaded: Record<string, string> = {};
  if (!existsSync(path)) return loaded;

  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = LINE.exec(line);
    if (!match) continue;
    const key = match[1]!;
    let value = (match[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    loaded[key] = value;
    // An empty value means "not configured". Leaving it unset lets the
    // schema's own default apply, instead of failing a min-length check on
    // an empty string.
    if (environment[key] === undefined && value !== "") {
      environment[key] = value;
    }
  }
  return loaded;
};
