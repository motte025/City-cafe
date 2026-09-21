import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{rollupOptions:{input:{display:'index.html',remote:'remote.html'},output:{manualChunks:{three:['three']}}}}});
