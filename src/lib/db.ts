import { supabase, isSupabaseConfigured } from './supabase';
import type { Prenda, OutfitFavorito } from '../types';

// Curated aesthetic mock data for initial load in offline mode
const MOCK_PRENDAS: Prenda[] = [
  {
    id: 'mock-1',
    image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    weather: ['calido', 'templado'],
    formality: ['casual', 'trabajo'],
    styles: ['minimalist', 'casual'],
    colors: ['#FFFFFF'],
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-2',
    image_url: 'https://images.unsplash.com/photo-1574164904299-3a102b110380?w=600&auto=format&fit=crop&q=70',
    category: 'superior',
    weather: ['frio', 'templado'],
    formality: ['casual', 'trabajo'],
    styles: ['cozy', 'minimalist'],
    colors: ['#D7C0AE'], // Beige
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-3',
    image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    weather: ['frio', 'templado', 'lluvioso'],
    formality: ['casual'],
    styles: ['streetwear', 'casual'],
    colors: ['#3E54AC'], // Jean azul
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-4',
    image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&auto=format&fit=crop&q=70',
    category: 'inferior',
    weather: ['calido', 'templado'],
    formality: ['casual', 'trabajo', 'formal'],
    styles: ['minimalist', 'elegant'],
    colors: ['#F5EBE0'], // Blanco/Crema
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-5',
    image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=70',
    category: 'abrigo',
    weather: ['frio', 'templado', 'lluvioso'],
    formality: ['trabajo', 'formal', 'casual'],
    styles: ['elegant', 'minimalist'],
    colors: ['#A084CF'], // Camel / Gris claro
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-6',
    image_url: 'https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&auto=format&fit=crop&q=70',
    category: 'abrigo',
    weather: ['templado', 'frio'],
    formality: ['casual'],
    styles: ['streetwear', 'casual'],
    colors: ['#4E6C50'], // Jean oscuro/Verde militar
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-7',
    image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=70',
    category: 'calzado',
    weather: ['calido', 'templado', 'frio'],
    formality: ['casual', 'trabajo'],
    styles: ['minimalist', 'sporty'],
    colors: ['#FFFFFF'],
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-8',
    image_url: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=70',
    category: 'calzado',
    weather: ['frio', 'templado', 'lluvioso'],
    formality: ['formal', 'casual', 'fiesta'],
    styles: ['elegant', 'edgy'],
    colors: ['#1A1A1A'], // Negro
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-9',
    image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=70',
    category: 'monoprenda',
    weather: ['calido', 'templado'],
    formality: ['fiesta', 'formal', 'casual'],
    styles: ['elegant', 'romantic'],
    colors: ['#2F4F4F'], // Verde esmeralda oscuro
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-10',
    image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=70',
    category: 'accesorio',
    weather: ['calido', 'templado', 'frio', 'lluvioso'],
    formality: ['casual', 'trabajo', 'formal'],
    styles: ['minimalist', 'elegant'],
    colors: ['#8D4B32'], // Marrón cuero
    created_at: new Date().toISOString()
  }
];

// Helper to initialize LocalStorage wardrobe if empty
const initLocalStorageCloset = () => {
  const existing = localStorage.getItem('wardrobe_prendas');
  if (!existing) {
    localStorage.setItem('wardrobe_prendas', JSON.stringify(MOCK_PRENDAS));
  }
};

// ----------------------------------------------------
// DB INTERFACE WRAPPERS
// ----------------------------------------------------

export async function getPrendas(): Promise<Prenda[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('prendas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching prendas from Supabase, falling back to LocalStorage', err);
      // Fallback to LocalStorage on Supabase error
    }
  }

  // LocalStorage Fallback
  initLocalStorageCloset();
  const data = localStorage.getItem('wardrobe_prendas');
  return data ? JSON.parse(data) : [];
}

export async function addPrenda(prenda: Omit<Prenda, 'id' | 'created_at'>): Promise<Prenda> {
  const newPrenda: Prenda = {
    ...prenda,
    id: isSupabaseConfigured ? undefined : crypto.randomUUID(), // Supabase generates UUID on insert
    created_at: new Date().toISOString()
  } as Prenda;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('prendas')
        .insert([newPrenda])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding prenda to Supabase, falling back to LocalStorage', err);
    }
  }

  // LocalStorage Fallback
  initLocalStorageCloset();
  const data = localStorage.getItem('wardrobe_prendas');
  const list: Prenda[] = data ? JSON.parse(data) : [];
  list.unshift(newPrenda);
  localStorage.setItem('wardrobe_prendas', JSON.stringify(list));
  return newPrenda;
}

export async function deletePrenda(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      // If it's a supabase item, delete from DB
      const { error } = await supabase
        .from('prendas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return;
    } catch (err) {
      console.error('Error deleting prenda from Supabase, falling back to LocalStorage', err);
    }
  }

  // LocalStorage Fallback
  const data = localStorage.getItem('wardrobe_prendas');
  if (data) {
    let list: Prenda[] = JSON.parse(data);
    list = list.filter(item => item.id !== id);
    localStorage.setItem('wardrobe_prendas', JSON.stringify(list));
  }
}

export async function getOutfitsFavoritos(): Promise<OutfitFavorito[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('outfits_favoritos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching favorites from Supabase', err);
    }
  }

  // LocalStorage Fallback
  const data = localStorage.getItem('wardrobe_favorites');
  return data ? JSON.parse(data) : [];
}

export async function addOutfitFavorito(items: string[], name?: string): Promise<OutfitFavorito> {
  const newFavorite: OutfitFavorito = {
    id: isSupabaseConfigured ? undefined : crypto.randomUUID() as any,
    name: name || 'Outfit Guardado',
    items,
    created_at: new Date().toISOString()
  } as OutfitFavorito;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('outfits_favoritos')
        .insert([newFavorite])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding favorite to Supabase', err);
    }
  }

  // LocalStorage Fallback
  const data = localStorage.getItem('wardrobe_favorites');
  const list: OutfitFavorito[] = data ? JSON.parse(data) : [];
  list.unshift(newFavorite);
  localStorage.setItem('wardrobe_favorites', JSON.stringify(list));
  return newFavorite;
}

export async function deleteOutfitFavorito(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('outfits_favoritos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return;
    } catch (err) {
      console.error('Error deleting favorite from Supabase', err);
    }
  }

  // LocalStorage Fallback
  const data = localStorage.getItem('wardrobe_favorites');
  if (data) {
    let list: OutfitFavorito[] = JSON.parse(data);
    list = list.filter(item => item.id !== id);
    localStorage.setItem('wardrobe_favorites', JSON.stringify(list));
  }
}

// ----------------------------------------------------
// IMAGE UPLOAD SERVICE
// ----------------------------------------------------

export async function uploadPrendaImage(file: File): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `prendas/${fileName}`;

      // Upload file to Supabase Storage bucket "prendas-images"
      const { error: uploadError } = await supabase.storage
        .from('prendas-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('prendas-images')
        .getPublicUrl(filePath);

      if (!data?.publicUrl) throw new Error('Could not get public URL');
      return data.publicUrl;
    } catch (err) {
      console.error('Error uploading to Supabase Storage, falling back to Base64 dataURL', err);
    }
  }

  // LocalStorage / Offline Fallback: Convert to Base64 DataURL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
