import { defineConfig } from 'vite';

const envBasePath = process.env.BASE_PATH;
const base = envBasePath && envBasePath.trim().length > 0 ? envBasePath : '/';

export default defineConfig({
  base,
  assetsInclude: ['**/*.glb'],
});
