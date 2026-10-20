import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Integration tests render the real app in jsdom. Set TEST_API_URL to run them against a live backend.
export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.VITE_API_URL": JSON.stringify(process.env.TEST_API_URL || "http://127.0.0.1:8000") },
  test: { environment: "jsdom", include: ["src/**/*.spec.jsx"], testTimeout: 60000, setupFiles: ["./src/test-setup.js"] },
});
