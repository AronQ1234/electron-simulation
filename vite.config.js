import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    cssCodeSplit: false, // Ensures CSS is also bundled into the JS/HTML
    assetsInlineLimit: 100000000, // Optional: Increases the limit for inlining assets
  }
})
