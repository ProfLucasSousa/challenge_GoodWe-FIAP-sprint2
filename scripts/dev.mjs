import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(rootDir, '.env');
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function loadEnvironment() {
  let contents;

  try {
    contents = readFileSync(envPath, 'utf8');
  } catch {
    throw new Error('Arquivo .env não encontrado. Copie .env.example para .env antes de iniciar.');
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function run(command, args, label) {
  console.log(`\n[dev] ${label}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

loadEnvironment();

run('docker', ['compose', 'up', '-d', '--wait', 'postgres'], 'Iniciando PostgreSQL...');
run(
  packageManager,
  ['--filter', '@ev-chargeops/api', 'exec', 'prisma', 'db', 'push', '--skip-generate'],
  'Sincronizando o banco de dados...',
);

if (process.env.DEMO_MODE === 'true') {
  run(packageManager, ['db:seed'], 'Atualizando os dados de demonstração...');
}

if (!process.argv.includes('--prepare-only')) {
  run(packageManager, ['dev:apps'], 'Iniciando API e frontend...');
}
