/**
 * Normalización del catálogo que venía del Google Sheet.
 *
 * Todo lo que este archivo decide (slug, marca, tipo de mascota, subcategoría)
 * es *editable después* desde el panel. La fila original del Sheet se guarda
 * intacta en `Product.legacyRaw`, así que ninguna decisión de acá es destructiva.
 */

export type SheetRow = Record<string, string>;

export type PetType = 'PERRO' | 'GATO' | 'OTRO';

export interface NormalizedVariant {
  label: string;
  price: number;
  originalPrice: number | null;
  order: number;
}

export interface NormalizedProduct {
  slug: string;
  name: string;
  legacyId: string | null;
  categorySlug: string;
  brand: string | null;
  petType: PetType | null;
  stock: number;
  featured: boolean;
  variants: NormalizedVariant[];
  images: string[];
  legacyRaw: SheetRow;
}

export interface Issue {
  level: 'warn' | 'info';
  row: number;
  name: string;
  message: string;
}

/* ------------------------------------------------------------------ slugs */

// Una sola implementación compartida con el panel: si el panel y la migración
// generaran slugs distintos, un mismo producto tendría dos URLs.
import { slugify } from '../src/lib/slug';
export { slugify };

/* ----------------------------------------------------------------- marcas */

/**
 * Whitelist de marcas reales del catálogo. Se matchea la más larga primero para
 * que "OLD PRINCE" gane sobre "OLD" y "PRO PLAN" sobre "PRO".
 * Las claves con typo del Sheet (SIEGUER, OLD PRIMCE, CATFED) mapean a la marca buena.
 */
const BRAND_ALIASES: Record<string, string> = {
  'OLD PRINCE': 'Old Prince',
  'OLD PRIMCE': 'Old Prince',
  'VITAL CAN': 'Vital Can',
  'EXCELLENT PURINA': 'Excellent Purina',
  'EXCELLENT': 'Excellent Purina',
  'SIEGER KATZE': 'Sieger',
  'SIEGUER': 'Sieger',
  'SIEGER': 'Sieger',
  'TOP NUTRITION': 'Top Nutrition',
  'ROYAL CANIN': 'Royal Canin',
  'PRO PLAN': 'Pro Plan',
  'PROPLAN': 'Pro Plan',
  'GRAN CAMPEON': 'Gran Campeón',
  'CRIADORES BAIRES': 'Criadores Baires',
  'CAN FEED': 'Can Feed',
  'CATFEED': 'Cat Feed',
  'CATFED': 'Cat Feed',
  'UPPER CROCK': 'Upper Crock',
  'MISTER PET': 'Mister Pet',
  'GATI PURINA': 'Gati Purina',
  'KEN/L': "Ken-L",
  'DOGCHOW': 'Dog Chow',
  'CATCHOW': 'Cat Chow',
  'CATPRO': 'Cat Pro',
  'DOGUI': 'Dogui',
  'EUKANUBA': 'Eukanuba',
  'FIRPO': 'Firpo',
  'KONGO': 'Kongo',
  'MASGOOD': 'Masgood',
  'AGILITY': 'Agility',
  'OPTIMUM': 'Optimum',
  'SABROSITO': 'Sabrosito',
  'VORAZ': 'Voraz',
  'PAMPA': 'Pampa',
  'PEDIGREE': 'Pedigree',
  'ESTAMPA': 'Estampa',
  'WHISKAS': 'Whiskas',
  'COMPANY': 'Company',
  'GOLOCAN': 'Golocan',
  'PERROLAC': 'Perrolac',
  'GATOLAC': 'Gatolac',
  'DENTASTIX': 'Dentastix',
  'OSSPRET': 'Osspret',
  'RUBICAT': 'Rubicat',
  'ELMER': 'Elmer',
  'BABS': 'Babs',
  'RAZA': 'Raza',
};

const BRAND_KEYS = Object.keys(BRAND_ALIASES).sort((a, b) => b.length - a.length);

export function detectBrand(name: string): string | null {
  const upper = ' ' + name.toUpperCase().replace(/\s+/g, ' ').trim() + ' ';
  for (const key of BRAND_KEYS) {
    // Límite de palabra a ambos lados, para que "CAN FEED" no matchee dentro de "VITAL CAN FEEDER".
    if (upper.includes(' ' + key + ' ') || upper.startsWith(' ' + key)) {
      return BRAND_ALIASES[key];
    }
  }
  return null;
}

/* ----------------------------------------------------------- tipo de mascota */

// El orden importa: gato se evalúa primero porque "VITAL CAN THERAPY GATO
// URINARY" contiene tanto "CAN" (perro) como "GATO".
const GATO_RE = /\bGAT|KATZE|\bCATCHOW|\bCATPRO|\bCATFE|WHISKAS|FELIN|GATOLAC|RUBICAT|\bMICHI/i;
const PERRO_RE = /\bPERRO|\bDOG|CACHORRO|PUPPY|CANIN|PERROLAC|\bCAN\b|\bKEN\/L/i;

export function detectPetType(name: string, categorySlug: string): PetType | null {
  if (categorySlug === 'perro') return 'PERRO';
  if (categorySlug === 'gato') return 'GATO';
  if (categorySlug === 'conejo') return 'OTRO';

  const gato = GATO_RE.test(name);
  const perro = PERRO_RE.test(name);
  // "CHALECO PARA PERRO/GATO" nombra a las dos: sirve para cualquiera.
  if (gato && perro) return null;
  if (gato) return 'GATO';
  if (perro) return 'PERRO';
  return null; // null = sirve para cualquier mascota
}

/* ------------------------------------------------------------ presentación */

/**
 * La columna "KM N" del Sheet no siempre era un peso: había talles (T2), medidas
 * (90CM) y un literal "1" que significaba "una unidad" en los accesorios.
 */
export function normalizeVariantLabel(raw: string): string {
  const v = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  if (v === '1' || v === '1U' || v === 'U') return 'Unidad';
  return v;
}

/** Una variante "Unidad" única no necesita selector en la UI. */
export function isSingleUnit(variants: NormalizedVariant[]): boolean {
  return variants.length === 1 && variants[0].label === 'Unidad';
}

/* -------------------------------------------------------------- categorías */

export interface CategoryDef {
  slug: string;
  name: string;
  petType: PetType | null;
  icon: string;
  order: number;
  parent?: string;
}

/** Las 8 categorías que ya existían en el Sheet, con nombre presentable. */
export const TOP_CATEGORIES: CategoryDef[] = [
  { slug: 'perro', name: 'Alimento para perros', petType: 'PERRO', icon: 'dog', order: 1 },
  { slug: 'gato', name: 'Alimento para gatos', petType: 'GATO', icon: 'cat', order: 2 },
  { slug: 'alimentos-humedos', name: 'Alimento húmedo', petType: null, icon: 'soup', order: 3 },
  { slug: 'conejo', name: 'Conejos', petType: 'OTRO', icon: 'rabbit', order: 4 },
  { slug: 'accesorios', name: 'Accesorios', petType: null, icon: 'bone', order: 5 },
  { slug: 'colchonetas', name: 'Camas y colchonetas', petType: null, icon: 'bed-double', order: 6 },
  { slug: 'vestimenta', name: 'Ropa y abrigo', petType: null, icon: 'shirt', order: 7 },
  { slug: 'pipeta', name: 'Antipulgas y pipetas', petType: null, icon: 'shield-check', order: 8 },
];

/**
 * "accesorios" tenía 79 productos — más que ninguna otra categoría — mezclando
 * juguetes, sanitarios, comederos, higiene, salud y paseo. Se parte en
 * subcategorías por palabra clave. Es un punto de partida editable, no un dogma.
 */
export const ACCESORIOS_SUBCATEGORIES: CategoryDef[] = [
  { slug: 'juguetes', name: 'Juguetes', petType: null, icon: 'baseball', order: 1, parent: 'accesorios' },
  { slug: 'paseo', name: 'Collares y paseo', petType: null, icon: 'link', order: 2, parent: 'accesorios' },
  { slug: 'sanitarios', name: 'Sanitarios', petType: null, icon: 'trash-2', order: 3, parent: 'accesorios' },
  { slug: 'comederos', name: 'Comederos y bebederos', petType: null, icon: 'utensils', order: 4, parent: 'accesorios' },
  { slug: 'higiene', name: 'Higiene y cuidado', petType: null, icon: 'sparkles', order: 5, parent: 'accesorios' },
  { slug: 'salud', name: 'Salud', petType: null, icon: 'heart-pulse', order: 6, parent: 'accesorios' },
  { slug: 'snacks', name: 'Snacks y premios', petType: null, icon: 'cookie', order: 7, parent: 'accesorios' },
];

/**
 * Reglas evaluadas en orden: la primera que matchea gana. Por eso
 * "HUESO COMESTIBLE" cae en snacks antes que el "HUESO" genérico en juguetes,
 * y "COLLAR PULGUICIDA" en salud antes que el "COLLAR" de paseo.
 */
const SUBCATEGORY_RULES: Array<{ slug: string; re: RegExp }> = [
  { slug: 'snacks', re: /BOCADITO|BISCUISTE|COMESTIBLE|PERROLAC|GATOLAC|DENTASTIX|GOLOCAN/i },
  { slug: 'salud', re: /PASTILLA|DESPARASITARIA|OSSPRET|PULGUICIDA|ISABELINO|SHAMPOO|ESPUMA SECA/i },
  { slug: 'sanitarios', re: /SANITARI|ARENA|PIEDRA|BANDEJA|PALITA|BOLSA HIGIENICA|CAPSULAS|PA[ÑN]O ABSORBENTE|ACA NO/i },
  { slug: 'comederos', re: /COMEDERO|BEBEDERO|BOTELLA|MAMADERA/i },
  { slug: 'higiene', re: /CEPILLO|PEINE|RODILLO|MANOPLA|ALICATE|LIMA|CARDINA|SACAPELUSA/i },
  { slug: 'paseo', re: /COLLAR|CORREA|PRETAL|ARNES|PECHERA|REFLECTARIO|CINTURON/i },
  { slug: 'juguetes', re: /PELOTA|HUESO|JUGUETE|CHIFLE|MORDILLO|RAMA DE GOMA|PATA DE POLLO|BIFE DE GOMA|MANCUERNA|RATON|RATITA|POMPON|PLUMA|VARITA|\bARO\b|RASCADOR|CRUZ|GALLINA|GUSANO|CASCABEL|SOGA|TENIS|TELEFONO|HAMBURGUESA|DONA|PATITO|CHOCLO|VAINILLA/i },
];

/** Devuelve el slug de subcategoría, o null si no cae en ninguna regla. */
export function detectSubcategory(name: string, categorySlug: string): string | null {
  if (categorySlug !== 'accesorios') return null;
  for (const rule of SUBCATEGORY_RULES) {
    if (rule.re.test(name)) return rule.slug;
  }
  return null;
}

/* ------------------------------------------------------------------ parseo */

function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * Encuentra la columna de descuento de la variante `i`. El Sheet tiene los
 * nombres inconsistentes: "Precio 1 descuento" pero "Precios 2 descuneto"
 * (con el typo). Se matchea de forma laxa, igual que hacía el JS viejo.
 */
function findDiscountColumn(row: SheetRow, i: number): string | undefined {
  return Object.keys(row).find((k) => {
    const n = k.toLowerCase();
    return n.includes('precio') && n.includes(String(i)) && /desc|esc|off/.test(n);
  });
}

export interface NormalizeResult {
  products: NormalizedProduct[];
  issues: Issue[];
  stats: {
    rowsInSheet: number;
    rowsSkipped: number;
    products: number;
    variants: number;
    images: number;
    withBrand: number;
    withDiscount: number;
    featured: number;
  };
}

export function normalizeCatalog(rows: SheetRow[]): NormalizeResult {
  const issues: Issue[] = [];
  const products: NormalizedProduct[] = [];
  const slugCounts = new Map<string, number>();
  let rowsSkipped = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 por el header, +1 porque las planillas cuentan desde 1
    const name = (row['name'] || '').replace(/\s+/g, ' ').trim();

    if (!name) {
      rowsSkipped++;
      issues.push({ level: 'warn', row: rowNum, name: '(vacío)', message: 'Fila sin nombre — descartada' });
      return;
    }

    /* variantes */
    const variants: NormalizedVariant[] = [];
    for (let i = 1; i <= 4; i++) {
      const rawLabel = (row[`KM ${i}`] || '').trim();
      const price = parseMoney(row[`Precio ${i}`]);
      if (!rawLabel || price === null) {
        if (rawLabel && price === null) {
          issues.push({ level: 'warn', row: rowNum, name, message: `Presentación "${rawLabel}" sin precio válido — variante descartada` });
        }
        continue;
      }

      let originalPrice: number | null = null;
      const discountCol = findDiscountColumn(row, i);
      const discounted = discountCol ? parseMoney(row[discountCol]) : null;
      if (discounted !== null) {
        if (discounted < price) {
          originalPrice = price;
          variants.push({ label: normalizeVariantLabel(rawLabel), price: discounted, originalPrice, order: variants.length });
          continue;
        }
        issues.push({ level: 'warn', row: rowNum, name, message: `Precio con descuento (${discounted}) no es menor al de lista (${price}) — se ignora el descuento` });
      }

      variants.push({ label: normalizeVariantLabel(rawLabel), price, originalPrice: null, order: variants.length });
    }

    if (variants.length === 0) {
      rowsSkipped++;
      issues.push({ level: 'warn', row: rowNum, name, message: 'Sin ninguna presentación con precio — descartada' });
      return;
    }

    // Más barata primero, igual que hacía el sitio viejo.
    variants.sort((a, b) => a.price - b.price);
    variants.forEach((v, i) => (v.order = i));

    /* imágenes */
    const images: string[] = [];
    for (const col of ['Image 1', 'Image 2', 'Image 3']) {
      const url = (row[col] || '').trim();
      if (url) images.push(url);
    }
    if (images.length === 0) {
      issues.push({ level: 'info', row: rowNum, name, message: 'Sin imagen' });
    }

    /* categoría */
    const rawCategory = (row['category'] || '').trim().toLowerCase();
    const topSlug = slugify(rawCategory) || 'accesorios';
    if (!TOP_CATEGORIES.some((c) => c.slug === topSlug)) {
      issues.push({ level: 'warn', row: rowNum, name, message: `Categoría desconocida "${rawCategory}" — va a Accesorios` });
    }
    const known = TOP_CATEGORIES.some((c) => c.slug === topSlug) ? topSlug : 'accesorios';
    const categorySlug = detectSubcategory(name, known) ?? known;

    if (known === 'accesorios' && categorySlug === 'accesorios') {
      issues.push({ level: 'info', row: rowNum, name, message: 'Accesorio sin subcategoría automática — revisar en el panel' });
    }

    /* destacado */
    const featuredKey = Object.keys(row).find((k) => /destac|featur/i.test(k));
    const featuredRaw = featuredKey ? (row[featuredKey] ?? '').toString().trim().toLowerCase() : '';
    const featured = featuredRaw !== '' && !['0', 'no', 'false', '-'].includes(featuredRaw);

    /* stock */
    const stockRaw = (row['stock'] || '').trim();
    const stock = Number.isFinite(Number(stockRaw)) ? Math.max(0, Math.trunc(Number(stockRaw))) : 0;

    /* slug estable y único */
    const base = slugify(name) || `producto-${rowNum}`;
    const seen = slugCounts.get(base) ?? 0;
    slugCounts.set(base, seen + 1);
    const slug = seen === 0 ? base : `${base}-${seen + 1}`;
    if (seen > 0) {
      issues.push({ level: 'info', row: rowNum, name, message: `Nombre repetido — slug desambiguado como "${slug}"` });
    }

    products.push({
      slug,
      name,
      legacyId: (row['id'] || '').trim() || null,
      categorySlug,
      brand: detectBrand(name),
      petType: detectPetType(name, known),
      stock,
      featured,
      variants,
      images,
      legacyRaw: row,
    });
  });

  return {
    products,
    issues,
    stats: {
      rowsInSheet: rows.length,
      rowsSkipped,
      products: products.length,
      variants: products.reduce((n, p) => n + p.variants.length, 0),
      images: products.reduce((n, p) => n + p.images.length, 0),
      withBrand: products.filter((p) => p.brand).length,
      withDiscount: products.filter((p) => p.variants.some((v) => v.originalPrice)).length,
      featured: products.filter((p) => p.featured).length,
    },
  };
}
