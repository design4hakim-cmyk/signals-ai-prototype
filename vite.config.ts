import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Vite = the tool that runs the app on your computer and bundles it for Vercel.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Lets us write `@/components/Button` instead of `../../components/Button`
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
