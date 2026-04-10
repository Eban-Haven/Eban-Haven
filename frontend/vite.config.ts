import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts/')) return 'charts'
          if (id.includes('node_modules/framer-motion/')) return 'motion'
          if (id.includes('node_modules/react-markdown/')) return 'markdown'
          if (id.includes('node_modules/lucide-react/')) return 'icons'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')
          ) return 'react'
          return undefined
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5277',
        changeOrigin: true,
      },
    },
  },
})
