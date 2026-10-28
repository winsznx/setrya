import { readFileSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';

import { serve } from '@hono/node-server';
import { log } from '@setrya/security';

import { createApp } from './app';
import { startRunner } from './services/payments/runner';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const edgeKey = required('SETRYA_EDGE_KEY');
if (edgeKey.length < 32) throw new Error('SETRYA_EDGE_KEY must be at least 32 characters');
required('DATABASE_URL');

const port = Number(process.env.PORT ?? 8444);
const hostname = process.env.HOST ?? '127.0.0.1';
const certFile = process.env.SETRYA_TLS_CERT_FILE;
const keyFile = process.env.SETRYA_TLS_KEY_FILE;
const tls = certFile && keyFile ? { cert: readFileSync(certFile), key: readFileSync(keyFile) } : null;

const app = createApp(edgeKey);
serve(
  { fetch: app.fetch, port, hostname, ...(tls ? { createServer: createHttpsServer, serverOptions: tls } : {}) },
  (info) => log('info', 'api.listening', { address: info.address, port: info.port, tls: tls !== null }),
);
startRunner();
