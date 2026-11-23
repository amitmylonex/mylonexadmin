import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./database/client.js";

const app = buildApp();
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    if (closing) return;
    closing = true;
    try { await app.close(); await prisma.$disconnect(); }
    catch { app.log.error("Unable to shut down cleanly"); process.exitCode = 1; }
  });
}

async function start() {
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`🚀 MyloNex Admin Backend API listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
