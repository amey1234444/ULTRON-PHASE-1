import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;
const workspaceRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(workspaceRoot, 'node_modules/react'),
      'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Prevent Vite from clearing the terminal
  clearScreen: false,
  server: {
    port: 3001,
    // Tauri expects a fixed port
    strictPort: true,
    host: host || false,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri supports ES2021+
    target: process.env.TAURI_ENV_PLATFORM === 'windows'
      ? 'chrome105'
      : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: 'dist',
  },
});
