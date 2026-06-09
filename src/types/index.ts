export interface Prenda {
  id: string;
  image_url: string;
  category: 'superior' | 'inferior' | 'abrigo' | 'calzado';
  clima: 'calor' | 'frio' | 'templado';
  formality: 'formal' | 'casual' | 'deportivo';
  styles: string[];
  colors: string[];
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
