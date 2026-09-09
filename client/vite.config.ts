import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:5000'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 3001,
      proxy: {
        '/api': apiUrl,
        // Sin esto el socket se conecta al dev server de Vite (mismo origen que
        // la pagina) en vez de al backend, y los eventos en vivo -- el QR de
        // WhatsApp, los pedidos -- no llegan nunca. `ws: true` es obligatorio:
        // socket.io arranca por HTTP y despues hace upgrade a WebSocket.
        '/socket.io': { target: apiUrl, ws: true },
      },
      allowedHosts: true,
    },
  }
})
