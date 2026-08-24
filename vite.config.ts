import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The dev server runs inside a sandbox and is proxied through a
    // preview host (*-<sandboxId>.e2b.app). Allow that host family.
    allowedHosts: [".e2b.app", "5173-i5pj4als6n9vjrzs2zx2f.e2b.app"],
  },
});
