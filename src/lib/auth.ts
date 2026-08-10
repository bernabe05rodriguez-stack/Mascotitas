import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

/**
 * Sesión del panel.
 *
 * Regla aprendida en Guchini: el middleware de Next NO protege las rutas de
 * API ni las server actions, sólo las páginas. Por eso toda mutación llama a
 * `requireAdmin()` explícitamente. El middleware es comodidad para redirigir al
 * login, no la barrera de seguridad.
 */

const COOKIE = 'mascotitas_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function secret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  // Un secreto vacío hace que jose firme cualquier cosa y rompe toda la auth
  // en silencio — otra lección de Guchini. Mejor romper fuerte y temprano.
  if (!raw || raw.length < 24) {
    throw new Error('AUTH_SECRET no está configurado (mínimo 24 caracteres). Generalo con: openssl rand -hex 32');
  }
  return new TextEncoder().encode(raw);
}

export interface AdminSession {
  id: string;
  email: string;
  name: string | null;
}

export async function createSession(user: AdminSession): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function destroySession(): void {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ''),
      name: (payload.name as string | null) ?? null,
    };
  } catch {
    return null; // token vencido o firmado con otro secreto
  }
}

/** Usar al principio de TODA server action y route handler del panel. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new Error('No autorizado');
  return session;
}

export async function verifyCredentials(email: string, password: string): Promise<AdminSession | null> {
  const user = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    // Se compara igual contra un hash falso para que el tiempo de respuesta no
    // delate si el mail existe o no.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu');
    return null;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
