import type { CSSProperties } from 'react';

function Block({ style }: { style?: CSSProperties }) {
  return <div className="skeleton-block" style={style} />;
}

// ── Closet Skeleton ────────────────────────────────────────────────────────
// Mirrors ClosetView: chip strip + 2-column grid with 3:4 cards + IA section
export function ClosetSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Block style={{ width: '160px', height: '28px', margin: '0 auto 10px' }} />
      <Block style={{ width: '110px', height: '15px', margin: '0 auto 24px' }} />

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', marginBottom: '16px', overflow: 'hidden' }}>
        {[72, 56, 78, 70, 62].map((w, i) => (
          <Block key={i} style={{ width: `${w}px`, height: '36px', borderRadius: '20px', flexShrink: 0 }} />
        ))}
      </div>

      {/* 2-column card grid */}
      <div className="closet-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="prenda-card">
            {/* 3:4 image area */}
            <div className="skeleton-block prenda-img-container" />
            {/* Info section */}
            <div className="prenda-info">
              <Block style={{ width: '65%', height: '10px', marginBottom: '8px' }} />
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {[38, 46, 30].map((w, j) => (
                  <Block key={j} style={{ width: `${w}px`, height: '9px', borderRadius: '10px' }} />
                ))}
              </div>
              {/* IA tags dashed section */}
              <div style={{ borderTop: '1px dashed rgba(212, 163, 115, 0.22)', paddingTop: '6px' }}>
                <Block style={{ width: '52%', height: '8px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Favorites Skeleton ─────────────────────────────────────────────────────
// Mirrors FavoritesView: 2 lookbook cards with header + thumbnail strip
export function FavoritesSkeleton() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Block style={{ width: '180px', height: '28px', margin: '0 auto 10px' }} />
      <Block style={{ width: '110px', height: '15px', margin: '0 auto 24px' }} />

      {[3, 4].map((thumbCount, i) => (
        <div
          key={i}
          className="glass-panel"
          style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}
        >
          {/* Card header */}
          <div
            style={{
              padding: '14px 8px 10px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '4px',
            }}
          >
            <div>
              <Block style={{ width: '130px', height: '17px', marginBottom: '7px' }} />
              <Block style={{ width: '80px', height: '11px' }} />
            </div>
            {/* Delete button placeholder */}
            <Block style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
          </div>

          {/* Lookbook thumbnail strip */}
          <div style={{ display: 'flex', gap: '10px', padding: '0 16px 16px' }}>
            {Array.from({ length: thumbCount }).map((_, j) => (
              <div
                key={j}
                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}
              >
                <Block style={{ width: '82px', height: '110px', borderRadius: 'var(--radius-sm)' }} />
                <Block style={{ width: '50px', height: '8px' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
