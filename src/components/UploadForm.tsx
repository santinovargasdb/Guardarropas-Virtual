import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Camera, Image as ImageIcon, Check, Loader2, Sparkles, AlertCircle, Shirt, RectangleHorizontal, PersonStanding, Layers, Footprints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { insertPrenda, uploadPrendaImage } from '../lib/db';
import { compressImage, isAllowedImageType } from '../utils/image';
import type { Prenda } from '../types';

interface UploadFormProps {
  onSuccess: () => void;
}

// 20 MB raw input guard — protects against accidental RAW / video files
const MAX_RAW_BYTES        = 20 * 1024 * 1024;
// 150 KB post-compression cap — keeps free-tier Supabase & LocalStorage healthy
const MAX_COMPRESSED_BYTES = 150 * 1024;

const CATEGORIES: { value: Prenda['category']; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'superior',   label: 'Superior',   hint: 'Remera, Camisa, Suéter',       icon: Shirt },
  { value: 'inferior',   label: 'Inferior',   hint: 'Pantalón, Jean, Pollera',      icon: RectangleHorizontal },
  { value: 'full_body',  label: 'Full Body',  hint: 'Vestido, Mono, Enterito',      icon: PersonStanding },
  { value: 'abrigo',     label: 'Abrigo',     hint: 'Campera, Tapado, Blazer',      icon: Layers },
  { value: 'calzado',    label: 'Calzado',    hint: 'Zapatillas, Botas, Sandalias', icon: Footprints },
  { value: 'accesorios', label: 'Accesorios', hint: 'Joyas, Bolsos, Complementos',  icon: Sparkles },
];

const CLIMAS: { value: Prenda['clima']; label: string }[] = [
  { value: 'calor',    label: '☀️ Calor' },
  { value: 'templado', label: '⛅ Templado' },
  { value: 'frio',     label: '❄️ Frío' },
];

const FORMALITIES: { value: Prenda['formality']; label: string }[] = [
  { value: 'casual',    label: '✨ Casual' },
  { value: 'formal',    label: '💼 Formal / Trabajo' },
  { value: 'deportivo', label: '🏃 Deportivo' },
];

// Official preset styles for Luci's Closet — exact casing is intentional.
const PRESET_STYLES = [
  'Jirai', 'Gotico', 'Soft', 'Cute core', 'Chill', 'Boliche',
];

const PRESETS_COLORS = [
  { name: 'Negro',    hex: '#1A1A1A' },
  { name: 'Blanco',   hex: '#FFFFFF', hasBorder: true },
  { name: 'Gris',     hex: '#8E918F' },
  { name: 'Crema',    hex: '#F3E5AB' },
  { name: 'Marrón',   hex: '#704214' },
  { name: 'Azul',     hex: '#2A52BE' },
  { name: 'Celeste',  hex: '#87CEEB' },
  { name: 'Verde',    hex: '#2E8B57' },
  { name: 'Bordeaux', hex: '#800020' },
  { name: 'Rosa',     hex: '#FFC0CB' },
  { name: 'Mostaza',  hex: '#E1AD01' },
];

const LIGHT_SWATCHES = new Set(['#FFFFFF', '#F3E5AB', '#FFC0CB', '#87CEEB', '#E1AD01']);

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [selectedImage,  setSelectedImage]  = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [category,       setCategory]       = useState<Prenda['category']>('superior');
  const [clima,          setClima]          = useState<Prenda['clima']>('templado');
  const [formality,      setFormality]      = useState<Prenda['formality']>('casual');
  const [primaryColors,   setPrimaryColors]   = useState<string[]>([]);
  const [secondaryColors, setSecondaryColors] = useState<string[]>([]);
  const [selectedStyles,  setSelectedStyles]  = useState<string[]>([]);
  const [customStyle,    setCustomStyle]    = useState('');
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadSuccess,  setUploadSuccess]  = useState(false);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);

  const fileInputRef      = useRef<HTMLInputElement>(null);
  const cameraInputRef    = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup success flash timeout on unmount to prevent memory leaks on mobile
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setCategory('superior');
    setClima('templado');
    setFormality('casual');
    setPrimaryColors([]);
    setSecondaryColors([]);
    setSelectedStyles([]);
    setCustomStyle('');
    setErrorMsg(null);
    if (fileInputRef.current)   fileInputRef.current.value   = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedImageType(file)) {
      setErrorMsg('Formato no válido. Por favor usá una foto en JPEG, PNG o WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setErrorMsg(
        `La foto pesa ${Math.round(file.size / (1024 * 1024))} MB y supera el límite de 20 MB. ` +
        'Tomá la foto directamente con la cámara o elegí otra imagen.'
      );
      e.target.value = '';
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadSuccess(false);
    setErrorMsg(null);
  };

  const togglePrimaryColor = (hex: string) =>
    setPrimaryColors(prev => prev.includes(hex) ? prev.filter(c => c !== hex) : [...prev, hex]);

  const toggleSecondaryColor = (hex: string) =>
    setSecondaryColors(prev => prev.includes(hex) ? prev.filter(c => c !== hex) : [...prev, hex]);

  const toggleStyle = (style: string) =>
    setSelectedStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]);

  const handleAddCustomStyle = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Preserve the user's exact casing (e.g. "Vintage", "Y2K") so custom
    // styles read consistently with the official preset list.
    const trimmed = customStyle.trim();
    if (trimmed && !selectedStyles.includes(trimmed)) {
      setSelectedStyles(prev => [...prev, trimmed]);
    }
    setCustomStyle('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedImage) {
      setErrorMsg('Por favor seleccioná o tomá una foto de la prenda.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      // Step 1 — Canvas compression (900×900 max, JPEG 0.75)
      const compressed = await compressImage(selectedImage);

      // Step 2 — Post-compression size gate
      if (compressed.size > MAX_COMPRESSED_BYTES) {
        setErrorMsg(
          `La imagen comprimida pesa ${Math.round(compressed.size / 1024)} KB ` +
          `y supera el límite de 150 KB. Probá con una foto con menos detalle o mejor iluminación.`
        );
        return;
      }

      // Step 3 — Upload to Supabase Storage or encode to Base64 for LocalStorage
      const imageUrl = await uploadPrendaImage(compressed);

      // Step 4 — Persist garment metadata. `colors` is the deduped union of both
      // palettes so the generator's chromatic triage can read one flat list.
      const colors = Array.from(new Set([...primaryColors, ...secondaryColors]));
      await insertPrenda({
        image_url: imageUrl,
        category,
        clima,
        formality,
        styles: selectedStyles,
        colors,
        primary_colors: primaryColors,
        secondary_colors: secondaryColors,
      });

      resetForm();
      setUploadSuccess(true);

      // Switch to closet view after a brief success flash
      successTimeoutRef.current = setTimeout(() => {
        setUploadSuccess(false);
        onSuccess();
        successTimeoutRef.current = null;
      }, 1800);

    } catch (err) {
      console.error(err);
      setErrorMsg(
        'Error de conexión: No se pudo subir la prenda. ' +
        'Comprobá tu señal de internet e intentalo de nuevo sin perder tus datos. 📡'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="glass-panel slide-up fade-in" style={{ padding: '24px 16px' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Subir Nueva Prenda</h2>
      <p className="subtitle">Agrega una foto y etiquetá sus características</p>

      {/* ── Image Drop Zone ─────────────────────────────────────────────── */}
      <div
        style={{
          aspectRatio: '4/3',
          width: '100%',
          borderRadius: 'var(--radius-md)',
          border: '2px dashed var(--panel-border)',
          background: 'var(--bg-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginBottom: '20px',
          cursor: isUploading ? 'default' : 'pointer',
          position: 'relative',
          transition: 'opacity 0.3s ease',
          opacity: isUploading ? 0.7 : 1,
          pointerEvents: isUploading ? 'none' : 'auto',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Vista Previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {!isUploading && (
              <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500 }}>
                Cambiar foto
              </div>
            )}
            {isUploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>
                <Loader2 className="animate-spin" size={20} /> Procesando…
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            <ImageIcon size={48} style={{ margin: '0 auto 12px', strokeWidth: 1.5, opacity: 0.6 }} />
            <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>Toca para seleccionar foto</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.8 }}>JPEG · PNG · WEBP · Cámara</p>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef}   onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} />
      <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" capture="environment" style={{ display: 'none' }} />

      {!previewUrl && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isUploading}
            onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
            style={{ flex: 1, padding: '10px' }}
          >
            <Camera size={18} /> Tomar Foto
          </button>
        </div>
      )}

      {/* ── Form fields (locked during upload) ─────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          opacity: isUploading ? 0.55 : 1,
          pointerEvents: isUploading ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* Category — icon chips */}
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

        {/* Clima — single-select chips */}
        <div className="form-group">
          <label className="form-label">Clima</label>
          <div className="chip-container">
            {CLIMAS.map(item => (
              <button
                key={item.value}
                type="button"
                className={`chip ${clima === item.value ? 'selected' : ''}`}
                onClick={() => setClima(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Formality — single-select chips */}
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

        {/* Primary colors */}
        <div className="form-group">
          <label className="form-label">Color Principal</label>
          <ColorPickerRow selected={primaryColors} onToggle={togglePrimaryColor} />
        </div>

        {/* Secondary colors */}
        <div className="form-group">
          <label className="form-label">Color Secundario</label>
          <ColorPickerRow selected={secondaryColors} onToggle={toggleSecondaryColor} />
        </div>

        {/* Style tags */}
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
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '0 16px', borderRadius: 'var(--radius-sm)' }}
            >
              Agregar
            </button>
          </form>
        </div>
      </div>

      {/* ── Error panel ─────────────────────────────────────────────────── */}
      {errorMsg && (
        <div
          className="fade-in"
          style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(224, 122, 95, 0.35)', backgroundColor: 'rgba(224, 122, 95, 0.07)', color: 'var(--danger-color)', fontSize: '0.88rem', lineHeight: '1.45' }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Submit / Success ─────────────────────────────────────────────── */}
      <div style={{ marginTop: '20px' }}>
        {uploadSuccess ? (
          <div
            className="pop-in"
            style={{ backgroundColor: 'var(--success-color)', color: 'white', padding: '14px', borderRadius: 'var(--radius-md)', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Sparkles size={20} /> ¡Prenda añadida al armario!
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isUploading}>
            {isUploading ? (
              <><Loader2 className="animate-spin" size={18} /> Comprimiendo y guardando…</>
            ) : 'Guardar en Armario'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Child component: Color Picker Row (multi-select preset swatches) ───────────

interface ColorPickerRowProps {
  selected: string[];
  onToggle: (hex: string) => void;
}

function ColorPickerRow({ selected, onToggle }: ColorPickerRowProps) {
  return (
    <div className="color-picker">
      {PRESETS_COLORS.map(col => (
        <button
          key={col.hex}
          type="button"
          className={`color-dot ${selected.includes(col.hex) ? 'selected' : ''}`}
          style={{ backgroundColor: col.hex, border: col.hasBorder ? '1px solid #CCC' : undefined }}
          onClick={() => onToggle(col.hex)}
          title={col.name}
          aria-label={col.name}
          aria-pressed={selected.includes(col.hex)}
        >
          {selected.includes(col.hex) && (
            <Check
              size={14}
              color={LIGHT_SWATCHES.has(col.hex) ? '#1A1A1A' : '#FFFFFF'}
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
