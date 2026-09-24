import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o HashRouter mantém todas as páginas na mesma URL, então
  // o mesmo build funciona em /gsip-dashboard/ (GitHub Pages) e na raiz (Cloudflare).
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true
  }
})
