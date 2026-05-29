export interface Prenda {
  id: string;
  image_url: string;
  category: 'superior' | 'inferior' | 'abrigo' | 'calzado' | 'monoprenda' | 'accesorio';
  weather: ('calido' | 'frio' | 'templado' | 'lluvioso')[];
  formality: ('casual' | 'formal' | 'trabajo' | 'fiesta')[];
  styles: string[];
  colors: string[];
  created_at: string;
}

export interface OutfitFavorito {
  id: string;
  name?: string;
  items: string[]; // Array of Prenda IDs (UUIDs)
  created_at: string;
}
