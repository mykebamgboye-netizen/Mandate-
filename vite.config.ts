import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* Hosts allowed for this run come from the environment (per-process),
   e.g. VITE_ALLOWED_HOSTS=pv-....style.dev — never a blanket allowlist. */
const runHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map(h => h.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: runHosts,
  },
})
