import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Camera, Image as ImageIcon, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { insertPrenda, uploadPrendaImage } from '../lib/db';
import { compressImage, isAllowedImageType, removeFlatBackground, previewFlatBackground } from '../utils/image';
import { CATEGORIES, CLIMAS, FORMALITIES, PRESET_STYLES } from '../lib/prendaOptions';
import { ColorPickerRow } from './ColorPickerRow';
import type { Prenda, Clima } from '../types';

interface UploadFormProps {
  onSuccess: () => void;
}

// 20 MB raw input guard — protects against accidental RAW / video files
const MAX_RAW_BYTES        = 20 * 1024 * 1024;
// 150 KB post-compression cap — keeps free-tier Supabase & LocalStorage healthy
const MAX_COMPRESSED_BYTES = 150 * 1024;

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [selectedImage,  setSelectedImage]  = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [nombre,         setNombre]         = useState('');
  const [category,       setCategory]       = useState<Prenda['category']>('superior');
  const [clima,          setClima]          = useState<Clima[]>(['templado']);
  const [formality,      setFormality]      = useState<Prenda['formality']>('casual');
  const [primaryColors,   setPrimaryColors]   = useState<string[]>([]);
  const [secondaryColors, setSecondaryColors] = useState<string[]>([]);
  const [selectedStyles,  setSelectedStyles]  = useState<string[]>([]);
  const [customStyle,    setCustomStyle]    = useState('');
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadSuccess,  setUploadSuccess]  = useState(false);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);
  const [removeBg,       setRemoveBg]       = useState(true);
  const [bgThreshold,    setBgThreshold]    = useState(38);
  const [cutoutPreview,  setCutoutPreview]  = useState<string | null>(null);

  const fileInputRef      = useRef<HTMLInputElement>(null);
  const cameraInputRef    = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup success flash timeout on unmount to prevent memory leaks on mobile
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // Live cut-out preview for the background-remover assistant (forced so the user
  // can tune the threshold and judge any background, not only flat/light ones).
  useEffect(() => {
    if (!selectedImage || !removeBg) { setCutoutPreview(null); return; }
    let cancelled = false;
    previewFlatBackground(selectedImage, bgThreshold, true).then(url => {
      if (!cancelled) setCutoutPreview(url);
    });
    return () => { cancelled = true; };
  }, [selectedImage, removeBg, bgThreshold]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setNombre('');
    setCategory('superior');
    setClima(['templado']);
    setFormality('casual');
    setRemoveBg(true);
    setBgThreshold(38);
    setCutoutPreview(null);
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
      // Step 1 — Compress (JPEG baseline). When the background remover is enabled,
      // produce a forced transparent PNG cut-out at the chosen sensitivity so the
      // garment "dresses" the mannequin without its background box. Falls back to
      // the JPEG if the cut-out fails or exceeds the size budget.
      const compressed = await compressImage(selectedImage);
      let processed: File = compressed;
      if (removeBg) {
        const cutout = await removeFlatBackground(selectedImage, 700, bgThreshold, true);
        if (cutout && cutout.size <= MAX_COMPRESSED_BYTES) processed = cutout;
      }

      // Step 2 — Post-processing size gate
      if (processed.size > MAX_COMPRESSED_BYTES) {
        setErrorMsg(
          `La imagen procesada pesa ${Math.round(processed.size / 1024)} KB ` +
          `y supera el límite de 150 KB. Probá con una foto con menos detalle o mejor iluminación.`
        );
        return;
      }

      // Step 3 — Upload to Supabase Storage or encode to Base64 for LocalStorage
      const imageUrl = await uploadPrendaImage(processed);

      // Step 4 — Persist garment metadata. `colors` is the deduped union of both
      // palettes so the generator's chromatic triage can read one flat list.
      const colors = Array.from(new Set([...primaryColors, ...secondaryColors]));
      await insertPrenda({
        image_url: imageUrl,
        nombre: nombre.trim() || undefined,
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

      {/* ── Background remover assistant (chroma key + live preview) ── */}
      {previewUrl && (
        <div
          style={{
            border: '1px solid var(--panel-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '20px',
            backgroundColor: 'var(--bg-color)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
            ✂️ Quitar fondo (PNG transparente)
          </label>

          {removeBg && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  Sensibilidad
                </span>
                <input
                  type="range"
                  min={12}
                  max={90}
                  value={bgThreshold}
                  onChange={(e) => setBgThreshold(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent-color)' }}
                />
              </div>

              {/* Live preview over a checkerboard so transparency is visible */}
              <div
                style={{
                  alignSelf: 'center',
                  width: '60%',
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: '#ffffff',
                  backgroundImage:
                    'linear-gradient(45deg, #e9e3db 25%, transparent 25%), linear-gradient(-45deg, #e9e3db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e9e3db 75%), linear-gradient(-45deg, transparent 75%, #e9e3db 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {cutoutPreview ? (
                  <img src={cutoutPreview} alt="Vista previa recortada" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 10px', opacity: 0.8 }}>
                    Procesando recorte…
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.8, lineHeight: '1.4', margin: 0 }}>
                Funciona mejor con fondos lisos y claros. Ajustá la sensibilidad y previsualizá; si no te convence, desactivá el recorte.
              </p>
            </div>
          )}
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
        {/* Nombre — optional readable name Luci will use */}
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

        {/* Clima — multi-select chips (uno, dos o los tres) */}
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

