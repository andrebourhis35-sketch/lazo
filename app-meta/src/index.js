import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { startServer } from './server.js';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
} else {
  console.warn('No se encontró app-meta/.env. Copia .env.example como .env y completa los valores.');
}

const config = loadConfig();
if (!config.ready) {
  console.warn('Configuración incompleta. La interfaz abrirá, pero no llamará a Meta:');
  for (const e of config.errors) console.warn(`  - ${e}`);
}

const server = await startServer(config);
console.log(`LAZO · app de revisión de Meta en http://localhost:${config.port}`);
console.log(`Graph API: ${config.graphVersion || '(sin configurar)'}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
