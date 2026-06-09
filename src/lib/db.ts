import { supabase, isSupabaseConfigured } from './supabase';
import type { Prenda, OutfitFavorito } from '../types';

// Increment when the Prenda interface changes to force a LocalStorage schema reset.
const SCHEMA_VERSION = 'v3';
const LS_SCHEMA_KEY  = 'wardrobe_schema_version';

// ── Type-safe coercers ────────────────────────────────────────────────────────
// Each helper handles both current v3 values and legacy v1/v2 values so that
// old LocalStorage records are silently migrated on first read.

function toCategory(v: unknown): Prenda['category'] {
  if (v === 'superior' || v === 'inferior' || v === 'abrigo' || v === 'calzado') return v;
  return 'superior';
}

function toClima(v: unknown): Prenda['clima'] {
  const raw = Array.isArray(v) ? v[0] : v;   // accept old array 'weather' field
  if (raw === 'calor'    || raw === 'frio' || raw === 'templado') return raw;
  if (raw === 'calido')   return 'calor';      // rename: calido → calor
  if (raw === 'lluvioso') return 'templado';   // merge: lluvioso → templado
  return 'templado';
}

function toFormality(v: unknown): Prenda['formality'] {
  const raw = Array.isArray(v) ? v[0] : v;   // accept old array 'formality' field
  if (raw === 'formal' || raw === 'casual' || raw === 'deportivo') return raw;
  if (raw === 'trabajo' || raw === 'fiesta') return 'formal';
  return 'casual';
}

// Guarantees every Prenda from any source conforms to the v3 interface.
// Ensures styles, colors, and tags_ia are always arrays, never undefined.
function normalizePrenda(raw: unknown): Prenda {
  const r = raw as Record<string, unknown>;
  return {
    id:        String(r.id ?? ''),
    image_url: String(r.image_url ?? ''),
    category:  toCategory(r.category),
    clima:     toClima(r.clima ?? r.weather),   // accept both field names
    formality: toFormality(r.formality),
    styles:    Array.isArray(r.styles)  ? (r.styles  as string[]) : [],
    colors:    Array.isArray(r.colors)  ? (r.colors  as string[]) : [],
    notas_ia:  typeof r.notas_ia  === 'string' ? r.notas_ia  : undefined,
    tags_ia:   Array.isArray(r.tags_ia) ? (r.tags_ia as string[]) : [],
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
    clima: 'templado',
    formality: 'casual',
    styles: ['minimalist', 'casual'],
    colors: ['#FFFFFF'],
    notas_ia: 'Remera de algodón en blanco, corte recto clásico. Base perfecta para cualquier combinación.',
    tags_ia: ['básico', 'algodón', 'corte recto', 'versátil'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    image_url: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    clima: 'frio',
    formality: 'casual',
    styles: ['cozy', 'minimalist'],
    colors: ['#D7C0AE'],
    notas_ia: 'Suéter de punto grueso en tono arena, textura acogedora. Ideal para capas en invierno.',
    tags_ia: ['tejido de punto', 'oversized', 'cozy', 'neutro'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-3',
    image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    clima: 'frio',
    formality: 'casual',
    styles: ['streetwear', 'casual'],
    colors: ['#3E54AC'],
    notas_ia: 'Jean de corte recto en azul clásico, lavado medio. Ícono del streetwear cotidiano.',
    tags_ia: ['denim', 'corte recto', 'azul medio', 'clásico'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-4',
    image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    clima: 'calor',
    formality: 'casual',
    styles: ['minimalist', 'elegant'],
    colors: ['#F5EBE0'],
    notas_ia: 'Pantalón fluido en crema, cintura alta. Sofisticado y fácil de combinar.',
    tags_ia: ['fluido', 'cintura alta', 'crema', 'elegante'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-5',
    image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=70',
    category: 'abrigo',
    clima: 'frio',
    formality: 'formal',
    styles: ['elegant', 'minimalist'],
    colors: ['#A084CF'],
    notas_ia: 'Tapado largo en lila pastel, fibra suave estructurada. Ideal para salidas formales de invierno.',
    tags_ia: ['tapado largo', 'color pastel', 'estructurado', 'formal'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-6',
    image_url: 'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&auto=format&fit=crop&q=70',
    category: 'abrigo',
    clima: 'templado',
    formality: 'casual',
    styles: ['streetwear', 'casual'],
    colors: ['#4E6C50'],
    notas_ia: 'Campera bomber en verde militar, tela ligera. Versátil y urbana.',
    tags_ia: ['bomber', 'verde militar', 'ligera', 'urbana'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-7',
    image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=70',
    category: 'calzado',
    clima: 'templado',
    formality: 'casual',
    styles: ['minimalist', 'sporty'],
    colors: ['#FFFFFF'],
    notas_ia: 'Zapatillas blancas suela chunky. Complemento urbano para looks casuales.',
    tags_ia: ['zapatillas', 'chunky', 'blancas', 'deportivo'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-8',
    image_url: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=70',
    category: 'calzado',
    clima: 'frio',
    formality: 'formal',
    styles: ['elegant', 'edgy'],
    colors: ['#1A1A1A'],
    notas_ia: 'Botines de cuero negro, taco bajo redondeado. Clásico con actitud.',
    tags_ia: ['botines', 'cuero', 'negro', 'taco bajo'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-9',
    image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    clima: 'calor',
    formality: 'formal',
    styles: ['elegant', 'romantic'],
    colors: ['#2F4F4F'],
    notas_ia: 'Blusa liviana en verde oscuro, escote sutil. Perfecta para ocasiones especiales en verano.',
    tags_ia: ['blusa', 'liviana', 'formal', 'verano'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-10',
    image_url: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    clima: 'templado',
    formality: 'deportivo',
    styles: ['sporty', 'casual'],
    colors: ['#8D4B32'],
    notas_ia: 'Pantalón deportivo de corte ajustado, tela elástica cómoda. Para looks activos y urbanos.',
    tags_ia: ['deportivo', 'elástico', 'comfy', 'activo'],
    created_at: new Date().toISOString(),
  },
];

// ── LocalStorage init with schema guard ──────────────────────────────────────

const initLocalStorage = () => {
  if (localStorage.getItem(LS_SCHEMA_KEY) !== SCHEMA_VERSION) {
    // Schema changed: reset wardrobe and favorites to avoid orphaned/invalid data
    localStorage.setItem('wardrobe_prendas', JSON.stringify(MOCK_PRENDAS));
    localStorage.setItem(LS_SCHEMA_KEY, SCHEMA_VERSION);
    localStorage.removeItem('wardrobe_favorites');
  } else if (!localStorage.getItem('wardrobe_prendas')) {
    localStorage.setItem('wardrobe_prendas', JSON.stringify(MOCK_PRENDAS));
  }
};

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
  const raw = localStorage.getItem('wardrobe_prendas');
  if (!raw) return [];
  return (JSON.parse(raw) as unknown[]).map(normalizePrenda);
}

export async function insertPrenda(prenda: Omit<Prenda, 'id' | 'created_at'>): Promise<Prenda> {
  const created_at = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      // PostgreSQL auto-generates id via gen_random_uuid() — never include it in the payload.
      // Note: Supabase column names must match v3 schema (clima, formality as text, not arrays).
      const payload: Omit<Prenda, 'id'> = { ...prenda, created_at };
      const { data, error } = await supabase
        .from('prendas')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return normalizePrenda(data);
    } catch (err) {
      console.error('Supabase insertPrenda failed, falling back to LocalStorage', err);
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
  const raw = localStorage.getItem('wardrobe_prendas');
  if (!raw) return;
  const list = (JSON.parse(raw) as unknown[]).map(normalizePrenda).filter(item => item.id !== id);
  localStorage.setItem('wardrobe_prendas', JSON.stringify(list));
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

  const raw = localStorage.getItem('wardrobe_favorites');
  return raw ? (JSON.parse(raw) as OutfitFavorito[]) : [];
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

  const raw = localStorage.getItem('wardrobe_favorites');
  if (!raw) return;
  const list = (JSON.parse(raw) as OutfitFavorito[]).filter(item => item.id !== id);
  localStorage.setItem('wardrobe_favorites', JSON.stringify(list));
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
