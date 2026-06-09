import { useState, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Heart, AlertCircle, Sparkles } from 'lucide-react';
import type { Prenda } from '../types';
import { insertOutfitFavorito } from '../lib/db';

interface GeneratorViewProps {
  items: Prenda[];
  onFavoriteSaved?: () => void;
}

type OutfitState = {
  superior?: Prenda;
  inferior?: Prenda;
  abrigo?:   Prenda;
  calzado?:  Prenda;
};

// Preselect climate based on Argentine Southern Hemisphere seasons.
// Jan(0)–Feb(1) and Dec(11) → summer · Jun(5)–Aug(7) → winter · otherwise templado
function getDefaultClima(): Prenda['clima'] {
  const m = new Date().getMonth();
  if (m === 11 || m <= 1) return 'calor';
  if (m >= 5  && m <= 7)  return 'frio';
  return 'templado';
}

export function GeneratorView({ items, onFavoriteSaved }: GeneratorViewProps) {
  const [selectedClima,     setSelectedClima]     = useState<Prenda['clima']>(getDefaultClima());
  const [selectedFormality, setSelectedFormality] = useState<Prenda['formality']>('casual');
  const [selectedStyle,     setSelectedStyle]     = useState<string>('todos');

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

  // Clear stale error whenever the user adjusts any filter
  useEffect(() => {
    setErrorMsg(null);
  }, [selectedClima, selectedFormality, selectedStyle]);

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
        item => item.clima === selectedClima && item.formality === selectedFormality
      );

      // ── Group the base pool by category ──────────────────────────────────────────
      const byCat = {
        superior: basePool.filter(i => i.category === 'superior'),
        inferior: basePool.filter(i => i.category === 'inferior'),
        abrigo:   basePool.filter(i => i.category === 'abrigo'),
        calzado:  basePool.filter(i => i.category === 'calzado'),
      };

      const rand = (arr: Prenda[]): Prenda => arr[Math.floor(Math.random() * arr.length)];

      const fail = (msg: string) => {
        setErrorMsg(msg);
        setIsGenerating(false);
        setIsShuffling(false);
        setGeneratedOutfit(null);
        generateTimeoutRef.current = null;
      };

      // ════════════════════════════════════════════════════════════════════════════
      // GATE 1 — Calzado (always mandatory)
      // ════════════════════════════════════════════════════════════════════════════
      if (byCat.calzado.length === 0) {
        fail(
          '¡No encontramos calzado que combine con estos filtros! ' +
          'Probá cambiando el estilo o cargá más zapatos en tu armario.'
        );
        return;
      }

      // ════════════════════════════════════════════════════════════════════════════
      // GATE 2 — Abrigo (mandatory when clima = frío)
      // ════════════════════════════════════════════════════════════════════════════
      if (selectedClima === 'frio' && byCat.abrigo.length === 0) {
        fail(
          '¡Hace frío! Necesitás un abrigo compatible, pero no encontramos ' +
          'ninguno con estos filtros. ¡Cargá un tapado o campera y volvé a intentarlo!'
        );
        return;
      }

      // ════════════════════════════════════════════════════════════════════════════
      // GATE 3 — Body coverage: superior + inferior required
      // ════════════════════════════════════════════════════════════════════════════
      if (byCat.superior.length === 0 || byCat.inferior.length === 0) {
        let msg: string;
        if (byCat.superior.length === 0 && byCat.inferior.length === 0) {
          msg = '¡No encontramos tops ni prendas inferiores con estos filtros! Probá cambiando la ocasión o el estilo.';
        } else if (byCat.superior.length === 0) {
          msg = '¡No hay prendas superiores (remeras, blusas, suéteres) que coincidan! Cambiá los filtros o cargá más prendas.';
        } else {
          msg = '¡No hay prendas inferiores (pantalones, polleras, jeans) que coincidan! Cambiá los filtros o cargá más prendas.';
        }
        fail(msg);
        return;
      }

      // ════════════════════════════════════════════════════════════════════════════
      // COMPOSE — all gates passed, build the outfit
      // ════════════════════════════════════════════════════════════════════════════
      const outfit: OutfitState = {
        superior: rand(stylePriorityPool(byCat.superior)),
        inferior: rand(stylePriorityPool(byCat.inferior)),
        calzado:  rand(stylePriorityPool(byCat.calzado)),
      };

      // Abrigo: mandatory for frío (gated above), optional for templado/calor
      if (byCat.abrigo.length > 0) {
        if (selectedClima === 'frio') {
          outfit.abrigo = rand(stylePriorityPool(byCat.abrigo));
        } else if (selectedClima === 'templado' && Math.random() > 0.4) {
          outfit.abrigo = rand(stylePriorityPool(byCat.abrigo));
        }
      }

      setGeneratedOutfit(outfit);
      setIsGenerating(false);
      setIsShuffling(false);
      generateTimeoutRef.current = null;
    }, 850);
  };

  const handleShuffleItem = (category: keyof OutfitState) => {
    if (!generatedOutfit) return;

    const catPool = items.filter(
      item =>
        item.category === category &&
        item.clima     === selectedClima &&
        item.formality === selectedFormality
    );

    // Same style-priority triage as generation, with graceful neutral fallback.
    const pool = stylePriorityPool(catPool);

    const currentId  = generatedOutfit[category]?.id;
    const cleanPool  = pool.filter(i => i.id !== currentId);
    const finalPool  = cleanPool.length > 0 ? cleanPool : pool;

    if (finalPool.length > 0) {
      const newItem = finalPool[Math.floor(Math.random() * finalPool.length)];
      setGeneratedOutfit(prev => ({ ...prev, [category]: newItem }));
    }
  };

  const handleSaveFavorite = async () => {
    if (!generatedOutfit) return;
    setIsSaving(true);
    try {
      const itemIds = [
        generatedOutfit.superior?.id,
        generatedOutfit.inferior?.id,
        generatedOutfit.abrigo?.id,
        generatedOutfit.calzado?.id,
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

  // Auto-generate a first outfit when items load for the first time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (items.length > 0 && !generatedOutfit && !errorMsg) {
      handleGenerate();
    }
  }, [items]);

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
              onChange={(e) => setSelectedClima(e.target.value as Prenda['clima'])}
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
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>

            {/* Top row: superior + inferior */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {generatedOutfit.superior && (
                <OutfitItemCard
                  label="Prenda Superior"
                  item={generatedOutfit.superior}
                  onShuffle={() => handleShuffleItem('superior')}
                />
              )}
              {generatedOutfit.inferior && (
                <OutfitItemCard
                  label="Prenda Inferior"
                  item={generatedOutfit.inferior}
                  onShuffle={() => handleShuffleItem('inferior')}
                />
              )}
            </div>

            {/* Bottom row: abrigo + calzado */}
            <div style={{ display: 'grid', gridTemplateColumns: generatedOutfit.abrigo ? '1fr 1fr' : '1fr', gap: '12px' }}>
              {generatedOutfit.abrigo && (
                <OutfitItemCard
                  label="Abrigo"
                  item={generatedOutfit.abrigo}
                  onShuffle={() => handleShuffleItem('abrigo')}
                />
              )}
              {generatedOutfit.calzado && (
                <OutfitItemCard
                  label="Calzado"
                  item={generatedOutfit.calzado}
                  onShuffle={() => handleShuffleItem('calzado')}
                />
              )}
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

// ── Child component: Outfit Item Card ─────────────────────────────────────────

interface OutfitItemCardProps {
  label: string;
  item: Prenda;
  onShuffle: () => void;
  isSmall?: boolean;
}

function OutfitItemCard({ label, item, onShuffle, isSmall }: OutfitItemCardProps) {
  return (
    <div
      className="prenda-card pop-in"
      style={{ flexDirection: isSmall ? 'row' : 'column', height: isSmall ? '80px' : 'auto', position: 'relative' }}
    >
      <div
        className="prenda-img-container"
        style={{ aspectRatio: isSmall ? '1/1' : '3/4', width: isSmall ? '80px' : '100%' }}
      >
        <img src={item.image_url} alt={label} className="prenda-img" />
      </div>

      <div
        className="prenda-info"
        style={{ padding: isSmall ? '10px 12px' : '10px', display: 'flex', flexDirection: 'column', justifyContent: isSmall ? 'center' : 'flex-start', flex: isSmall ? 1 : undefined }}
      >
        <span
          className="prenda-category"
          style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.03em', marginBottom: '2px' }}
        >
          {label}
        </span>

        {!isSmall && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
            {item.styles.slice(0, 1).map(s => (
              <span key={s} className="tag-badge" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>#{s}</span>
            ))}
            {item.colors.slice(0, 1).map(c => (
              <span
                key={c}
                className="tag-badge"
                style={{ fontSize: '0.6rem', padding: '1px 4px', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <span
                  style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c, border: c === '#FFFFFF' ? '1px solid #CCC' : undefined }}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onShuffle(); }}
        style={{ position: 'absolute', top: isSmall ? '50%' : '8px', right: '8px', transform: isSmall ? 'translateY(-50%)' : 'none', backgroundColor: 'rgba(255, 255, 255, 0.9)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', color: 'var(--text-primary)', transition: 'transform 0.2s ease, background-color 0.2s' }}
        onMouseDown={(e) => { e.currentTarget.style.transform = isSmall ? 'translateY(-50%) scale(0.9)' : 'scale(0.9)'; }}
        onMouseUp={(e)   => { e.currentTarget.style.transform = isSmall ? 'translateY(-50%) scale(1)'   : 'scale(1)'; }}
        title="Cambiar esta prenda"
      >
        <RefreshCw size={13} />
      </button>
    </div>
  );
}
