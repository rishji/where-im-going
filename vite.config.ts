import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Two deploy targets, served from different paths, so `base` must be branched
// rather than hardcoded to either one:
//   - Cloudflare Pages (whereimgoing.pages.dev) serves from the domain root.
//     Cloudflare sets CF_PAGES=1 in its build environment.
//   - GitHub Pages serves a *project* site under /where-im-going/.
// Local dev stays at the root so `npm run dev` is http://localhost:5173/.
// `import.meta.env.BASE_URL` tracks whichever applies, and both the router
// basename and the Supabase magic-link redirect derive from it.
export default defineConfig(({ command }) => ({
  base: command === "build" && !process.env.CF_PAGES ? "/where-im-going/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
}));
