import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // base: "/static/", 
  plugins: [react(),
    tailwindcss(),
  ],
  server: {
    // allowedHosts: [
    //   "*.ngrok-free.app"
    // ],
    host: true,      // <-- important for ngrok
    port: 5173       // or your dev port
  },
})