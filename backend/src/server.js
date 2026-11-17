'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadBackendEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith('#') || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

loadBackendEnv();

const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const { createApp } = require('./app');

async function main() {
  const { MONGO_URI, SESSION_SECRET, APP_ORIGIN } = process.env;
  if (!MONGO_URI || !APP_ORIGIN || !SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error('Revisa MONGO_URI, APP_ORIGIN y SESSION_SECRET.');
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: 'pps14',
    collectionName: 'sessions',
    ttl: 60 * 60 * 8,
  });
  const app = createApp({
    sessionStore,
    sessionSecret: SESSION_SECRET,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    allowedOrigin: APP_ORIGIN,
  });
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`Aplicación disponible en http://localhost:${port}`);
  });

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    server.close(async (error) => {
      try {
        await sessionStore.close();
        await mongoose.disconnect();
        if (error) process.exitCode = 1;
      } catch {
        process.exitCode = 1;
        await mongoose.disconnect().catch(() => {});
      }
    });
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (require.main === module) {
  main().catch(async () => {
    console.error('No se pudo iniciar: revisa variables y MongoDB.');
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { main };
