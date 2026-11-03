import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// ADR-002/Q3: дополнительный артефакт — самодостаточный single-file HTML (≤ 6 МБ, gate check:size)
export default defineConfig({
  plugins: [viteSingleFile()],
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist-single',
    assetsInlineLimit: 100_000_000,
  },
});
