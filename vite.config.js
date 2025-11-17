import { defineConfig } from 'vite'

export default defineConfig({
  base: '/gaode3dmap/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      external: [], // 确保 three 不被外部化
    }
  },
  resolve: {
    alias: {
    }
  },
  server: {
    port: 3000
  }
})