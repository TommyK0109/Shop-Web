import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  preview: { port: 5200, strictPort: true },
  server: { port: 5200, strictPort: true },
  // GitHub Pages serves a project repo from /<repo>/, not the domain root, so
  // built asset URLs need that prefix. The deploy workflow derives it from the
  // repo name; every other build (local, Docker, Vercel) stays at the root.
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
  // Specs run through this same pipeline, so the TS/JSX handling they
  // exercise is the one the app actually builds with.
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/spec/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    css: false,
  },
})
