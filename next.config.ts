import type { NextConfig } from "next";

const config: NextConfig = {
  // Stops `next dev` from writing an AGENTS.md into the project.
  agentRules: false,
  // NEXT_DIST_DIR lets a second dev server run beside the first (it refuses to share a build folder).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // A package-lock.json higher up the tree would otherwise be picked as the workspace root.
  turbopack: { root: process.cwd() },
};

export default config;
