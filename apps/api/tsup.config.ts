import { defineConfig } from 'tsup';

/** Workspace packages ship TypeScript source, so they are bundled; native and driver modules load from node_modules. */
export default defineConfig({
  entry: { main: 'src/main.ts', migrate: 'src/migrate.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@setrya\//, 'hono', '@hono/node-server', 'zod', 'drizzle-orm'],
  external: ['@node-rs/argon2', 'postgres', 'qrcode'],
});
