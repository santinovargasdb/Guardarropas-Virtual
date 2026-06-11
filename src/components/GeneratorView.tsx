import { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Heart, AlertCircle, Sparkles, Check, Shirt, RectangleHorizontal, PersonStanding, Layers, Footprints, ShoppingBag, Lock, X, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Prenda, Clima } from '../types';
import { insertOutfitFavorito } from '../lib/db';
import { MANNEQUIN_MAP, LAYER_ORDER } from '../lib/maniqui';
import mannequinSrc from '../assets/modelos/mannequin.svg';
import { askStylist, isStylistConfigured } from '../lib/stylist';
import type { ChatMessage } from '../lib/stylist';

interface GeneratorViewProps {
  items: Prenda[];
  onFavoriteSaved?: () => void;
  prendaAncla?: Prenda | null;
  onClearAncla?: () => void;
}

type OutfitState = {
  superior?:   Prenda;
  inferior?:   Prenda;
  full_body?:  Prenda;
  abrigo?:     Prenda;
  calzado?:    Prenda;
  accesorios?: Prenda;
  carteras?:   Prenda;
};

// Side shuffle controls — one icon button per garment slot (filtered by presence).
const SHUFFLE_SLOTS: { slot: Prenda['category']; label: string; icon: LucideIcon }[] = [
  { slot: 'accesorios', label: 'Accesorio',       icon: Sparkles },
  { slot: 'superior',   label: 'Prenda Superior', icon: Shirt },
  { slot: 'full_body',  label: 'Prenda Entera',   icon: PersonStanding },
  { slot: 'abrigo',     label: 'Abrigo',          icon: Layers },
  { slot: 'inferior',   label: 'Prenda Inferior', icon: RectangleHorizontal },
  { slot: 'carteras',   label: 'Cartera',         icon: ShoppingBag },
  { slot: 'calzado',    label: 'Calzado',         icon: Footprints },
];

// Preselect climate based on Argentine Southern Hemisphere seasons.
// Jan(0)–Feb(1) and Dec(11) → summer · Jun(5)–Aug(7) → winter · otherwise templado
function getDefaultClima(): Clima {
  const m = new Date().getMonth();
  if (m === 11 || m <= 1) return 'calor';
  if (m >= 5  && m <= 7)  return 'frio';
  return 'templado';
}

// ── Chromatic engine ──────────────────────────────────────────────────────────
// Garment colours come from arbitrary hexes (presets AND legacy demo data), so we
// classify every hex into a coarse colour family. Filters then match by family,
// which is robust to slight hex differences and powers the silent fallbacks.
type ColorFamily = {
  key: string;
  name: string;
  hex: string;                       // swatch shown in the UI
  rgb: [number, number, number];     // reference point for nearest-family matching
  light?: boolean;                   // light swatch → render a dark checkmark
};

const COLOR_FAMILIES: ColorFamily[] = [
  { key: 'blanco',  name: 'Blanco',  hex: '#FFFFFF', rgb: [255, 255, 255], light: true },
  { key: 'crema',   name: 'Crema',   hex: '#EAD9C0', rgb: [234, 217, 192], light: true },
  { key: 'gris',    name: 'Gris',    hex: '#8E918F', rgb: [142, 145, 143] },
  { key: 'negro',   name: 'Negro',   hex: '#1A1A1A', rgb: [26, 26, 26] },
  { key: 'rosa',    name: 'Rosa',    hex: '#FFC0CB', rgb: [255, 192, 203], light: true },
  { key: 'rojo',    name: 'Rojo',    hex: '#C0392B', rgb: [192, 57, 43] },
  { key: 'marron',  name: 'Marrón',  hex: '#704214', rgb: [112, 66, 20] },
  { key: 'mostaza', name: 'Mostaza', hex: '#E1AD01', rgb: [225, 173, 1], light: true },
  { key: 'verde',   name: 'Verde',   hex: '#2E8B57', rgb: [46, 139, 87] },
  { key: 'azul',    name: 'Azul',    hex: '#2A52BE', rgb: [42, 82, 190] },
  { key: 'lila',    name: 'Lila',    hex: '#A084CF', rgb: [160, 132, 207] },
];

// Neutral families used as the last graceful fallback before "anything goes".
const NEUTRAL_KEYS = ['blanco', 'negro', 'gris'];

function hexToRgb(hex: string): [number, number, number] | null {
  const v = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(v)) {
    const n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    const n = parseInt(v.split('').map(c => c + c).join(''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

// Map an arbitrary hex to its nearest colour family (Euclidean RGB distance).
function classifyColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'gris';
  const [r, g, b] = rgb;
  let bestKey = 'gris';
  let bestDist = Infinity;
  for (const fam of COLOR_FAMILIES) {
    const d = (r - fam.rgb[0]) ** 2 + (g - fam.rgb[1]) ** 2 + (b - fam.rgb[2]) ** 2;
    if (d < bestDist) { bestDist = d; bestKey = fam.key; }
  }
  return bestKey;
}

// Maps a garment's hex palette to the coarse colour families used by the filters —
// this is how an anchor garment's colours seed the chromatic triage for the look.
function hexesToFamilies(hexes: string[]): string[] {
  return Array.from(new Set(hexes.map(classifyColor)));
}

// Items whose colour set contains at least one of the requested families.
function matchByColor(pool: Prenda[], keys: string[]): Prenda[] {
  if (keys.length === 0) return [];
  return pool.filter(it => it.colors.some(c => keys.includes(classifyColor(c))));
}

// Resolve a pool to a colour-prioritised, NEVER-empty subset by walking ordered
// preference tiers, then neutral pieces, then the full pool. When no colour
// filter applies to the slot, the pool is returned untouched.
function colorPriorityPool(pool: Prenda[], tiers: string[][]): Prenda[] {
  if (pool.length === 0) return pool;
  const active = tiers.filter(t => t.length > 0);
  if (active.length === 0) return pool;
  for (const tier of active) {
    const m = matchByColor(pool, tier);
    if (m.length > 0) return m;
  }
  const neutral = matchByColor(pool, NEUTRAL_KEYS);
  return neutral.length > 0 ? neutral : pool;
}

export function GeneratorView({ items, onFavoriteSaved, prendaAncla, onClearAncla }: GeneratorViewProps) {
  const [selectedClima,     setSelectedClima]     = useState<Clima>(getDefaultClima());
  const [selectedFormality, setSelectedFormality] = useState<Prenda['formality']>('casual');
  const [selectedStyle,     setSelectedStyle]     = useState<string>('todos');
  const [primaryColors,     setPrimaryColors]     = useState<string[]>([]);
  const [secondaryColors,   setSecondaryColors]   = useState<string[]>([]);

  const [generatedOutfit, setGeneratedOutfit] = useState<OutfitState | null>(null);
  const [isGenerating,    setIsGenerating]    = useState(false);
  const [isShuffling,     setIsShuffling]     = useState(false);
  const [outfitName,      setOutfitName]      = useState('');
  const [showSaveDialog,  setShowSaveDialog]  = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveSuccess,     setSaveSuccess]     = useState(false);
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null);

  const generateTimeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFavoriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamically derive every unique style present in the wardrobe. Any custom
  // style the user types when uploading a garment surfaces here automatically.
  // Empty/whitespace tags are dropped so the dropdown never shows blank options,
  // and the list is sorted for a tidy, deterministic order.
  const allStyles = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => item.styles.forEach(s => {
      const v = s.trim();
      if (v) set.add(v);
    }));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Per-category style triage. Returns the subset of a category that matches the
  // selected style; if none match, falls back to neutral 'Chill' pieces, and as a
  // last resort the full category — so a strict style never produces an empty slot.
  const stylePriorityPool = (catItems: Prenda[]): Prenda[] => {
    if (selectedStyle === 'todos' || catItems.length === 0) return catItems;
    const styled = catItems.filter(i => i.styles.includes(selectedStyle));
    if (styled.length > 0) return styled;
    const neutral = catItems.filter(i => i.styles.includes('Chill'));
    return neutral.length > 0 ? neutral : catItems;
  };

  const togglePrimary = (key: string) =>
    setPrimaryColors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const toggleSecondary = (key: string) =>
    setSecondaryColors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  // Per-slot colour preference tiers (ordered). Base garments lead with the
  // primary palette; calzado leads with the secondary palette (accent) and then
  // harmonises back to the primaries. Every slot still falls back gracefully.
  const colorTiersFor = (category: keyof OutfitState): string[][] => {
    // Accent slots (calzado, accesorios) lead with the secondary palette and then
    // harmonise back to the primaries; everything else leads with the primaries.
    if (category === 'calzado' || category === 'accesorios' || category === 'carteras') return [secondaryColors, primaryColors];
    return [primaryColors, secondaryColors]; // superior, inferior, full_body, abrigo
  };

  // Full per-category triage: STYLE first, then CHROMATIC, each with silent
  // fallback. Never returns empty when the input pool is non-empty.
  const slotPool = (category: keyof OutfitState, catItems: Prenda[]): Prenda[] =>
    colorPriorityPool(stylePriorityPool(catItems), colorTiersFor(category));

  // Clear stale error whenever the user adjusts any filter
  useEffect(() => {
    setErrorMsg(null);
  }, [selectedClima, selectedFormality, selectedStyle, primaryColors, secondaryColors]);

  // Cleanup pending timers on unmount to prevent memory leaks on mobile
  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current)     clearTimeout(generateTimeoutRef.current);
      if (saveFavoriteTimeoutRef.current) clearTimeout(saveFavoriteTimeoutRef.current);
    };
  }, []);

  const handleGenerate = () => {
    if (items.length === 0) {
      setErrorMsg('Tu armario está vacío. ¡Subí algunas prendas primero!');
      return;
    }

    setIsGenerating(true);
    setIsShuffling(true);
    setErrorMsg(null);
    setShowSaveDialog(false);

    generateTimeoutRef.current = setTimeout(() => {
      // ── Base pool: clima + formality (single-value comparisons) ──────────────────
      // We intentionally do NOT pre-filter by style here. Style is applied
      // per-category below (stylePriorityPool) so a strict style can never empty
      // an entire category and break the outfit (e.g. 'Boliche' with no calzado).
      const basePool = items.filter(
        item => item.clima.includes(selectedClima) && item.formality === selectedFormality
      );

      // ── Group the base pool by category ──────────────────────────────────────────
      const byCat = {
        superior:  basePool.filter(i => i.category === 'superior'),
        inferior:  basePool.filter(i => i.category === 'inferior'),
        full_body: basePool.filter(i => i.category === 'full_body'),
        abrigo:    basePool.filter(i => i.category === 'abrigo'),
        calzado:   basePool.filter(i => i.category === 'calzado'),
        // Accessories & bags aren't weather-dependent → match on formality only.
        accesorios: items.filter(i => i.category === 'accesorios' && i.formality === selectedFormality),
        carteras:   items.filter(i => i.category === 'carteras'   && i.formality === selectedFormality),
      };

      const rand = (arr: Prenda[]): Prenda => arr[Math.floor(Math.random() * arr.length)];

      const fail = (msg: string) => {
        setErrorMsg(msg);
        setIsGenerating(false);
        setIsShuffling(false);
        setGeneratedOutfit(null);
        generateTimeoutRef.current = null;
      };

      // Anchor garment (from "generar con esto"): pins its slot and seeds colours.
      const anchor = prendaAncla ?? null;
      const anchorCat = anchor ? anchor.category : null;

      // ════════════════════════════════════════════════════════════════════════════
      // GATE 1 — Calzado (always mandatory)
      // ════════════════════════════════════════════════════════════════════════════
      if (byCat.calzado.length === 0 && anchorCat !== 'calzado') {
        fail(
          '¡No encontramos calzado que combine con estos filtros! ' +
          'Probá cambiando el estilo o cargá más zapatos en tu armario.'
        );
        return;
      }

      // ════════════════════════════════════════════════════════════════════════════
      // GATE 2 — Abrigo (mandatory when clima = frío)
      // ════════════════════════════════════════════════════════════════════════════
      if (selectedClima === 'frio' && byCat.abrigo.length === 0 && anchorCat !== 'abrigo') {
        fail(
          '¡Hace frío! Necesitás un abrigo compatible, pero no encontramos ' +
          'ninguno con estos filtros. ¡Cargá un tapado o campera y volvé a intentarlo!'
        );
        return;
      }

      // ════════════════════════════════════════════════════════════════════════════
      // GATE 3 — Body coverage: at least ONE route must be viable
      //   · Route A (Dos Piezas): superior + inferior
      //   · Route B (Una Pieza):  full_body
      // ════════════════════════════════════════════════════════════════════════════
      // Route viability — the anchor can force a route (a superior/inferior anchor
      // needs only the complementary piece; a full_body anchor is always one-piece).
      const canSeparates =
        anchorCat === 'superior' ? byCat.inferior.length > 0 :
        anchorCat === 'inferior' ? byCat.superior.length > 0 :
        byCat.superior.length > 0 && byCat.inferior.length > 0;
      const canOnePiece = anchorCat === 'full_body' ? true : byCat.full_body.length > 0;

      if (!canSeparates && !canOnePiece) {
        fail(
          '¡No encontramos un conjunto (top + inferior) ni una prenda entera ' +
          '(vestido o mono) con estos filtros! Cambiá la ocasión, el clima o cargá más prendas.'
        );
        return;
      }

      // ════════════════════════════════════════════════════════════════════════════
      // COMPOSE — pick a route, fix the anchor slot, complete the rest
      // ════════════════════════════════════════════════════════════════════════════
      // The anchor forces its route; otherwise flip a coin / take what's available.
      let useOnePiece: boolean;
      if (anchorCat === 'full_body') useOnePiece = true;
      else if (anchorCat === 'superior' || anchorCat === 'inferior') useOnePiece = false;
      else useOnePiece = canOnePiece && (!canSeparates || Math.random() < 0.5);

      if (useOnePiece && !canOnePiece) {
        fail('¡No hay una prenda entera (vestido o mono) que combine con estos filtros!');
        return;
      }
      if (!useOnePiece && !canSeparates) {
        fail('¡Necesitás una prenda superior y una inferior para armar este look! Cargá más prendas o cambiá los filtros.');
        return;
      }

      // pin(): returns the anchor when it owns this slot, else a triaged pick.
      const pin = (cat: keyof OutfitState, poolItems: Prenda[]): Prenda =>
        anchor && anchor.category === cat ? anchor : rand(slotPool(cat, poolItems));

      const outfit: OutfitState = {
        calzado: pin('calzado', byCat.calzado),
      };

      if (useOnePiece) {
        outfit.full_body = pin('full_body', byCat.full_body);
      } else {
        outfit.superior = pin('superior', byCat.superior);
        outfit.inferior = pin('inferior', byCat.inferior);
      }

      // Abrigo: forced if it's the anchor; else mandatory in frío, optional in templado.
      if (anchor && anchor.category === 'abrigo') {
        outfit.abrigo = anchor;
      } else if (byCat.abrigo.length > 0) {
        if (selectedClima === 'frio') {
          outfit.abrigo = rand(slotPool('abrigo', byCat.abrigo));
        } else if (selectedClima === 'templado' && Math.random() > 0.4) {
          outfit.abrigo = rand(slotPool('abrigo', byCat.abrigo));
        }
      }

      // Accesorios: forced if anchor; else optional accent (~70% when available).
      if (anchor && anchor.category === 'accesorios') {
        outfit.accesorios = anchor;
      } else if (byCat.accesorios.length > 0 && Math.random() > 0.3) {
        outfit.accesorios = rand(slotPool('accesorios', byCat.accesorios));
      }

      // Carteras: forced if anchor; else always included when there is stock.
      if (anchor && anchor.category === 'carteras') {
        outfit.carteras = anchor;
      } else if (byCat.carteras.length > 0) {
        outfit.carteras = rand(slotPool('carteras', byCat.carteras));
      }

      setGeneratedOutfit(outfit);
      setIsGenerating(false);
      setIsShuffling(false);
      generateTimeoutRef.current = null;
    }, 850);
  };

  const handleShuffleItem = (category: keyof OutfitState) => {
    if (!generatedOutfit) return;
    // The anchor slot is locked — it's the piece the look is built around.
    if (prendaAncla && prendaAncla.category === category) return;

    const catPool = items.filter(
      item =>
        item.category === category &&
        item.formality === selectedFormality &&
        // Accessories & bags ignore clima (not weather-dependent).
        (category === 'accesorios' || category === 'carteras' || item.clima.includes(selectedClima))
    );

    const currentId = generatedOutfit[category]?.id;

    // Prefer a DIFFERENT garment matching the active style + colour triage…
    const triaged = slotPool(category, catPool).filter(i => i.id !== currentId);
    // …otherwise relax to any other garment of this category for the active
    // clima/ocasión, so the slot always refreshes when an alternative exists
    // (and only stays put when this is the single matching piece).
    const relaxed = catPool.filter(i => i.id !== currentId);
    const pool = triaged.length > 0 ? triaged : relaxed;

    if (pool.length > 0) {
      const newItem = pool[Math.floor(Math.random() * pool.length)];
      setGeneratedOutfit(prev => ({ ...prev, [category]: newItem }));
    }
  };

  // Apply a stylist-suggested garment to its slot, respecting route exclusivity
  // (full_body clears separates and vice-versa) and the anchor lock.
  const applyStylistPick = (p: Prenda) => {
    if (prendaAncla && prendaAncla.category === p.category) return;
    setGeneratedOutfit(prev => {
      const base: OutfitState = { ...(prev ?? {}) };
      if (p.category === 'full_body') { delete base.superior; delete base.inferior; }
      if (p.category === 'superior' || p.category === 'inferior') { delete base.full_body; }
      base[p.category] = p;
      return base;
    });
  };

  const handleSaveFavorite = async () => {
    if (!generatedOutfit) return;
    setIsSaving(true);
    try {
      const itemIds = [
        generatedOutfit.superior?.id,
        generatedOutfit.inferior?.id,
        generatedOutfit.full_body?.id,
        generatedOutfit.abrigo?.id,
        generatedOutfit.calzado?.id,
        generatedOutfit.accesorios?.id,
        generatedOutfit.carteras?.id,
      ].filter((id): id is string => id !== undefined);

      await insertOutfitFavorito(itemIds, outfitName.trim() || undefined);
      setSaveSuccess(true);
      setOutfitName('');

      saveFavoriteTimeoutRef.current = setTimeout(() => {
        setSaveSuccess(false);
        setShowSaveDialog(false);
        if (onFavoriteSaved) onFavoriteSaved();
        saveFavoriteTimeoutRef.current = null;
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-generate a first outfit when items load (unless an anchor garment is
  // driving the look — the anchor flow below generates on its own).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (items.length > 0 && !generatedOutfit && !errorMsg && !prendaAncla) {
      handleGenerate();
    }
  }, [items]);

  // Keep a ref to the latest generator so the anchor flow can run generation
  // AFTER its filter state-updates commit (avoids a stale-closure generation).
  const latestGenerateRef = useRef<() => void>(() => {});
  useEffect(() => { latestGenerateRef.current = handleGenerate; });

  // Anchor flow: mirror the garment's clima/ocasión, inherit its colours into the
  // chromatic filters, then build a look around it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!prendaAncla) return;
    setSelectedClima(prendaAncla.clima[0] ?? getDefaultClima());
    setSelectedFormality(prendaAncla.formality);
    setPrimaryColors(hexesToFamilies(prendaAncla.primary_colors ?? prendaAncla.colors));
    setSecondaryColors(hexesToFamilies(prendaAncla.secondary_colors ?? []));
    const id = setTimeout(() => latestGenerateRef.current(), 0);
    return () => clearTimeout(id);
  }, [prendaAncla]);

  const hasOutfit = generatedOutfit !== null;

  return (
    <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Combinador Mágico</h2>
      <p className="subtitle">Crea combinaciones instantáneas con filtros</p>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Clima</label>
            <select
              value={selectedClima}
              onChange={(e) => setSelectedClima(e.target.value as Clima)}
              style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="calor">☀️ Calor</option>
              <option value="templado">⛅ Templado</option>
              <option value="frio">❄️ Frío</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ocasión</label>
            <select
              value={selectedFormality}
              onChange={(e) => setSelectedFormality(e.target.value as Prenda['formality'])}
              style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="casual">✨ Casual</option>
              <option value="formal">💼 Formal</option>
              <option value="deportivo">🏃 Deportivo</option>
            </select>
          </div>
        </div>

        {allStyles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estilo</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="todos">Todos los estilos</option>
              {allStyles.map(s => <option key={s} value={s}>#{s}</option>)}
            </select>
          </div>
        )}

        {/* ── Chromatic filters (multi-select swatches) ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Colores Principales</label>
          <ColorSwatchRow selected={primaryColors} onToggle={togglePrimary} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Colores Secundarios</label>
          <ColorSwatchRow selected={secondaryColors} onToggle={toggleSecondary} />
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating}>
          <RefreshCw className={isGenerating ? 'animate-spin' : ''} size={18} />
          {isGenerating ? 'Combinando tu closet...' : 'Generar Outfit'}
        </button>
      </div>

      {/* ── Error feedback ───────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          className="glass-panel fade-in"
          style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem', lineHeight: '1.4', borderColor: 'rgba(224, 122, 95, 0.3)', backgroundColor: 'rgba(224, 122, 95, 0.05)', marginBottom: '8px' }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Outfit canvas ────────────────────────────────────────────────── */}
      {hasOutfit && !errorMsg && (
        <div className={`fade-in${isShuffling ? ' shuffling' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '14px', position: 'relative' }}>
            {prendaAncla && (
              <div
                className="fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(212, 163, 115, 0.12)',
                  border: '1px solid var(--panel-border)',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                  Armando el look alrededor de tu <strong>{MANNEQUIN_MAP[prendaAncla.category].label.toLowerCase()}</strong>
                </span>
                {onClearAncla && (
                  <button
                    type="button"
                    onClick={onClearAncla}
                    title="Quitar ancla"
                    aria-label="Quitar ancla"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.74rem', flexShrink: 0 }}
                  >
                    <X size={14} /> Quitar
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>

              {/* ── Maniquí Virtual: canvas anatómico por capas ── */}
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  aspectRatio: '300 / 640',
                  maxWidth: '320px',
                  margin: '0 auto',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                {/* Base mannequin (z-index 0) */}
                <img
                  src={mannequinSrc}
                  alt="Maniquí"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 0 }}
                />

                {/* Garment layers in strict z-order; each "dresses" the mannequin */}
                {LAYER_ORDER.map(slot => {
                  const item = generatedOutfit[slot];
                  if (!item) return null;
                  const p = MANNEQUIN_MAP[slot];
                  // Cutout PNGs already have a transparent background → render as-is.
                  // Photos with a background use multiply + aggressive contrast to
                  // "dissolve" light/white backgrounds onto the mannequin.
                  const isCutout = /\.png($|\?)/i.test(item.image_url) || item.image_url.startsWith('data:image/png');
                  return (
                    <img
                      key={slot}
                      src={item.image_url}
                      alt={p.label}
                      style={{
                        position: 'absolute',
                        top: p.top,
                        left: p.left,
                        width: p.width,
                        height: p.height,
                        objectFit: p.height ? 'cover' : undefined,
                        transform: 'translateX(-50%)',
                        zIndex: p.zIndex,
                        borderRadius: '12px',
                        mixBlendMode: isCutout ? 'normal' : 'multiply',
                        filter: isCutout
                          ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.18))'
                          : 'contrast(1.06) saturate(1.04) drop-shadow(0 6px 14px rgba(0,0,0,0.14))',
                        transition: 'opacity 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>

              {/* ── Control lateral: shuffle por parte del cuerpo ── */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', flexShrink: 0 }}>
                {SHUFFLE_SLOTS.filter(s => generatedOutfit[s.slot]).map(s => {
                  const Icon = s.icon;
                  const isLocked = prendaAncla?.category === s.slot;
                  return (
                    <button
                      key={s.slot}
                      type="button"
                      onClick={() => { if (!isLocked) handleShuffleItem(s.slot); }}
                      disabled={isLocked}
                      title={isLocked ? `${s.label} fijado (ancla del look)` : `Cambiar ${s.label}`}
                      aria-label={isLocked ? `${s.label} fijado` : `Cambiar ${s.label}`}
                      style={{
                        position: 'relative',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        border: `1px solid ${isLocked ? 'var(--accent-color)' : 'var(--panel-border)'}`,
                        backgroundColor: isLocked ? 'var(--accent-light)' : 'var(--bg-color)',
                        color: 'var(--accent-color)',
                        cursor: isLocked ? 'default' : 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'transform 0.15s ease, background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { if (!isLocked) e.currentTarget.style.backgroundColor = 'var(--accent-light)'; }}
                      onMouseLeave={(e) => { if (!isLocked) e.currentTarget.style.backgroundColor = 'var(--bg-color)'; }}
                      onMouseDown={(e) => { if (!isLocked) e.currentTarget.style.transform = 'scale(0.9)'; }}
                      onMouseUp={(e)   => { if (!isLocked) e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {isLocked ? <Lock size={15} /> : <Icon size={17} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button className="btn btn-secondary" onClick={handleGenerate} style={{ flex: 1 }} disabled={isGenerating}>
              <RefreshCw size={16} /> Mezclar Todo
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowSaveDialog(true)}
              style={{ flex: 1.5, backgroundColor: 'var(--success-color)' }}
            >
              <Heart size={16} fill="white" /> Guardar Combinación
            </button>
          </div>

          {/* ── Ask Luci / Roast My Fit (estilista IA) ── */}
          <StylistChat
            wardrobe={items}
            activeOutfit={generatedOutfit ?? {}}
            filters={`Clima: ${selectedClima} · Ocasión: ${selectedFormality} · Estilo: ${selectedStyle} · Colores: ${[...primaryColors, ...secondaryColors].join('/') || 'libres'}`}
            onApplyPick={applyStylistPick}
          />
        </div>
      )}

      {/* ── Save dialog ──────────────────────────────────────────────────── */}
      {showSaveDialog && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="glass-panel pop-in"
            style={{ width: '100%', maxWidth: '360px', margin: 0, backgroundColor: 'var(--bg-color)', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="item-title" style={{ fontSize: '1.2rem', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
              Guardar Outfit
            </h3>

            {saveSuccess ? (
              <div
                className="sparkle-success"
                style={{ color: 'var(--success-color)', textAlign: 'center', padding: '20px 0', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
              >
                <Sparkles size={42} style={{ color: 'var(--accent-color)' }} />
                ¡Añadido a tus Favoritos!
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Dale un nombre a este look (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Look de Sábado, Cita de cumple..."
                    value={outfitName}
                    onChange={(e) => setOutfitName(e.target.value)}
                    style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', backgroundColor: 'rgba(255,255,255,0.8)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.95rem', outline: 'none' }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowSaveDialog(false)}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveFavorite}
                    style={{ flex: 2, padding: '10px', backgroundColor: 'var(--success-color)' }}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Child component: Color Swatch Row (multi-select) ──────────────────────────

interface ColorSwatchRowProps {
  selected: string[];
  onToggle: (key: string) => void;
}

function ColorSwatchRow({ selected, onToggle }: ColorSwatchRowProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {COLOR_FAMILIES.map(fam => {
        const active = selected.includes(fam.key);
        return (
          <button
            key={fam.key}
            type="button"
            onClick={() => onToggle(fam.key)}
            title={fam.name}
            aria-label={fam.name}
            aria-pressed={active}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: fam.hex,
              border: fam.light ? '1px solid var(--panel-border)' : 'none',
              boxShadow: active
                ? '0 0 0 2px var(--bg-color), 0 0 0 4px var(--accent-color)'
                : '0 1px 3px rgba(0,0,0,0.15)',
              transform: active ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {active && (
              <Check
                size={14}
                color={fam.light ? '#1A1A1A' : '#FFFFFF'}
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Child component: Stylist Chat (Ask Luci / Roast My Fit) ───────────────────

const ROAST_PROMPT =
  'Hacé un roast con MUCHO humor (pero cariñoso y constructivo) del outfit que tengo ' +
  'puesto ahora mismo en el maniquí. Sé picante pero buena onda y cerrá con un consejo ' +
  'concreto para mejorarlo usando ropa de mi armario.';

const SUGGEST_PROMPT =
  '¿Qué me pongo hoy? Dame una sugerencia copada según mis filtros activos y lo que tengo ' +
  'en el armario. Si conviene, proponé cambiar alguna prenda del maniquí.';

interface StylistChatProps {
  wardrobe: Prenda[];
  activeOutfit: OutfitState;
  filters: string;
  onApplyPick: (p: Prenda) => void;
}

function StylistChat({ wardrobe, activeOutfit, filters, onApplyPick }: StylistChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setLoading(true);
    try {
      const reply = await askStylist(trimmed, wardrobe, activeOutfit, filters);
      // Capture garment markers → auto-apply to the mannequin, and strip any id that
      // leaks into the text — both [PRENDA:id] and a bare [id] — so the user never sees it.
      const ids: string[] = [];
      const clean = reply
        .replace(/\[([^\]]+)\]/g, (full, inner: string) => {
          const id = inner.replace(/^PRENDA:/i, '').trim();
          if (wardrobe.some(p => p.id === id)) {
            ids.push(id);
            return ''; // strip the marker / leaked id from the visible text
          }
          return full; // leave unrelated brackets untouched
        })
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +([,.!?…])/g, '$1') // tidy spaces left before punctuation
        .trim();
      ids.forEach(id => {
        const pick = wardrobe.find(p => p.id === id);
        if (pick) onApplyPick(pick);
      });
      setMessages(prev => [...prev, { role: 'stylist', text: clean || '¡Listo! Te actualicé el look. ✨' }]);
    } catch (error) {
      console.error('[Stylist Error Debug]:', error);
      // askStylist already throws a friendly, self-contained message.
      const errMsg = error instanceof Error ? error.message : 'Algo salió mal, probá de nuevo. 😅';
      setMessages(prev => [
        ...prev,
        { role: 'stylist', text: errMsg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isStylistConfigured) {
    return (
      <div className="glass-panel" style={{ padding: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
        <span>El chat de la estilista está desactivado. Quitá <code style={{ fontSize: '0.78rem' }}>VITE_STYLIST_ENABLED=false</code> para habilitarlo.</span>
      </div>
    );
  }

  return (
    <div
      className="glass-panel"
      style={{
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'linear-gradient(180deg, rgba(255, 240, 245, 0.5), var(--panel-bg))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={16} style={{ color: 'var(--accent-color)' }} />
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Preguntale a Luci
        </h3>
      </div>

      {/* Message history */}
      <div
        ref={scrollRef}
        style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 2px' }}
      >
        {messages.length === 0 && !loading && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.85, textAlign: 'center', padding: '10px 6px', lineHeight: 1.45 }}>
            Tu estilista personal ✨ Pedile una idea o tirale un "Roast My Fit" para una crítica con onda.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '9px 12px',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              backgroundColor: m.role === 'user' ? 'var(--accent-color)' : 'rgba(255,255,255,0.88)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: m.role === 'user' ? 'none' : '1px solid var(--panel-border)',
              fontSize: '0.84rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '6px 4px' }}>
            Luci está pensando…
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="chip" onClick={() => send(SUGGEST_PROMPT)} disabled={loading} style={{ flex: 1, fontSize: '0.78rem', cursor: loading ? 'default' : 'pointer' }}>
          ¿Qué me pongo hoy?
        </button>
        <button type="button" className="chip" onClick={() => send(ROAST_PROMPT)} disabled={loading} style={{ flex: 1, fontSize: '0.78rem', cursor: loading ? 'default' : 'pointer' }}>
          🔥 Roast My Fit
        </button>
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribile a tu estilista…"
          disabled={loading}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          style={{ width: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--accent-color)', color: '#fff', cursor: loading || !input.trim() ? 'default' : 'pointer', opacity: loading || !input.trim() ? 0.6 : 1 }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
