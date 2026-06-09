import { useState } from 'react';
import { Trash2, Heart, Sparkles, AlertCircle } from 'lucide-react';
import type { Prenda, OutfitFavorito } from '../types';
import { deleteOutfitFavorito } from '../lib/db';

interface FavoritesViewProps {
  favorites: OutfitFavorito[];
  allItems: Prenda[];
  onRefresh: () => void;
  onNavigateToCombinar?: () => void;
}

const CATEGORY_LABEL: Record<Prenda['category'], string> = {
  superior:   'Top',
  inferior:   'Bottom',
  full_body:  'Entero',
  abrigo:     'Abrigo',
  calzado:    'Calzado',
  accesorios: 'Acc.',
  carteras:   'Cartera',
};

export function FavoritesView({ favorites, allItems, onRefresh, onNavigateToCombinar }: FavoritesViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Segura de que querés eliminar este look de tus favoritos?')) {
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

  // ── Empty state ────────────────────────────────────────────────────────
  if (favorites.length === 0) {
    return (
      <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Looks Favoritos</h2>
        <p className="subtitle">Tu lookbook personal</p>

        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '52px 24px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            marginTop: '20px',
          }}
        >
          <Heart
            size={52}
            style={{ strokeWidth: 1.2, opacity: 0.25, color: 'var(--danger-color)' }}
          />
          <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            Todavía no guardaste ningún outfit
          </p>
          <p style={{ fontSize: '0.88rem', opacity: 0.6, lineHeight: '1.55', maxWidth: '260px' }}>
            Probá el generador y dale amor a tus combinaciones favoritas.
          </p>
          {onNavigateToCombinar && (
            <button className="btn btn-secondary" onClick={onNavigateToCombinar} style={{ width: 'auto', marginTop: '4px' }}>
              <Sparkles size={15} />
              Ir al generador
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Lookbook list ──────────────────────────────────────────────────────
  return (
    <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Looks Favoritos</h2>
      <p className="subtitle">
        {favorites.length} {favorites.length === 1 ? 'look guardado' : 'looks guardados'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {favorites.map(favorite => {
          // Reconstruct Prenda objects — filter safely drops deleted items
          const mappedItems = favorite.items
            .map(id => allItems.find(p => p.id === id))
            .filter((p): p is Prenda => p !== undefined);

          const deletedCount = favorite.items.length - mappedItems.length;

          const dateLabel = new Date(favorite.created_at).toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
          });

          return (
            <div
              key={favorite.id}
              className="glass-panel pop-in"
              style={{
                padding: 0,
                overflow: 'hidden',
                opacity: deletingId === favorite.id ? 0.45 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* ── Card header ─────────────────────────────────────── */}
              <div
                style={{
                  padding: '14px 8px 10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '3px',
                    }}
                  >
                    <Sparkles size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                    <h3
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {favorite.name || 'Outfit Favorito'}
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {mappedItems.length} {mappedItems.length === 1 ? 'prenda' : 'prendas'} · {dateLabel}
                  </span>
                </div>

                {/* Delete button — 48×48 touch target for comfortable mobile tap */}
                <button
                  onClick={() => handleDelete(favorite.id)}
                  disabled={deletingId === favorite.id}
                  title="Eliminar este look"
                  style={{
                    flexShrink: 0,
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    borderRadius: '50%',
                    color: 'var(--danger-color)',
                    opacity: 0.65,
                    cursor: 'pointer',
                    transition: 'opacity 0.18s ease, background-color 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.backgroundColor = 'rgba(224, 122, 95, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.65';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>

              {/* ── Lookbook strip ──────────────────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  padding: '0 16px 16px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {mappedItems.length > 0 ? (
                  mappedItems.map(item => (
                    <div
                      key={item.id}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      {/* 3:4 fashion-photo ratio thumbnail */}
                      <div
                        style={{
                          width: '82px',
                          height: '110px',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: '1px solid var(--panel-border)',
                          backgroundColor: 'var(--accent-light)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                        }}
                      >
                        <img
                          src={item.image_url}
                          alt={CATEGORY_LABEL[item.category]}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      </div>

                      {/* Category label below the thumbnail */}
                      <span
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-secondary)',
                          opacity: 0.8,
                        }}
                      >
                        {CATEGORY_LABEL[item.category]}
                      </span>
                    </div>
                  ))
                ) : (
                  // All prendas from this outfit were deleted
                  <p
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      padding: '8px 0 4px',
                    }}
                  >
                    Las prendas de este outfit ya no están en tu armario.
                  </p>
                )}
              </div>

              {/* ── Deleted-items warning (partial deletion) ─────────── */}
              {deletedCount > 0 && mappedItems.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 16px',
                    borderTop: '1px solid var(--panel-border)',
                    backgroundColor: 'rgba(212, 163, 115, 0.06)',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <AlertCircle size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                  <span>
                    {deletedCount === 1
                      ? '1 prenda de este look fue eliminada del armario'
                      : `${deletedCount} prendas de este look fueron eliminadas del armario`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
