import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    base: '/sitar/',   // 👈 CLAVE para que cargue imágenes, CSS, JS en subcarpetas
})
