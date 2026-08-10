import { prisma } from './db';

/**
 * Config del negocio. Antes estaba hardcodeada en el HTML (horarios, feriados,
 * número de WhatsApp, umbral de envío bonificado); ahora vive en la tabla
 * Setting y se edita desde el panel.
 */
export interface ShopSettings {
  whatsapp: string;
  facebook: string;
  instagram: string;
  address: string;
  city: string;
  /** A partir de este total el envío es bonificado. */
  freeShippingThreshold: number;
  shippingCost: number;
  /** Rangos "HH:MM"-"HH:MM" por tipo de día. */
  scheduleWeekday: [string, string][];
  scheduleWeekend: [string, string][];
  /** Fechas ISO (YYYY-MM-DD) que se atienden con horario de fin de semana. */
  holidays: string[];
  announcement: string;
}

export const DEFAULT_SETTINGS: ShopSettings = {
  whatsapp: '5492615016555',
  facebook: 'https://www.facebook.com/share/17LYrbtKo6/',
  instagram: 'https://www.instagram.com/mascotitas_alimentos',
  address: 'Sobremonte 256, Dorrego',
  city: 'Mendoza',
  freeShippingThreshold: 20000,
  shippingCost: 4300,
  scheduleWeekday: [['09:00', '22:00']],
  scheduleWeekend: [
    ['09:00', '14:00'],
    ['17:30', '22:00'],
  ],
  holidays: [
    // Feriados nacionales AR 2026
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-24', '2026-04-02', '2026-04-03',
    '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20', '2026-07-09', '2026-08-17',
    '2026-10-12', '2026-11-23', '2026-12-08', '2026-12-25',
    // 2027 (para que el badge no quede desactualizado al cambiar de año)
    '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-24', '2027-03-26', '2027-04-02',
    '2027-05-01', '2027-05-25', '2027-06-21', '2027-07-09', '2027-08-16',
    '2027-10-11', '2027-11-22', '2027-12-08', '2027-12-25',
  ],
  announcement: '',
};

const KEY = 'shop';

export async function getSettings(): Promise<ShopSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  // Merge contra los defaults: si mañana se agrega un campo nuevo, las
  // instalaciones viejas no explotan por tenerlo ausente.
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<ShopSettings>) };
}

export async function saveSettings(patch: Partial<ShopSettings>): Promise<ShopSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next as object },
    update: { value: next as object },
  });
  return next;
}
