import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// SPA routing note: this app uses state-based tab switching (no URL changes),
// so page refreshes always land on index.html with no 404 risk.
// base './' enables relative asset paths for subdirectory deployments.
export default defineConfig({
  plugins: [react()],
  base: './',
})
