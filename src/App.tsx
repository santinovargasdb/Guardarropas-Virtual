import { useState, useEffect } from 'react';
import { PlusCircle, Shirt, Sparkles, Heart, Info } from 'lucide-react';
import { getPrendas, getOutfitsFavoritos } from './lib/db';
import { isSupabaseConfigured } from './lib/supabase';
import type { Prenda, OutfitFavorito } from './types';
import { UploadForm } from './components/UploadForm';
import { ClosetView } from './components/ClosetView';
import { GeneratorView } from './components/GeneratorView';
import { FavoritesView } from './components/FavoritesView';
import { ClosetSkeleton, FavoritesSkeleton } from './components/SkeletonLoader';
import './App.css';

type Tab = 'armario' | 'cargar' | 'combinar' | 'favoritos';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('combinar');
  const [prendas, setPrendas] = useState<Prenda[]>([]);
  const [favorites, setFavorites] = useState<OutfitFavorito[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all items and favorites
  const loadData = async () => {
    setIsLoading(true);
    try {
      const p = await getPrendas();
      const f = await getOutfitsFavoritos();
      setPrendas(p);
      setFavorites(f);
    } catch (err) {
      console.error('Error loading data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData();
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header style={{ padding: '24px 20px 8px', borderBottom: '1px solid var(--panel-border)', background: 'var(--panel-bg)' }}>
        <h1 className="brand-title">Gigi's Closet</h1>
        <p className="subtitle" style={{ margin: 0 }}>Mi Placard Virtual</p>
      </header>

      {/* Database Connection / Offline Mode banner */}
      {!isSupabaseConfigured && (
        <div 
          style={{
            backgroundColor: 'rgba(212, 163, 115, 0.1)',
            borderBottom: '1px solid var(--panel-border)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}
        >
          <Info size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          <span>Modo Demo (LocalStorage) • Agrega tus claves de Supabase en `.env` para la nube</span>
        </div>
      )}

      {/* Main app panel */}
      <main className="app-content">
        {isLoading ? (
          <>
            {activeTab === 'armario'   && <ClosetSkeleton />}
            {activeTab === 'favoritos' && <FavoritesSkeleton />}
            {(activeTab === 'cargar' || activeTab === 'combinar') && (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                Cargando...
              </div>
            )}
          </>
        ) : (
          <>
            {activeTab === 'cargar' && (
              <UploadForm onSuccess={() => {
                handleRefresh();
                setActiveTab('armario'); // Switch to closet to see uploaded item
              }} />
            )}
            
            {activeTab === 'armario' && (
              <ClosetView items={prendas} onRefresh={handleRefresh} />
            )}
            
            {activeTab === 'combinar' && (
              <GeneratorView items={prendas} onFavoriteSaved={handleRefresh} />
            )}
            
            {activeTab === 'favoritos' && (
              <FavoritesView favorites={favorites} allItems={prendas} onRefresh={handleRefresh} onNavigateToCombinar={() => setActiveTab('combinar')} />
            )}
          </>
        )}
      </main>

      {/* Fixed bottom navigation */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'armario' ? 'active' : ''}`}
          onClick={() => setActiveTab('armario')}
        >
          <Shirt />
          <span>Armario</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'cargar' ? 'active' : ''}`}
          onClick={() => setActiveTab('cargar')}
        >
          <PlusCircle />
          <span>Cargar</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'combinar' ? 'active' : ''}`}
          onClick={() => setActiveTab('combinar')}
        >
          <Sparkles />
          <span>Combinar</span>
        </button>

        <button 
          className={`nav-item ${activeTab === 'favoritos' ? 'active' : ''}`}
          onClick={() => setActiveTab('favoritos')}
        >
          <Heart />
          <span>Favoritos</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
