import 'dotenv/config';

import { createApplication } from './bootstrap.js';
import { config, aiStatus } from './config.js';

const { app } = await createApplication();
const server = app.listen(config.server.port, '0.0.0.0', () => {
  const ai = aiStatus();
  console.log('');
  console.log(`OrderPilot ${config.version} — ${config.business.name}`);
  console.log(`Listening on http://localhost:${config.server.port}`);
  console.log(`AI mode: ${ai.mode}${ai.configured ? ` (${ai.provider}${ai.model ? ` · ${ai.model}` : ''})` : ' — rules fallback'}`);
  console.log(`Runtime data: ${config.paths.runtimeDir}`);
  console.log('');
});

function shutdown(signal) {
  console.log(`\n${signal} received; shutting down.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
