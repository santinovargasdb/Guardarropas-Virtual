import { useState } from 'react';
import { Trash2, ShoppingBag, Sparkles } from 'lucide-react';
import type { Prenda } from '../types';
import { deletePrenda } from '../lib/db';

interface ClosetViewProps {
  items: Prenda[];
  onRefresh: () => void;
}

const CATEGORY_TABS = [
  { value: 'todos',    label: 'Todos' },
  { value: 'superior', label: 'Tops' },
  { value: 'inferior', label: 'Bottoms' },
  { value: 'abrigo',   label: 'Abrigos' },
  { value: 'calzado',  label: 'Calzado' },
];

const CATEGORY_LABEL: Record<Prenda['category'], string> = {
  superior: 'Prenda Superior',
  inferior: 'Prenda Inferior',
  abrigo:   'Abrigo',
  calzado:  'Calzado',
};

export function ClosetView({ items, onRefresh }: ClosetViewProps) {
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Count per tab — computed inline, array is small so no useMemo needed
  const getCount = (category: string) =>
    category === 'todos'
      ? items.length
      : items.filter(i => i.category === category).length;

  const filteredItems = activeTab === 'todos'
    ? items
    : items.filter(item => item.category === activeTab);

  const activeTabLabel = CATEGORY_TABS.find(t => t.value === activeTab)?.label ?? 'prendas';

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás segura de que querés eliminar esta prenda de tu guardarropas?')) {
      setDeletingId(id);
      try {
        await deletePrenda(id);
        onRefresh();
      } catch (err) {
        console.error(err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Mi Armario</h2>
      <p className="subtitle">
        {activeTab === 'todos'
          ? `${items.length} ${items.length === 1 ? 'prenda registrada' : 'prendas registradas'}`
          : `${filteredItems.length} de ${items.length} prendas · ${activeTabLabel}`}
      </p>

      {/* ── Category filter strip (horizontal scroll, mobile-friendly) ── */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '8px',
          paddingBottom: '12px',
          marginBottom: '16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {CATEGORY_TABS.map(tab => {
          const count = getCount(tab.value);
          return (
            <button
              key={tab.value}
              className={`chip ${activeTab === tab.value ? 'selected' : ''}`}
              onClick={() => setActiveTab(tab.value)}
              style={{ flexShrink: 0, padding: '8px 14px', fontSize: '0.83rem', whiteSpace: 'nowrap' }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Closet Grid ── */}
      {filteredItems.length === 0 ? (
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
            marginTop: '20px',
          }}
        >
          <ShoppingBag size={40} style={{ strokeWidth: 1.5, opacity: 0.45 }} />
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {activeTab === 'todos'
              ? 'Tu armario está vacío'
              : `No tenés ${activeTabLabel.toLowerCase()} cargados`}
          </p>
          <p style={{ fontSize: '0.85rem', opacity: 0.75, lineHeight: '1.4' }}>
            {activeTab === 'todos'
              ? 'Tocá "Cargar" para agregar tu primera prenda.'
              : 'Cambiá el filtro o subí prendas de esta categoría desde "Cargar".'}
          </p>
        </div>
      ) : (
        <div className="closet-grid">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="prenda-card pop-in"
              style={{ opacity: deletingId === item.id ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
            >
              <div className="prenda-img-container">
                <img
                  src={item.image_url}
                  alt={CATEGORY_LABEL[item.category]}
                  className="prenda-img"
                  loading="lazy"
                />
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(item.id)}
                  title="Eliminar prenda"
                  disabled={deletingId === item.id}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="prenda-info">
                <span className="prenda-category">{CATEGORY_LABEL[item.category]}</span>

                <div className="prenda-tags">
                  <span
                    className="tag-badge"
                    style={{ backgroundColor: 'rgba(212, 163, 115, 0.1)', color: 'var(--accent-color)' }}
                  >
                    {item.clima}
                  </span>
                  <span className="tag-badge">{item.formality}</span>
                  {item.styles.slice(0, 2).map(s => (
                    <span key={s} className="tag-badge" style={{ fontStyle: 'italic' }}>#{s}</span>
                  ))}
                </div>

                {/* ── Color swatches ── */}
                {item.colors.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    {item.colors.slice(0, 5).map((c, idx) => (
                      <span
                        key={`${c}-${idx}`}
                        title={c}
                        style={{
                          width: '13px',
                          height: '13px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* ── IA Metadata ── */}
                <div
                  style={{
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px dashed rgba(212, 163, 115, 0.22)',
                  }}
                >
                  {item.tags_ia && item.tags_ia.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                      <Sparkles size={8} style={{ color: 'var(--accent-color)', opacity: 0.75, flexShrink: 0 }} />
                      {item.tags_ia.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.55rem',
                            padding: '1px 5px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(212, 163, 115, 0.1)',
                            color: 'var(--accent-color)',
                            fontWeight: 500,
                            letterSpacing: '0.01em',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags_ia.length > 3 && (
                        <span style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                          +{item.tags_ia.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: '0.55rem',
                        color: 'var(--text-secondary)',
                        opacity: 0.5,
                        fontStyle: 'italic',
                        letterSpacing: '0.01em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Sparkles size={8} style={{ opacity: 0.6 }} />
                      Smart Tag Ready
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
