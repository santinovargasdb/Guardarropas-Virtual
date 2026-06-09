export interface Prenda {
  id: string;
  image_url: string;
  category: 'superior' | 'inferior' | 'abrigo' | 'calzado' | 'full_body' | 'accesorios';
  clima: 'calor' | 'frio' | 'templado';
  formality: 'formal' | 'casual' | 'deportivo';
  styles: string[];
  colors: string[];            // combined union (primary ∪ secondary) — matching & display
  primary_colors?: string[];   // dominant colours
  secondary_colors?: string[]; // accent colours
  notas_ia?: string;
  tags_ia?: string[];
  created_at?: string;
}

export interface OutfitFavorito {
  id: string;
  name?: string;
  items: string[]; // Array of Prenda IDs
  created_at: string;
}
