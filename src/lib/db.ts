import { supabase, isSupabaseConfigured } from './supabase';
import type { Prenda, OutfitFavorito, Clima } from '../types';

// Increment when the Prenda interface OR the demo dataset changes to force a
// LocalStorage migration + one-time demo refresh.
// v4: official styles (Jirai, Gotico, Soft, Cute core, Chill, Boliche).
// v5: primary/secondary colour roles + colour-rich demo data.
// v6: new categories full_body (vestidos/monos) & accesorios (joyas/bolsos).
// v7: new category carteras (bolsos) + one example item per category.
// v8: clima migrated from single string to multi-value array (Clima[]).
const SCHEMA_VERSION = 'v8';
const LS_SCHEMA_KEY  = 'wardrobe_schema_version';

// One-time demo-seeding marker. Stores the SCHEMA_VERSION it ran under, so a
// future schema bump permits exactly one fresh re-seed. Once set, seeding never
// re-triggers — not even if the user deletes every demo item.
const SEED_FLAG_KEY  = 'wardrobe_seeded';

// ── Type-safe coercers ────────────────────────────────────────────────────────
// Each helper handles both current v3 values and legacy v1/v2 values so that
// old LocalStorage records are silently migrated on first read.

function toCategory(v: unknown): Prenda['category'] {
  if (v === 'superior' || v === 'inferior'  || v === 'abrigo'     ||
      v === 'calzado'  || v === 'full_body' || v === 'accesorios' ||
      v === 'carteras') return v;
  return 'superior';
}

function toClimaOne(v: unknown): Clima | null {
  if (v === 'calor' || v === 'frio' || v === 'templado') return v;
  if (v === 'calido')   return 'calor';      // legacy rename: calido → calor
  if (v === 'lluvioso') return 'templado';   // legacy merge: lluvioso → templado
  return null;
}

// clima is now multi-value. Accepts a single legacy string, a legacy `weather`
// array, or a current array — always returns a deduped, non-empty Clima[].
function toClimaArray(v: unknown): Clima[] {
  const raw = Array.isArray(v) ? v : [v];
  const out: Clima[] = [];
  for (const x of raw) {
    const c = toClimaOne(x);
    if (c && !out.includes(c)) out.push(c);
  }
  return out.length > 0 ? out : ['templado'];
}

function toFormality(v: unknown): Prenda['formality'] {
  const raw = Array.isArray(v) ? v[0] : v;   // accept old array 'formality' field
  if (raw === 'formal' || raw === 'casual' || raw === 'deportivo') return raw;
  if (raw === 'trabajo' || raw === 'fiesta') return 'formal';
  return 'casual';
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

// Guarantees every Prenda from any source conforms to the current interface.
// Colour roles: pre-v5 records only had a flat `colors` array, which we migrate
// into `primary_colors`. `colors` is always kept as the deduped union of
// primary + secondary so the generator/closet can read a single flat list.
function normalizePrenda(raw: unknown): Prenda {
  const r = raw as Record<string, unknown>;

  const rawPrimary       = toStringArray(r.primary_colors);
  const primary_colors   = rawPrimary.length > 0 ? rawPrimary : toStringArray(r.colors);
  const secondary_colors = toStringArray(r.secondary_colors);
  const colors           = Array.from(new Set([...primary_colors, ...secondary_colors]));

  return {
    id:        String(r.id ?? ''),
    image_url: String(r.image_url ?? ''),
    category:  toCategory(r.category),
    clima:     toClimaArray(r.clima ?? r.weather),   // accept legacy string/array
    formality: toFormality(r.formality),
    styles:    toStringArray(r.styles),
    colors,
    primary_colors,
    secondary_colors,
    nombre:    typeof r.nombre    === 'string' ? r.nombre    : undefined,
    notas_ia:  typeof r.notas_ia  === 'string' ? r.notas_ia  : undefined,
    tags_ia:   toStringArray(r.tags_ia),
    created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
  };
}

// ── Demo data ─────────────────────────────────────────────────────────────────
// 10 items · 4 categories · 3 climates · 3 formalities
// AI metadata pre-seeded for the vision-tagging pipeline (future integration).

const MOCK_PRENDAS: Prenda[] = [
  {
    id: 'mock-1',
    image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    clima: ['frio', 'templado', 'calor'],
    formality: 'casual',
    styles: ['Soft', 'Cute core'],
    colors: ['#FFFFFF', '#FFC0CB'],
    primary_colors: ['#FFFFFF'],
    secondary_colors: ['#FFC0CB'],
    notas_ia: 'Remera de algodón en blanco, corte recto clásico. Base perfecta para cualquier combinación.',
    tags_ia: ['básico', 'algodón', 'corte recto', 'versátil'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    image_url: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    clima: ['frio', 'templado'],
    formality: 'casual',
    styles: ['Chill', 'Soft'],
    colors: ['#D7C0AE', '#704214'],
    primary_colors: ['#D7C0AE'],
    secondary_colors: ['#704214'],
    notas_ia: 'Suéter de punto grueso en tono arena, textura acogedora. Ideal para capas en invierno.',
    tags_ia: ['tejido de punto', 'oversized', 'cozy', 'neutro'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-3',
    image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    clima: ['frio', 'templado'],
    formality: 'casual',
    styles: ['Chill', 'Boliche'],
    colors: ['#3E54AC', '#FFFFFF'],
    primary_colors: ['#3E54AC'],
    secondary_colors: ['#FFFFFF'],
    notas_ia: 'Jean de corte recto en azul clásico, lavado medio. Ícono del streetwear cotidiano.',
    tags_ia: ['denim', 'corte recto', 'azul medio', 'clásico'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-4',
    image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    clima: ['templado', 'calor'],
    formality: 'casual',
    styles: ['Soft', 'Cute core'],
    colors: ['#F5EBE0', '#E1AD01'],
    primary_colors: ['#F5EBE0'],
    secondary_colors: ['#E1AD01'],
    notas_ia: 'Pantalón fluido en crema, cintura alta. Sofisticado y fácil de combinar.',
    tags_ia: ['fluido', 'cintura alta', 'crema', 'elegante'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-5',
    image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=70',
    category: 'abrigo',
    clima: ['frio'],
    formality: 'formal',
    styles: ['Gotico', 'Jirai'],
    colors: ['#A084CF', '#1A1A1A'],
    primary_colors: ['#A084CF'],
    secondary_colors: ['#1A1A1A'],
    notas_ia: 'Tapado largo en lila pastel, fibra suave estructurada. Ideal para salidas formales de invierno.',
    tags_ia: ['tapado largo', 'color pastel', 'estructurado', 'formal'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-6',
    image_url: 'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&auto=format&fit=crop&q=70',
    category: 'abrigo',
    clima: ['frio', 'templado'],
    formality: 'casual',
    styles: ['Chill', 'Boliche'],
    colors: ['#4E6C50', '#1A1A1A'],
    primary_colors: ['#4E6C50'],
    secondary_colors: ['#1A1A1A'],
    notas_ia: 'Campera bomber en verde militar, tela ligera. Versátil y urbana.',
    tags_ia: ['bomber', 'verde militar', 'ligera', 'urbana'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-7',
    image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=70',
    category: 'calzado',
    clima: ['frio', 'templado', 'calor'],
    formality: 'casual',
    styles: ['Chill', 'Soft'],
    colors: ['#FFFFFF', '#8E918F'],
    primary_colors: ['#FFFFFF'],
    secondary_colors: ['#8E918F'],
    notas_ia: 'Zapatillas blancas suela chunky. Complemento urbano para looks casuales.',
    tags_ia: ['zapatillas', 'chunky', 'blancas', 'deportivo'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-8',
    image_url: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=70',
    category: 'calzado',
    clima: ['frio', 'templado'],
    formality: 'formal',
    styles: ['Gotico', 'Boliche'],
    colors: ['#1A1A1A', '#8E918F'],
    primary_colors: ['#1A1A1A'],
    secondary_colors: ['#8E918F'],
    notas_ia: 'Botines de cuero negro, taco bajo redondeado. Clásico con actitud.',
    tags_ia: ['botines', 'cuero', 'negro', 'taco bajo'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-9',
    image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    clima: ['templado', 'calor'],
    formality: 'formal',
    styles: ['Boliche', 'Cute core'],
    colors: ['#2F4F4F', '#FFFFFF'],
    primary_colors: ['#2F4F4F'],
    secondary_colors: ['#FFFFFF'],
    notas_ia: 'Blusa liviana en verde oscuro, escote sutil. Perfecta para ocasiones especiales en verano.',
    tags_ia: ['blusa', 'liviana', 'formal', 'verano'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-10',
    image_url: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    clima: ['frio', 'templado', 'calor'],
    formality: 'deportivo',
    styles: ['Chill', 'Jirai'],
    colors: ['#8D4B32', '#1A1A1A'],
    primary_colors: ['#8D4B32'],
    secondary_colors: ['#1A1A1A'],
    notas_ia: 'Pantalón deportivo de corte ajustado, tela elástica cómoda. Para looks activos y urbanos.',
    tags_ia: ['deportivo', 'elástico', 'comfy', 'activo'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-11',
    image_url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&auto=format&fit=crop&q=70',
    category: 'full_body',
    clima: ['templado', 'calor'],
    formality: 'casual',
    styles: ['Chill', 'Cute core'],
    colors: ['#FFFFFF', '#EAD9C0'],
    primary_colors: ['#FFFFFF'],
    secondary_colors: ['#EAD9C0'],
    notas_ia: 'Mono enterizo blanco de líneas minimalistas, fluido y fresco. Una pieza lista para combinar con un solo gesto.',
    tags_ia: ['mono', 'enterito', 'minimalista', 'blanco'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-12',
    image_url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&auto=format&fit=crop&q=70',
    category: 'accesorios',
    clima: ['frio', 'templado', 'calor'],
    formality: 'casual',
    styles: ['Soft', 'Jirai'],
    colors: ['#E1AD01', '#F5EBE0'],
    primary_colors: ['#E1AD01'],
    secondary_colors: ['#F5EBE0'],
    notas_ia: 'Collar de oro delicado, cadena fina con dije sutil. El detalle que eleva cualquier look.',
    tags_ia: ['collar', 'oro', 'delicado', 'joya'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-13',
    image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=70',
    category: 'carteras',
    clima: ['frio', 'templado', 'calor'],
    formality: 'casual',
    styles: ['Chill', 'Boliche'],
    colors: ['#704214', '#1A1A1A'],
    primary_colors: ['#704214'],
    secondary_colors: ['#1A1A1A'],
    notas_ia: 'Cartera de cuero camel con cadena dorada, tamaño medio. Versátil para el día y la noche.',
    tags_ia: ['cartera', 'cuero', 'camel', 'cadena'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-14',
    image_url: 'https://images.unsplash.com/photo-1577803645773-f96470509666?w=600&auto=format&fit=crop&q=70',
    category: 'accesorios',
    clima: ['templado', 'calor'],
    formality: 'casual',
    styles: ['Boliche', 'Jirai'],
    colors: ['#1A1A1A'],
    primary_colors: ['#1A1A1A'],
    secondary_colors: [],
    notas_ia: 'Anteojos de sol negros de montura redonda, una statement piece para la cabeza. Dan actitud al instante.',
    tags_ia: ['anteojos', 'sol', 'cabeza', 'negro'],
    created_at: new Date().toISOString(),
  },
];

// ── Legacy demo detection (for schema migrations) ─────────────────────────────
// Pre-v4 demo seeds carried these generic style tags (and, in the earliest
// builds, hardcoded "mock-N" ids). We use this to purge ONLY stale demo records
// on upgrade, while preserving any garment the user created themselves.
const OLD_GENERIC_STYLES = new Set([
  'minimalist', 'casual', 'romantic', 'sporty', 'elegant',
  'cozy', 'streetwear', 'boho', 'edgy',
]);

function isLegacyDemoPrenda(p: Prenda): boolean {
  if (p.id.startsWith('mock-')) return true;
  // Every demo seed uses an Unsplash image; user uploads never do. This reliably
  // refreshes stale demo data on upgrade while preserving real user garments.
  if (p.image_url.includes('images.unsplash.com')) return true;
  return p.styles.some(s => OLD_GENERIC_STYLES.has(s));
}

// ── LocalStorage init with schema guard ──────────────────────────────────────

const initLocalStorage = () => {
  if (localStorage.getItem(LS_SCHEMA_KEY) !== SCHEMA_VERSION) {
    // Schema upgrade: purge stale demo records but PRESERVE user-created garments.
    // If the wardrobe held ONLY old demo data it becomes empty here, and
    // seedDemoDataIfNeeded() then injects the fresh v4 MOCK_PRENDAS. If the user
    // had created real garments, those survive and no re-seed occurs.
    const raw = localStorage.getItem('wardrobe_prendas');
    let surviving: Prenda[] = [];
    if (raw) {
      try {
        surviving = (JSON.parse(raw) as unknown[])
          .map(normalizePrenda)
          .filter(p => !isLegacyDemoPrenda(p));
      } catch {
        surviving = [];
      }
    }
    localStorage.setItem('wardrobe_prendas', JSON.stringify(surviving));
    localStorage.setItem(LS_SCHEMA_KEY, SCHEMA_VERSION);
    // Favorites may reference purged demo items → clear to avoid orphan refs.
    localStorage.removeItem('wardrobe_favorites');
  } else if (!localStorage.getItem('wardrobe_prendas')) {
    localStorage.setItem('wardrobe_prendas', JSON.stringify([]));
  }
};

// ── Automatic demo seeding (run-once, idempotent) ─────────────────────────────
// On first launch, if the active backend returns an empty wardrobe, inject the
// 10 premium demo items so the app never shows an empty first impression.
//
// Idempotency is guaranteed by a persistent flag (SEED_FLAG_KEY): the evaluation
// runs EXACTLY ONCE per schema version. After it completes, deleting demo items
// or removing everything will NOT re-trigger seeding, and no data is duplicated.
export async function seedDemoDataIfNeeded(): Promise<void> {
  // Already evaluated for this schema version → never seed again.
  if (localStorage.getItem(SEED_FLAG_KEY) === SCHEMA_VERSION) return;

  try {
    const existing = await getPrendas();

    // Only inject when the wardrobe is completely empty. If the user already
    // has at least one item (manual or otherwise), we skip injection entirely.
    if (existing.length === 0) {
      for (const mock of MOCK_PRENDAS) {
        await insertPrenda({
          image_url: mock.image_url,
          category:  mock.category,
          clima:     mock.clima,
          formality: mock.formality,
          styles:    mock.styles,
          colors:    mock.colors,
          notas_ia:  mock.notas_ia,
          tags_ia:   mock.tags_ia,
        });
      }
    }
  } catch (err) {
    // Don't set the flag on failure → seeding is retried on the next launch.
    console.error('Demo seeding failed; will retry next launch', err);
    return;
  }

  // Mark as evaluated whether we injected demo items or the wardrobe already
  // had content — this is what makes the process strictly run-once.
  localStorage.setItem(SEED_FLAG_KEY, SCHEMA_VERSION);
}

// ── PRENDAS ──────────────────────────────────────────────────────────────────

export async function getPrendas(): Promise<Prenda[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('prendas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizePrenda);
    } catch (err) {
      console.error('Supabase getPrendas failed, falling back to LocalStorage', err);
    }
  }

  initLocalStorage();
  try {
    const raw = localStorage.getItem('wardrobe_prendas');
    if (!raw) return [];
    return (JSON.parse(raw) as unknown[]).map(normalizePrenda);
  } catch {
    localStorage.removeItem('wardrobe_prendas');
    return [];
  }
}

// True when a Supabase write failed only because the optional `nombre` column
// hasn't been added to the schema yet — lets us retry without it so the write
// still lands in Supabase instead of silently going to LocalStorage.
function isMissingNombreColumn(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const msg = (e?.message ?? '').toLowerCase();
  return e?.code === 'PGRST204' || (msg.includes('nombre') && msg.includes('column'));
}

const MIGRATION_HINT =
  'Supabase: falta la columna "nombre". Corré en el SQL Editor: ' +
  'alter table prendas add column if not exists nombre text;';

export async function insertPrenda(prenda: Omit<Prenda, 'id' | 'created_at'>): Promise<Prenda> {
  const created_at = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    // PostgreSQL auto-generates id via gen_random_uuid() — never include it in the payload.
    // Note: Supabase column names must match v3 schema (clima, formality as text, not arrays).
    const payload: Record<string, unknown> = { ...prenda, created_at };
    try {
      const { data, error } = await supabase.from('prendas').insert([payload]).select().single();
      if (error) throw error;
      return normalizePrenda(data);
    } catch (err) {
      // Retry without `nombre` if the column doesn't exist yet, so the garment
      // still persists to Supabase (the name is simply dropped until migrated).
      if (isMissingNombreColumn(err) && 'nombre' in payload) {
        try {
          delete payload.nombre;
          const { data, error } = await supabase.from('prendas').insert([payload]).select().single();
          if (error) throw error;
          console.warn(`${MIGRATION_HINT} Prenda guardada SIN nombre.`);
          return normalizePrenda(data);
        } catch (err2) {
          console.error('Supabase insertPrenda retry failed, falling back to LocalStorage', err2);
        }
      } else {
        console.error('Supabase insertPrenda failed, falling back to LocalStorage', err);
      }
    }
  }

  // LocalStorage fallback — UUID generated locally
  initLocalStorage();
  const raw  = localStorage.getItem('wardrobe_prendas');
  const list: Prenda[] = raw ? (JSON.parse(raw) as unknown[]).map(normalizePrenda) : [];
  const newPrenda: Prenda = { ...prenda, id: crypto.randomUUID(), created_at };
  list.unshift(newPrenda);
  localStorage.setItem('wardrobe_prendas', JSON.stringify(list));
  return newPrenda;
}

// Editable garment fields (everything except id/created_at/image_url/ai metadata).
export type PrendaPatch = Partial<
  Pick<Prenda, 'nombre' | 'category' | 'clima' | 'formality' | 'styles' | 'colors' | 'primary_colors' | 'secondary_colors'>
>;

export async function updatePrenda(id: string, patch: PrendaPatch): Promise<Prenda> {
  if (isSupabaseConfigured && supabase) {
    const payload: Record<string, unknown> = { ...patch };
    try {
      const { data, error } = await supabase.from('prendas').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return normalizePrenda(data);
    } catch (err) {
      // Retry without `nombre` if the column doesn't exist yet (see insertPrenda).
      if (isMissingNombreColumn(err) && 'nombre' in payload) {
        try {
          delete payload.nombre;
          const { data, error } = await supabase.from('prendas').update(payload).eq('id', id).select().single();
          if (error) throw error;
          console.warn(`${MIGRATION_HINT} Cambios guardados SIN nombre.`);
          return normalizePrenda(data);
        } catch (err2) {
          console.error('Supabase updatePrenda retry failed, falling back to LocalStorage', err2);
        }
      } else {
        console.error('Supabase updatePrenda failed, falling back to LocalStorage', err);
      }
    }
  }

  // LocalStorage fallback — patch the matching record in place
  initLocalStorage();
  const raw  = localStorage.getItem('wardrobe_prendas');
  const list: Prenda[] = raw ? (JSON.parse(raw) as unknown[]).map(normalizePrenda) : [];
  const idx  = list.findIndex(item => item.id === id);
  if (idx === -1) throw new Error('Prenda no encontrada');
  const updated = normalizePrenda({ ...list[idx], ...patch });
  list[idx] = updated;
  localStorage.setItem('wardrobe_prendas', JSON.stringify(list));
  return updated;
}

export async function deletePrenda(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('prendas').delete().eq('id', id);
      if (error) throw error;
      return;
    } catch (err) {
      console.error('Supabase deletePrenda failed, falling back to LocalStorage', err);
    }
  }

  initLocalStorage();
  try {
    const raw = localStorage.getItem('wardrobe_prendas');
    if (!raw) return;
    const list = (JSON.parse(raw) as unknown[]).map(normalizePrenda).filter(item => item.id !== id);
    localStorage.setItem('wardrobe_prendas', JSON.stringify(list));
  } catch {
    // corrupted LS — leave intact rather than deleting user data
  }
}

// ── OUTFITS FAVORITOS ────────────────────────────────────────────────────────

export async function getOutfitsFavoritos(): Promise<OutfitFavorito[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('outfits_favoritos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutfitFavorito[];
    } catch (err) {
      console.error('Supabase getOutfitsFavoritos failed, falling back to LocalStorage', err);
    }
  }

  try {
    const raw = localStorage.getItem('wardrobe_favorites');
    return raw ? (JSON.parse(raw) as OutfitFavorito[]) : [];
  } catch {
    localStorage.removeItem('wardrobe_favorites');
    return [];
  }
}

export async function insertOutfitFavorito(items: string[], name?: string): Promise<OutfitFavorito> {
  const created_at  = new Date().toISOString();
  const outfitName  = name?.trim() || 'Outfit Guardado';

  if (isSupabaseConfigured && supabase) {
    try {
      const payload: Omit<OutfitFavorito, 'id'> = { name: outfitName, items, created_at };
      const { data, error } = await supabase
        .from('outfits_favoritos')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data as OutfitFavorito;
    } catch (err) {
      console.error('Supabase insertOutfitFavorito failed, falling back to LocalStorage', err);
    }
  }

  const newFavorite: OutfitFavorito = { id: crypto.randomUUID(), name: outfitName, items, created_at };
  const raw  = localStorage.getItem('wardrobe_favorites');
  const list: OutfitFavorito[] = raw ? (JSON.parse(raw) as OutfitFavorito[]) : [];
  list.unshift(newFavorite);
  localStorage.setItem('wardrobe_favorites', JSON.stringify(list));
  return newFavorite;
}

export async function deleteOutfitFavorito(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('outfits_favoritos').delete().eq('id', id);
      if (error) throw error;
      return;
    } catch (err) {
      console.error('Supabase deleteOutfitFavorito failed, falling back to LocalStorage', err);
    }
  }

  try {
    const raw = localStorage.getItem('wardrobe_favorites');
    if (!raw) return;
    const list = (JSON.parse(raw) as OutfitFavorito[]).filter(item => item.id !== id);
    localStorage.setItem('wardrobe_favorites', JSON.stringify(list));
  } catch {
    // corrupted LS — leave intact
  }
}

// ── IMAGE UPLOAD ─────────────────────────────────────────────────────────────

export async function uploadPrendaImage(file: File): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    try {
      const fileExt  = file.name.split('.').pop() ?? 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `prendas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('prendas-images')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('prendas-images').getPublicUrl(filePath);
      if (!data?.publicUrl) throw new Error('No public URL returned from Supabase Storage');
      return data.publicUrl;
    } catch (err) {
      console.error('Supabase Storage upload failed, falling back to Base64 dataURL', err);
    }
  }

  // Offline fallback: encode to Base64 DataURL for LocalStorage
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror  = () => reject(new Error('FileReader failed to encode image'));
    reader.readAsDataURL(file);
  });
}
