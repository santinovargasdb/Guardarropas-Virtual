// Shared garment field options, used by both the upload form and the edit modal so
// the two stay in sync. Casing on preset styles is intentional.
import { Shirt, RectangleHorizontal, PersonStanding, Layers, Footprints, ShoppingBag, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Prenda, Clima } from '../types';

export const CATEGORIES: { value: Prenda['category']; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'superior',   label: 'Superior',   hint: 'Remera, Camisa, Suéter',       icon: Shirt },
  { value: 'inferior',   label: 'Inferior',   hint: 'Pantalón, Jean, Pollera',      icon: RectangleHorizontal },
  { value: 'full_body',  label: 'Full Body',  hint: 'Vestido, Mono, Enterito',      icon: PersonStanding },
  { value: 'abrigo',     label: 'Abrigo',     hint: 'Campera, Tapado, Blazer',      icon: Layers },
  { value: 'calzado',    label: 'Calzado',    hint: 'Zapatillas, Botas, Sandalias', icon: Footprints },
  { value: 'accesorios', label: 'Accesorios', hint: 'Joyas, Anteojos, Cintos',      icon: Sparkles },
  { value: 'carteras',   label: 'Carteras',   hint: 'Carteras, Bolsos, Mochilas',   icon: ShoppingBag },
];

export const CLIMAS: { value: Clima; label: string }[] = [
  { value: 'calor',    label: '☀️ Calor' },
  { value: 'templado', label: '⛅ Templado' },
  { value: 'frio',     label: '❄️ Frío' },
];

export const FORMALITIES: { value: Prenda['formality']; label: string }[] = [
  { value: 'casual',    label: '✨ Casual' },
  { value: 'formal',    label: '💼 Formal / Trabajo' },
  { value: 'deportivo', label: '🏃 Deportivo' },
];

// Official preset styles for Luci's Closet — exact casing is intentional.
export const PRESET_STYLES = [
  'Jirai', 'Gotico', 'Soft', 'Cute core', 'Chill', 'Boliche',
];

export const PRESETS_COLORS = [
  { name: 'Negro',    hex: '#1A1A1A' },
  { name: 'Blanco',   hex: '#FFFFFF', hasBorder: true },
  { name: 'Gris',     hex: '#8E918F' },
  { name: 'Crema',    hex: '#F3E5AB' },
  { name: 'Marrón',   hex: '#704214' },
  { name: 'Azul',     hex: '#2A52BE' },
  { name: 'Celeste',  hex: '#87CEEB' },
  { name: 'Verde',    hex: '#2E8B57' },
  { name: 'Bordeaux', hex: '#800020' },
  { name: 'Rosa',     hex: '#FFC0CB' },
  { name: 'Mostaza',  hex: '#E1AD01' },
];

export const LIGHT_SWATCHES = new Set(['#FFFFFF', '#F3E5AB', '#FFC0CB', '#87CEEB', '#E1AD01']);
