/**
 * Rate limiter en memoria por IP.
 *
 * No persiste entre reinicios del contenedor, pero eso está bien: es una
 * protección contra abuso, no un sistema de facturación. Un restart natural
 * del contenedor limpia las ventanas y no perjudica a nadie.
 *
 * Cada instancia tiene su propia ventana y límite. Usar una por ruta.
 */

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();
  private readonly max: number;
  private readonly windowMs: number;

  /**
   * @param max        Máximo de requests por ventana
   * @param windowMs   Duración de la ventana en ms (default: 60s)
   */
  constructor(max: number, windowMs = 60_000) {
    this.max = max;
    this.windowMs = windowMs;
  }

  /**
   * Devuelve `true` si el request pasa, `false` si hay que rechazarlo.
   *
   * Limpia ventanas viejas cada 100 llamadas para no leakear memoria en un
   * contenedor que corre meses.
   */
  check(ip: string): boolean {
    const now = Date.now();

    // Limpieza periódica
    if (this.windows.size > 500 || Math.random() < 0.01) {
      for (const [key, w] of this.windows) {
        if (now > w.resetAt) this.windows.delete(key);
      }
    }

    const existing = this.windows.get(ip);

    if (!existing || now > existing.resetAt) {
      this.windows.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    existing.count++;
    return existing.count <= this.max;
  }
}

/** Extrae la IP del request (X-Forwarded-For detrás de proxy, o fallback). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return '127.0.0.1';
}
