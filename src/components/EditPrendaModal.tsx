import { useState } from 'react';
import type { FormEvent } from 'react';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';
import { updatePrenda } from '../lib/db';
import { CATEGORIES, CLIMAS, FORMALITIES, PRESET_STYLES } from '../lib/prendaOptions';
import { ColorPickerRow } from './ColorPickerRow';
import type { Prenda, Clima } from '../types';

interface EditPrendaModalProps {
  prenda: Prenda;
  onClose: () => void;
  onSaved: () => void;
}

// Edits a garment already in the closet: its name and characteristics (category,
// clima, formality, colours, styles). The photo itself is not changed here.
export function EditPrendaModal({ prenda, onClose, onSaved }: EditPrendaModalProps) {
  const [nombre,          setNombre]          = useState(prenda.nombre ?? '');
  const [category,        setCategory]        = useState<Prenda['category']>(prenda.category);
  const [clima,           setClima]           = useState<Clima[]>(prenda.clima);
  const [formality,       setFormality]       = useState<Prenda['formality']>(prenda.formality);
  const [primaryColors,   setPrimaryColors]   = useState<string[]>(prenda.primary_colors ?? []);
  const [secondaryColors, setSecondaryColors] = useState<string[]>(prenda.secondary_colors ?? []);
  const [selectedStyles,  setSelectedStyles]  = useState<string[]>(prenda.styles ?? []);
  const [customStyle,     setCustomStyle]     = useState('');
  const [isSaving,        setIsSaving]        = useState(false);
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null);

  const toggleClima = (value: Clima) =>
    setClima(prev => prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]);
  const togglePrimaryColor = (hex: string) =>
    setPrimaryColors(prev => prev.includes(hex) ? prev.filter(c => c !== hex) : [...prev, hex]);
  const toggleSecondaryColor = (hex: string) =>
    setSecondaryColors(prev => prev.includes(hex) ? prev.filter(c => c !== hex) : [...prev, hex]);
  const toggleStyle = (style: string) =>
    setSelectedStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]);

  const handleAddCustomStyle = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = customStyle.trim();
    if (trimmed && !selectedStyles.includes(trimmed)) {
      setSelectedStyles(prev => [...prev, trimmed]);
    }
    setCustomStyle('');
  };

  const handleSave = async () => {
    if (clima.length === 0) {
      setErrorMsg('Elegí al menos un clima.');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const colors = Array.from(new Set([...primaryColors, ...secondaryColors]));
      await updatePrenda(prenda.id, {
        nombre: nombre.trim() || undefined,
        category,
        clima,
        formality,
        styles: selectedStyles,
        colors,
        primary_colors: primaryColors,
        secondary_colors: secondaryColors,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel pop-in"
        style={{
          width: 'min(440px, 94vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '20px 16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Editar prenda</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Garment thumbnail (read-only) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <img
            src={prenda.image_url}
            alt={nombre || prenda.category}
            style={{ width: '96px', height: '96px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', background: 'var(--bg-color)' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: isSaving ? 0.55 : 1, pointerEvents: isSaving ? 'none' : 'auto', transition: 'opacity 0.3s ease' }}>
          {/* Nombre */}
          <div className="form-group">
            <label className="form-label">Nombre (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Vestido negro Ruby"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <div className="chip-container">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    className={`chip ${category === cat.value ? 'selected' : ''}`}
                    onClick={() => setCategory(cat.value)}
                    title={cat.hint}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icon size={15} /> {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clima */}
          <div className="form-group">
            <label className="form-label">Clima (uno o varios)</label>
            <div className="chip-container">
              {CLIMAS.map(item => (
                <button
                  key={item.value}
                  type="button"
                  className={`chip ${clima.includes(item.value) ? 'selected' : ''}`}
                  onClick={() => toggleClima(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Formality */}
          <div className="form-group">
            <label className="form-label">Ocasión</label>
            <div className="chip-container">
              {FORMALITIES.map(item => (
                <button
                  key={item.value}
                  type="button"
                  className={`chip ${formality === item.value ? 'selected' : ''}`}
                  onClick={() => setFormality(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="form-group">
            <label className="form-label">Color Principal</label>
            <ColorPickerRow selected={primaryColors} onToggle={togglePrimaryColor} />
          </div>
          <div className="form-group">
            <label className="form-label">Color Secundario</label>
            <ColorPickerRow selected={secondaryColors} onToggle={toggleSecondaryColor} />
          </div>

          {/* Styles */}
          <div className="form-group">
            <label className="form-label">Estilo / Tags</label>
            <div className="chip-container" style={{ marginBottom: '8px' }}>
              {PRESET_STYLES.map(style => (
                <button
                  key={style}
                  type="button"
                  className={`chip ${selectedStyles.includes(style) ? 'selected' : ''}`}
                  onClick={() => toggleStyle(style)}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  #{style}
                </button>
              ))}
              {selectedStyles.filter(s => !PRESET_STYLES.includes(s)).map(style => (
                <button
                  key={style}
                  type="button"
                  className="chip selected"
                  onClick={() => toggleStyle(style)}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  #{style}
                </button>
              ))}
            </div>
            <form onSubmit={handleAddCustomStyle} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Ej: Vintage, Y2K"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--panel-border)', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.9rem', outline: 'none' }}
              />
              <button type="submit" className="btn btn-secondary" style={{ width: 'auto', padding: '0 16px', borderRadius: 'var(--radius-sm)' }}>
                Agregar
              </button>
            </form>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div
            className="fade-in"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(224, 122, 95, 0.35)', backgroundColor: 'rgba(224, 122, 95, 0.07)', color: 'var(--danger-color)', fontSize: '0.88rem', lineHeight: '1.45' }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>
            {isSaving ? (
              <><Loader2 className="animate-spin" size={18} /> Guardando…</>
            ) : (
              <><Check size={18} /> Guardar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
