import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Single deploy target: Cloudflare Pages (whereimgoing.rishimohnot.com),
// served from the domain root. GitHub Pages was tried and retired — see
// .agents/LESSONS.md.
export default defineConfig({
  base: "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
