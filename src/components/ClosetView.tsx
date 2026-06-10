import { useState, useEffect, useRef } from 'react';
import { Trash2, ShoppingBag, Sparkles, Shirt, RectangleHorizontal, PersonStanding, Layers, Footprints, LayoutGrid, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Prenda } from '../types';
import { deletePrenda } from '../lib/db';

interface ClosetViewProps {
  items: Prenda[];
  onRefresh: () => void;
}

const CATEGORY_TABS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'todos',      label: 'Todos',      icon: LayoutGrid },
  { value: 'superior',   label: 'Tops',       icon: Shirt },
  { value: 'inferior',   label: 'Bottoms',    icon: RectangleHorizontal },
  { value: 'full_body',  label: 'Enteros',    icon: PersonStanding },
  { value: 'abrigo',     label: 'Abrigos',    icon: Layers },
  { value: 'calzado',    label: 'Calzado',    icon: Footprints },
  { value: 'accesorios', label: 'Accesorios', icon: Sparkles },
  { value: 'carteras',   label: 'Carteras',   icon: ShoppingBag },
];

const CATEGORY_LABEL: Record<Prenda['category'], string> = {
  superior:   'Prenda Superior',
  inferior:   'Prenda Inferior',
  full_body:  'Prenda Entera',
  abrigo:     'Abrigo',
  calzado:    'Calzado',
  accesorios: 'Accesorio',
  carteras:   'Carteras',
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

      {/* ── Category filter dropdown ── */}
      <CategoryDropdown
        tabs={CATEGORY_TABS}
        activeTab={activeTab}
        getCount={getCount}
        onSelect={setActiveTab}
      />

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

// ── Child component: Category Dropdown (replaces the horizontal filter strip) ──

interface CategoryDropdownProps {
  tabs: { value: string; label: string; icon: LucideIcon }[];
  activeTab: string;
  getCount: (value: string) => number;
  onSelect: (value: string) => void;
}

function CategoryDropdown({ tabs, activeTab, getCount, onSelect }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside the dropdown
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const active = tabs.find(t => t.value === activeTab) ?? tabs[0];
  const ActiveIcon = active.icon;

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: '16px' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${open ? 'var(--accent-color)' : 'var(--panel-border)'}`,
          backgroundColor: 'var(--panel-bg)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.9rem',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'border-color 0.2s ease',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
          <ActiveIcon size={17} style={{ color: 'var(--accent-color)' }} />
          {active.label}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>({getCount(active.value)})</span>
        </span>
        <ChevronDown
          size={18}
          style={{
            color: 'var(--text-secondary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Options panel */}
      {open && (
        <div
          role="listbox"
          className="pop-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 50,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--panel-border)',
            backgroundColor: 'var(--bg-color)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => { onSelect(tab.value); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '11px 12px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'rgba(212, 163, 115, 0.14)' : 'transparent',
                  color: isActive ? 'var(--accent-color)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--accent-light)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Icon size={16} style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{tab.label}</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.65 }}>({getCount(tab.value)})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
