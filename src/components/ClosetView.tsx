import { useState } from 'react';
import { Trash2, ShoppingBag } from 'lucide-react';
import type { Prenda } from '../types';
import { deletePrenda } from '../lib/db';

interface ClosetViewProps {
  items: Prenda[];
  onRefresh: () => void;
}

const CATEGORY_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'superior', label: 'Tops' },
  { value: 'inferior', label: 'Bottoms' },
  { value: 'abrigo', label: 'Abrigos' },
  { value: 'calzado', label: 'Calzado' },
  { value: 'monoprenda', label: 'Monoprendas' },
  { value: 'accesorio', label: 'Accesorios' },
];

export function ClosetView({ items, onRefresh }: ClosetViewProps) {
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredItems = activeTab === 'todos' 
    ? items 
    : items.filter(item => item.category === activeTab);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás segura de que quieres eliminar esta prenda de tu guardarropas?')) {
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

  const getCategoryLabel = (cat: Prenda['category']) => {
    switch(cat) {
      case 'superior': return 'Prenda Superior';
      case 'inferior': return 'Prenda Inferior';
      case 'abrigo': return 'Abrigo';
      case 'calzado': return 'Calzado';
      case 'monoprenda': return 'Monoprenda';
      case 'accesorio': return 'Accesorio';
      default: return cat;
    }
  };

  return (
    <div className="slide-up fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Mi Armario</h2>
      <p className="subtitle">Explora tus {items.length} prendas registradas</p>

      {/* Category Tabs */}
      <div 
        style={{ 
          display: 'flex', 
          overflowX: 'auto', 
          gap: '8px', 
          paddingBottom: '12px',
          marginBottom: '16px',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.value}
            className={`chip ${activeTab === tab.value ? 'selected' : ''}`}
            onClick={() => setActiveTab(tab.value)}
            style={{ 
              flexShrink: 0,
              padding: '8px 16px',
              fontSize: '0.85rem'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Closet Grid */}
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
            marginTop: '20px'
          }}
        >
          <ShoppingBag size={40} style={{ strokeWidth: 1.5, opacity: 0.5 }} />
          <p style={{ fontWeight: 500 }}>No hay prendas en esta categoría</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>¡Ve a la pestaña "Cargar" para empezar a armar tu guardarropas!</p>
        </div>
      ) : (
        <div className="closet-grid">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className="prenda-card pop-in"
              style={{ opacity: deletingId === item.id ? 0.5 : 1 }}
            >
              <div className="prenda-img-container">
                <img 
                  src={item.image_url} 
                  alt={item.category} 
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
                <span className="prenda-category">{getCategoryLabel(item.category)}</span>
                
                <div className="prenda-tags">
                  {/* Weather tags */}
                  {item.weather.map(w => (
                    <span key={w} className="tag-badge" style={{ backgroundColor: 'rgba(212, 163, 115, 0.1)', color: 'var(--accent-color)' }}>
                      {w === 'calido' ? 'calido' : w === 'frio' ? 'frio' : w === 'templado' ? 'templado' : 'lluvioso'}
                    </span>
                  ))}
                  
                  {/* Formality tags */}
                  {item.formality.map(f => (
                    <span key={f} className="tag-badge">
                      {f}
                    </span>
                  ))}

                  {/* Custom styles tags */}
                  {item.styles.slice(0, 2).map(s => (
                    <span key={s} className="tag-badge" style={{ fontStyle: 'italic' }}>
                      #{s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
