import type { Prenda } from '../types';

// ── Mannequin anatomical map ──────────────────────────────────────────────────
// Pixel regions are expressed as percentages over the base mannequin container,
// which keeps a fixed aspect ratio of 300 x 640 (matching mannequin.svg viewBox).
// `left` is the horizontal CENTER anchor — render each garment with
// transform: translateX(-50%) so `left` truly centres it.
//
// `zIndex` encodes the strict layering order requested for the virtual fitting:
//   base mannequin (0) < inferior < superior < full_body < abrigo
//   < calzado < accesorios < carteras

export interface MannequinPlacement {
  top: string;     // % from the top of the container
  left: string;    // % horizontal center anchor
  width: string;   // % of container width
  zIndex: number;  // strict stacking order
  label: string;   // human label (alt text / shuffle control)
}

export const MANNEQUIN_MAP: Record<Prenda['category'], MannequinPlacement> = {
  inferior:   { top: '50%', left: '50%', width: '40%', zIndex: 10, label: 'Inferior' },
  superior:   { top: '19%', left: '50%', width: '40%', zIndex: 20, label: 'Superior' },
  full_body:  { top: '19%', left: '50%', width: '46%', zIndex: 25, label: 'Prenda Entera' },
  abrigo:     { top: '18%', left: '50%', width: '52%', zIndex: 30, label: 'Abrigo' },
  calzado:    { top: '85%', left: '50%', width: '30%', zIndex: 35, label: 'Calzado' },
  accesorios: { top: '2%',  left: '50%', width: '24%', zIndex: 40, label: 'Accesorio' },
  carteras:   { top: '46%', left: '78%', width: '22%', zIndex: 45, label: 'Cartera' },
};

// Render order (ascending z). The mannequin base is drawn separately at z-index 0.
export const LAYER_ORDER: Prenda['category'][] = [
  'inferior', 'superior', 'full_body', 'abrigo', 'calzado', 'accesorios', 'carteras',
];
