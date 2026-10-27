import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  // @mama/shared — исходники на TS, поэтому вшиваем в бандл; остальные зависимости — из node_modules.
  noExternal: ['@mama/shared'],
  clean: true,
  sourcemap: true,
})
