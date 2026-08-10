import type { ShopSettings } from './settings';

/**
 * Estado abierto/cerrado del local.
 *
 * Dos arreglos respecto de la versión vieja del sitio:
 *  - la hora se calcula en el huso de Mendoza, no en el del visitante (antes,
 *    alguien mirando desde España veía "Cerrado" a las 3 de la tarde);
 *  - la fecha para buscar feriados se arma en local y no con `toISOString()`,
 *    que en UTC-3 adelanta el día después de las 21:00.
 */

const TZ = 'America/Argentina/Buenos_Aires';

export interface ShopStatus {
  open: boolean;
  /** "Abierto ahora" / "Cerrado" */
  label: string;
  /** Detalle del próximo cambio, ej "Abre a las 17:30". */
  detail: string;
}

interface LocalNow {
  ymd: string;
  dow: number; // 0 = domingo
  minutes: number;
}

function localNow(now: Date): LocalNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = parseInt(get('hour'), 10) % 24; // en-CA puede devolver "24" a medianoche
  const minute = parseInt(get('minute'), 10);

  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    dow: weekdays[get('weekday')] ?? 0,
    minutes: hour * 60 + minute,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function getShopStatus(settings: ShopSettings, now = new Date()): ShopStatus {
  const { ymd, dow, minutes } = localNow(now);

  const isHoliday = settings.holidays.includes(ymd);
  const isWeekendSchedule = dow === 0 || dow === 6 || isHoliday;
  const ranges = (isWeekendSchedule ? settings.scheduleWeekend : settings.scheduleWeekday).map(
    ([from, to]) => [toMinutes(from), toMinutes(to)] as const,
  );

  const current = ranges.find(([from, to]) => minutes >= from && minutes < to);
  if (current) {
    return {
      open: true,
      label: 'Abierto ahora',
      detail: `Hasta las ${formatMinutes(current[1])}`,
    };
  }

  const next = ranges.find(([from]) => minutes < from);
  if (next) {
    return { open: false, label: 'Cerrado', detail: `Abre a las ${formatMinutes(next[0])}` };
  }

  return { open: false, label: 'Cerrado', detail: 'Abre mañana a las 9:00' };
}

/** Texto para el footer y el JSON-LD. */
export function scheduleLines(settings: ShopSettings): { days: string; hours: string }[] {
  const fmt = (r: [string, string][]) => r.map(([a, b]) => `${a} a ${b}`).join(' y ');
  return [
    { days: 'Lunes a Viernes', hours: fmt(settings.scheduleWeekday) },
    { days: 'Sábados, Domingos y Feriados', hours: fmt(settings.scheduleWeekend) },
  ];
}
