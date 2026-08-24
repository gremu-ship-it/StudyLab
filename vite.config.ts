import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev and preview servers can run inside a sandbox, proxied through a
// preview host (*-<sandboxId>.e2b.app). Allow that host family for both so
// `npm run dev` and the `npm run preview` dry-run of the Vercel deploy work.
const allowedHosts = [".e2b.app", "5173-i5pj4als6n9vjrzs2zx2f.e2b.app"];

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
  },
  preview: {
    allowedHosts,
    host: true,
    port: 4173,
  },
});
