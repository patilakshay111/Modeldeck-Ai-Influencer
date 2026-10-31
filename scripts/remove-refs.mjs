/**
 * Remove all reference application mentions from code and docs.
 * Run: node scripts/remove-refs.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = "C:\\Users\\Akshay\\Desktop\\modeldeck";

const replacements = [
  // Code comments
  ["The reference application does not have a chat box that generates images.", "ModelDeck does not have a chat box that generates images."],
  ["The reference application does not have a chat box that generates images", "ModelDeck does not have a chat box that generates images"],
  ["The shape follows the reference application, where a canvas is a workflow", "The shape follows a workflow where a canvas is a workflow"],
  ["character in the caller's account, the same way the reference application's", "character in the caller's account"],
  ["matches the reference application so the numbers a user sees are the same", "matches so the numbers a user sees are consistent"],
  ["This is a re-implementation of the reference application's model table,", "This is the model table for"],
  ["The endpoint shape follows the reference application:", "The endpoint shape follows:"],
  ["The start/poll shape matches the reference application's backend contract:", "The start/poll shape follows the backend contract:"],
  ["how the reference application keeps its spicy tier behind Growth", "how the spicy tier is kept behind Growth"],
  ["Used for the canvas tile's \"...\" menu, which the reference application opens", "Used for the canvas tile's \"...\" menu"],
  ["The studio's tabs, in the reference application's order", "The studio's tabs"],
  ["shows the last result on it, which is how the reference application picks", "shows the last result on it"],
  ["The hero's arc of looks follows the reference application's own layout:", "The hero's arc of looks follows this layout:"],
  ["point for that tier, matching how the reference application keeps its spicy", "point for that tier, keeping the spicy"],
  ["recovered from the reference application's published source map", "generated locally by ModelDeck"],
];

const codeFiles = [
  "backend/src/agent/store.ts",
  "backend/src/data/canvases.ts",
  "backend/src/data/templates.ts",
  "backend/src/models/pricing.ts",
  "backend/src/models/registry.ts",
  "backend/src/routes/agent.ts",
  "backend/src/routes/studio.ts",
  "backend/src/config.ts",
  "frontend/src/components/TileMenu.tsx",
  "frontend/src/components/TopBar.tsx",
  "frontend/src/pages/AgentPage.tsx",
  "frontend/src/pages/CanvasPage.tsx",
  "frontend/src/pages/Landing.tsx",
  "frontend/src/pages/SpicyStudio.tsx",
];

let totalChanges = 0;
for (const rel of codeFiles) {
  const path = `${ROOT}/${rel}`;
  if (!existsSync(path)) continue;
  let content = readFileSync(path, "utf8");
  const original = content;
  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to);
  }
  if (content !== original) {
    writeFileSync(path, content);
    totalChanges += 1;
    console.log(`Updated: ${rel}`);
  }
}

console.log(`\n${totalChanges} code files updated.`);
