import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const execAsync = promisify(exec);
const BACKUP_DIR = resolve(process.env.UPLOADS_DIR ?? '/app/uploads', '../backups');
const MAX_BACKUPS = 7; // Mantener últimos 7 dumps

/**
 * Backup manual de la base de datos.
 *
 * Protegido con AUTH_SECRET por query string (misma razón que /api/boot:
 * si la base está en mal estado, no se puede iniciar sesión).
 *
 * GET: lista los backups existentes
 * POST: crea un backup nuevo (pg_dump)
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.AUTH_SECRET || token !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith('.sql.gz')).sort().reverse();
    const backups = [];
    for (const f of files) {
      const info = await stat(resolve(BACKUP_DIR, f));
      backups.push({ name: f, size: info.size, date: info.mtime.toISOString() });
    }
    return NextResponse.json({ backups, dir: BACKUP_DIR });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.AUTH_SECRET || token !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL no configurada' }, { status: 500 });
  }

  try {
    await mkdir(BACKUP_DIR, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `mascotitas-${ts}.sql.gz`;
    const filepath = resolve(BACKUP_DIR, filename);

    // pg_dump comprimido con gzip. La URL tiene host, puerto, usuario y pass.
    await execAsync(`pg_dump "${dbUrl}" | gzip > "${filepath}"`, {
      timeout: 60_000,
      env: { ...process.env, PGCONNECT_TIMEOUT: '10' },
    });

    const info = await stat(filepath);

    // Rotar: mantener sólo los últimos MAX_BACKUPS
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith('.sql.gz')).sort();
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const f of toDelete) {
        await unlink(resolve(BACKUP_DIR, f));
      }
    }

    return NextResponse.json({
      ok: true,
      file: filename,
      size: info.size,
      kept: Math.min(files.length, MAX_BACKUPS),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
