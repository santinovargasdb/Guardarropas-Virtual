import { useState } from 'react';
import { Trash2, Heart, Award } from 'lucide-react';
import type { Prenda, OutfitFavorito } from '../types';
import { deleteOutfitFavorito } from '../lib/db';

interface FavoritesViewProps {
  favorites: OutfitFavorito[];
  allItems: Prenda[];
  onRefresh: () => void;
}

export function FavoritesView({ favorites, allItems, onRefresh }: FavoritesViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Segura de que quieres eliminar esta combinación de tus favoritos?')) {
      setDeletingId(id);
      try {
        await deleteOutfitFavorito(id);
        onRefresh();
      } catch (err) {
        console.error(err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // Helper to map item IDs to full Prenda objects
  const getPrendaById = (id: string): Prenda | undefined => {
    return allItems.find(item => item.id === id);
  };

  return (
    <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Combinaciones Favoritas</h2>
      <p className="subtitle">Tus looks guardados para ocasiones especiales</p>

      {favorites.length === 0 ? (
        <div 
          className="glass-panel" 
          style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginTop: '20px'
          }}
        >
          <Heart size={40} style={{ strokeWidth: 1.5, opacity: 0.5, color: 'var(--danger-color)' }} />
          <p style={{ fontWeight: 500 }}>Aún no tienes outfits favoritos</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>¡Genera combinaciones en la pestaña "Combinar" y guárdalas con un corazón!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {favorites.map(favorite => {
            const mappedItems = favorite.items
              .map(itemId => getPrendaById(itemId))
              .filter((item): item is Prenda => !!item);

            return (
              <div 
                key={favorite.id} 
                className="glass-panel pop-in"
                style={{ 
                  padding: '16px',
                  opacity: deletingId === favorite.id ? 0.5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} style={{ color: 'var(--accent-color)' }} />
                    <h3 className="item-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 600 }}>
                      {favorite.name || 'Outfit Favorito'}
                    </h3>
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(favorite.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      borderRadius: '50%',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(224, 122, 95, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Eliminar favorito"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Outfit Row Collage Preview */}
                <div 
                  style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    scrollbarWidth: 'none'
                  }}
                >
                  {mappedItems.map(item => (
                    <div 
                      key={item.id}
                      style={{
                        width: '72px',
                        height: '96px',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid var(--panel-border)',
                        backgroundColor: 'var(--accent-light)',
                        position: 'relative'
                      }}
                    >
                      <img 
                        src={item.image_url} 
                        alt={item.category} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      
                      {/* Short Category Overlay indicator */}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: '100%',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          textAlign: 'center',
                          color: 'white',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          padding: '2px 0'
                        }}
                      >
                        {item.category === 'superior' ? 'top' : item.category === 'inferior' ? 'bot' : item.category === 'abrigo' ? 'coat' : item.category === 'calzado' ? 'shoe' : item.category === 'monoprenda' ? 'one' : 'acc'}
                      </span>
                    </div>
                  ))}
                  
                  {mappedItems.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Las prendas de esta combinación fueron eliminadas del armario.
                    </p>
                  )}
                </div>
                
                {/* Date */}
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Guardado el {new Date(favorite.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
