import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// أربع صفحات: الترحيب (/)، الإدارة (/admin.html)، التاجر (/app.html)، الشاشات (/screens.html)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
        app: resolve(__dirname, "app.html"),
        screens: resolve(__dirname, "screens.html"),
      },
    },
  },
});
