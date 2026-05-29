import React, { useState, useEffect } from 'react';
import { RefreshCw, Heart, AlertCircle, Check } from 'lucide-react';
import type { Prenda } from '../types';
import { addOutfitFavorito } from '../lib/db';

interface GeneratorViewProps {
  items: Prenda[];
  onFavoriteSaved?: () => void;
}

export function GeneratorView({ items, onFavoriteSaved }: GeneratorViewProps) {
  // Filters
  const [selectedWeather, setSelectedWeather] = useState<Prenda['weather'][number]>('templado');
  const [selectedFormality, setSelectedFormality] = useState<Prenda['formality'][number]>('casual');
  const [selectedStyle, setSelectedStyle] = useState<string>('todos');
  
  // States for generated outfit
  const [generatedOutfit, setGeneratedOutfit] = useState<{
    superior?: Prenda;
    inferior?: Prenda;
    monoprenda?: Prenda;
    abrigo?: Prenda;
    calzado?: Prenda;
    accesorio?: Prenda;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [noItemsError, setNoItemsError] = useState<string | null>(null);

  // Extract all unique styles from closet items to populate style filter
  const allStyles = React.useMemo(() => {
    const stylesSet = new Set<string>();
    items.forEach(item => {
      item.styles.forEach(s => stylesSet.add(s));
    });
    return Array.from(stylesSet);
  }, [items]);

  // Generate outfit handler
  const handleGenerate = () => {
    if (items.length === 0) {
      setNoItemsError('Tu armario está vacío. Sube algunas prendas primero.');
      return;
    }

    setIsGenerating(true);
    setNoItemsError(null);
    setShowSaveDialog(false);

    // Simulate shuffling animation
    setTimeout(() => {
      // 1. Filter items by Weather & Formality (primary filters)
      let pool = items.filter(item => {
        const matchesWeather = item.weather.includes(selectedWeather);
        const matchesFormality = item.formality.includes(selectedFormality);
        return matchesWeather && matchesFormality;
      });

      // 2. Secondary Filter: Style (if selected, try to match it)
      if (selectedStyle !== 'todos') {
        const stylePool = pool.filter(item => item.styles.includes(selectedStyle));
        // If we have items with this style, we narrow the pool. Otherwise, fallback to main pool
        if (stylePool.length > 0) {
          pool = stylePool;
        }
      }

      // Group pool by category
      const byCat = {
        superior: pool.filter(i => i.category === 'superior'),
        inferior: pool.filter(i => i.category === 'inferior'),
        monoprenda: pool.filter(i => i.category === 'monoprenda'),
        abrigo: pool.filter(i => i.category === 'abrigo'),
        calzado: pool.filter(i => i.category === 'calzado'),
        accesorio: pool.filter(i => i.category === 'accesorio'),
      };

      // Determine outfit type (monoprenda vs. top+bottom)
      const hasMonoprendas = byCat.monoprenda.length > 0;
      const hasTops = byCat.superior.length > 0;
      const hasBottoms = byCat.inferior.length > 0;
      const hasCalzado = byCat.calzado.length > 0;

      if (!hasTops && !hasBottoms && !hasMonoprendas) {
        setNoItemsError('No hay prendas suficientes (tops/monoprendas) que coincidan con estos filtros.');
        setIsGenerating(false);
        setGeneratedOutfit(null);
        return;
      }

      if (!hasCalzado) {
        setNoItemsError('Necesitas cargar al menos un calzado compatible en tu armario.');
        setIsGenerating(false);
        setGeneratedOutfit(null);
        return;
      }

      // Choose outfit structure
      const outfit: typeof generatedOutfit = {};
      const randomChoice = Math.random();

      // If we have monoprendas and choose to use them (or if we have no tops/bottoms)
      if (hasMonoprendas && (randomChoice > 0.5 || !hasTops || !hasBottoms)) {
        outfit.monoprenda = byCat.monoprenda[Math.floor(Math.random() * byCat.monoprenda.length)];
      } else {
        if (hasTops && hasBottoms) {
          outfit.superior = byCat.superior[Math.floor(Math.random() * byCat.superior.length)];
          outfit.inferior = byCat.inferior[Math.floor(Math.random() * byCat.inferior.length)];
        } else {
          // Fallback if we miss one part but have monoprenda
          if (hasMonoprendas) {
            outfit.monoprenda = byCat.monoprenda[Math.floor(Math.random() * byCat.monoprenda.length)];
          } else {
            setNoItemsError('Necesitas cargar al menos una prenda superior y una inferior para combinar.');
            setIsGenerating(false);
            return;
          }
        }
      }

      // Add Calzado (Shoes)
      outfit.calzado = byCat.calzado[Math.floor(Math.random() * byCat.calzado.length)];

      // Add Abrigo (Outerwear) based on weather
      if (byCat.abrigo.length > 0) {
        if (selectedWeather === 'frio') {
          // Mandatory in cold weather
          outfit.abrigo = byCat.abrigo[Math.floor(Math.random() * byCat.abrigo.length)];
        } else if (selectedWeather === 'templado' && Math.random() > 0.4) {
          // Optional (60% chance) in temperate weather
          outfit.abrigo = byCat.abrigo[Math.floor(Math.random() * byCat.abrigo.length)];
        }
      }

      // Add Accessory (optional 40% chance)
      if (byCat.accesorio.length > 0 && Math.random() > 0.6) {
        outfit.accesorio = byCat.accesorio[Math.floor(Math.random() * byCat.accesorio.length)];
      }

      setGeneratedOutfit(outfit);
      setIsGenerating(false);
    }, 850);
  };

  // Shuffle individual item category
  const handleShuffleItem = (category: keyof NonNullable<typeof generatedOutfit>) => {
    if (!generatedOutfit) return;

    // Filter items of this category matching the current filters
    let pool = items.filter(item => {
      const matchesCategory = item.category === category;
      const matchesWeather = item.weather.includes(selectedWeather);
      const matchesFormality = item.formality.includes(selectedFormality);
      return matchesCategory && matchesWeather && matchesFormality;
    });

    if (selectedStyle !== 'todos') {
      const stylePool = pool.filter(item => item.styles.includes(selectedStyle));
      if (stylePool.length > 0) pool = stylePool;
    }

    // Exclude current item to guarantee a change if possible
    const currentId = generatedOutfit[category]?.id;
    const cleanPool = pool.filter(i => i.id !== currentId);
    const finalPool = cleanPool.length > 0 ? cleanPool : pool;

    if (finalPool.length > 0) {
      const newItem = finalPool[Math.floor(Math.random() * finalPool.length)];
      setGeneratedOutfit(prev => ({
        ...prev,
        [category]: newItem
      }));
    }
  };

  // Save outfit favorites handler
  const handleSaveFavorite = async () => {
    if (!generatedOutfit) return;
    
    setIsSaving(true);
    try {
      const itemIds: string[] = [];
      if (generatedOutfit.superior) itemIds.push(generatedOutfit.superior.id);
      if (generatedOutfit.inferior) itemIds.push(generatedOutfit.inferior.id);
      if (generatedOutfit.monoprenda) itemIds.push(generatedOutfit.monoprenda.id);
      if (generatedOutfit.abrigo) itemIds.push(generatedOutfit.abrigo.id);
      if (generatedOutfit.calzado) itemIds.push(generatedOutfit.calzado.id);
      if (generatedOutfit.accesorio) itemIds.push(generatedOutfit.accesorio.id);

      await addOutfitFavorito(itemIds, outfitName.trim() || undefined);
      setSaveSuccess(true);
      setOutfitName('');
      
      setTimeout(() => {
        setSaveSuccess(false);
        setShowSaveDialog(false);
        if (onFavoriteSaved) onFavoriteSaved();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Automatically generate an outfit on load if empty
  useEffect(() => {
    if (items.length > 0 && !generatedOutfit && !noItemsError) {
      handleGenerate();
    }
  }, [items]);

  const hasOutfit = generatedOutfit !== null;

  return (
    <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Combinador Mágico</h2>
      <p className="subtitle">Crea combinaciones instantáneas con filtros</p>

      {/* Filters Form */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
          
          {/* Weather select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Clima</label>
            <select
              value={selectedWeather}
              onChange={(e) => setSelectedWeather(e.target.value as any)}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="calido">☀️ Cálido</option>
              <option value="templado">⛅ Templado</option>
              <option value="frio">❄️ Frío</option>
              <option value="lluvioso">🌧️ Lluvioso</option>
            </select>
          </div>

          {/* Formality select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ocasión</label>
            <select
              value={selectedFormality}
              onChange={(e) => setSelectedFormality(e.target.value as any)}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="casual">✨ Casual</option>
              <option value="trabajo">💼 Trabajo</option>
              <option value="formal">🍸 Formal</option>
              <option value="fiesta">🎉 Fiesta</option>
            </select>
          </div>
        </div>

        {/* Style select */}
        {allStyles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Estilo de Moda</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="todos">Todos los estilos</option>
              {allStyles.map(s => (
                <option key={s} value={s}>#{s}</option>
              ))}
            </select>
          </div>
        )}

        <button 
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <RefreshCw className={isGenerating ? 'animate-spin' : ''} size={18} />
          {isGenerating ? 'Combinando tu closet...' : 'Generar Outfit'}
        </button>
      </div>

      {/* Output Errors */}
      {noItemsError && (
        <div 
          className="glass-panel" 
          style={{ 
            color: 'var(--danger-color)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '0.9rem',
            borderColor: 'rgba(224, 122, 95, 0.3)',
            backgroundColor: 'rgba(224, 122, 95, 0.05)'
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{noItemsError}</span>
        </div>
      )}

      {/* Generated Outfit Canvas */}
      {hasOutfit && !noItemsError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
          
          <div 
            className="glass-panel" 
            style={{ 
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative'
            }}
          >
            {/* Collage Container */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: generatedOutfit.monoprenda ? '1fr' : '1fr 1fr', 
                gap: '12px',
              }}
            >
              {/* Monoprenda Item */}
              {generatedOutfit.monoprenda && (
                <OutfitItemCard 
                  label="Enterito / Vestido" 
                  item={generatedOutfit.monoprenda} 
                  onShuffle={() => handleShuffleItem('monoprenda')} 
                />
              )}

              {/* Top Item */}
              {generatedOutfit.superior && (
                <OutfitItemCard 
                  label="Prenda Superior" 
                  item={generatedOutfit.superior} 
                  onShuffle={() => handleShuffleItem('superior')} 
                />
              )}

              {/* Bottom Item */}
              {generatedOutfit.inferior && (
                <OutfitItemCard 
                  label="Prenda Inferior" 
                  item={generatedOutfit.inferior} 
                  onShuffle={() => handleShuffleItem('inferior')} 
                />
              )}
            </div>

            {/* Sub-row (Coat & Shoes) */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: generatedOutfit.abrigo ? '1fr 1fr' : '1fr', 
                gap: '12px' 
              }}
            >
              {/* Outerwear Coat */}
              {generatedOutfit.abrigo && (
                <OutfitItemCard 
                  label="Abrigo" 
                  item={generatedOutfit.abrigo} 
                  onShuffle={() => handleShuffleItem('abrigo')} 
                />
              )}

              {/* Calzado Shoes */}
              {generatedOutfit.calzado && (
                <OutfitItemCard 
                  label="Calzado" 
                  item={generatedOutfit.calzado} 
                  onShuffle={() => handleShuffleItem('calzado')} 
                />
              )}
            </div>

            {/* Accessory Row */}
            {generatedOutfit.accesorio && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginTop: '4px' }}>
                <OutfitItemCard 
                  label="Accesorio" 
                  item={generatedOutfit.accesorio} 
                  onShuffle={() => handleShuffleItem('accesorio')} 
                  isSmall
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleGenerate} 
              style={{ flex: 1 }}
              disabled={isGenerating}
            >
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

      {/* Save Dialog Overlay */}
      {showSaveDialog && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            backdropFilter: 'blur(4px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div 
            className="glass-panel pop-in" 
            style={{ 
              width: '100%', 
              maxWidth: '360px', 
              margin: 0, 
              backgroundColor: 'var(--bg-color)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="item-title" style={{ fontSize: '1.2rem', marginBottom: '12px', fontFamily: 'var(--font-serif)', fontWeight: 600 }}>Guardar Outfit</h3>
            
            {saveSuccess ? (
              <div 
                style={{ 
                  color: 'var(--success-color)', 
                  textAlign: 'center', 
                  padding: '20px 0', 
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Check size={32} /> ¡Añadido a tus Favoritos!
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Dale un nombre a este look (opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Look de Sábado, Cita de cumple..."
                    value={outfitName}
                    onChange={(e) => setOutfitName(e.target.value)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--panel-border)',
                      backgroundColor: 'rgba(255,255,255,0.8)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.95rem',
                      outline: 'none'
                    }}
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

// ----------------------------------------------------
// CHILD COMPONENT: OUTFIT ITEM CARD
// ----------------------------------------------------

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
      style={{ 
        flexDirection: isSmall ? 'row' : 'column',
        height: isSmall ? '80px' : 'auto',
        position: 'relative'
      }}
    >
      <div 
        className="prenda-img-container" 
        style={{ 
          aspectRatio: isSmall ? '1/1' : '3/4',
          width: isSmall ? '80px' : '100%',
        }}
      >
        <img src={item.image_url} alt={label} className="prenda-img" />
      </div>

      <div 
        className="prenda-info"
        style={{ 
          padding: isSmall ? '10px 12px' : '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isSmall ? 'center' : 'flex-start',
          flex: isSmall ? 1 : undefined
        }}
      >
        <span 
          className="prenda-category"
          style={{ 
            fontSize: '0.65rem', 
            fontWeight: 700, 
            letterSpacing: '0.03em',
            marginBottom: '2px'
          }}
        >
          {label}
        </span>
        
        {!isSmall && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
            {item.styles.slice(0, 1).map(s => (
              <span key={s} className="tag-badge" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                #{s}
              </span>
            ))}
            {item.colors.slice(0, 1).map(c => (
              <span 
                key={c} 
                className="tag-badge" 
                style={{ 
                  fontSize: '0.6rem', 
                  padding: '1px 4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '2px' 
                }}
              >
                <span 
                  style={{ 
                    display: 'inline-block', 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    backgroundColor: c,
                    border: c === '#FFFFFF' ? '1px solid #CCC' : undefined
                  }} 
                />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Category Swap/Shuffle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShuffle();
        }}
        style={{
          position: 'absolute',
          top: isSmall ? '50%' : '8px',
          right: '8px',
          transform: isSmall ? 'translateY(-50%)' : 'none',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '50%',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          transition: 'transform 0.2s ease, background-color 0.2s'
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = isSmall ? 'translateY(-50%) scale(0.9)' : 'scale(0.9)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = isSmall ? 'translateY(-50%) scale(1)' : 'scale(1)';
        }}
        title="Cambiar esta prenda"
      >
        <RefreshCw size={13} />
      </button>
    </div>
  );
}
