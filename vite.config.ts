import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Deployed as a GitHub Pages *project* site at /where-im-going/, but served from
// the root in local dev so `npm run dev` stays at http://localhost:5173/.
// `import.meta.env.BASE_URL` tracks this, and both the router basename and the
// Supabase magic-link redirect are derived from it.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/where-im-going/" : "/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
}));
