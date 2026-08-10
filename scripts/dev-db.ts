/**
 * Postgres local para desarrollo, sin docker ni root.
 * Levanta un binario embebido en .devdb/ y lo deja corriendo.
 *
 *   npx tsx scripts/dev-db.ts start
 *   npx tsx scripts/dev-db.ts stop
 *
 * En producción esto no se usa: ahí corre el servicio postgres de EasyPanel.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), '.devdb');
const PORT = 55432;
const USER = 'mascotitas';
const PASSWORD = 'mascotitas';
const DB = 'mascotitas';

export const DEV_DATABASE_URL = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`;

async function main() {
  const cmd = process.argv[2] ?? 'start';
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (cmd === 'stop') {
    await pg.stop();
    console.log('Postgres de desarrollo detenido.');
    return;
  }

  const { existsSync } = await import('node:fs');
  if (!existsSync(resolve(DATA_DIR, 'PG_VERSION'))) {
    console.log('Inicializando cluster en .devdb …');
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DB);
    console.log(`Base "${DB}" creada.`);
  } catch {
    console.log(`Base "${DB}" ya existía.`);
  }
  console.log(`\nDATABASE_URL="${DEV_DATABASE_URL}"\n`);
  console.log('Corriendo. Ctrl+C para cortar (los datos quedan en .devdb/).');
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
