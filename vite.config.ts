import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SPA narzedzia wewnetrznego — bez SSR.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
