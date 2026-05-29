import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Check, Loader2, Sparkles } from 'lucide-react';
import { addPrenda, uploadPrendaImage } from '../lib/db';
import { compressImage } from '../utils/image';
import type { Prenda } from '../types';

interface UploadFormProps {
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'superior', label: 'Prenda Superior (Remera, Camisa, Suéter)' },
  { value: 'inferior', label: 'Prenda Inferior (Pantalón, Jean, Pollera)' },
  { value: 'abrigo', label: 'Abrigo (Campera, Tapado, Blazer)' },
  { value: 'calzado', label: 'Calzado (Zapatillas, Botas, Sandalias)' },
  { value: 'monoprenda', label: 'Monoprenda (Vestido, Enterito)' },
  { value: 'accesorio', label: 'Accesorio (Cartera, Bufanda, Anteojos)' },
];

const WEATHERS: { value: Prenda['weather'][number]; label: string }[] = [
  { value: 'calido', label: '☀️ Cálido' },
  { value: 'templado', label: '⛅ Templado' },
  { value: 'frio', label: '❄️ Frío' },
  { value: 'lluvioso', label: '🌧️ Lluvioso' },
];

const FORMALITIES: { value: Prenda['formality'][number]; label: string }[] = [
  { value: 'casual', label: '✨ Casual' },
  { value: 'trabajo', label: '💼 Oficina / Trabajo' },
  { value: 'formal', label: '🍸 Formal / Cóctel' },
  { value: 'fiesta', label: '🎉 Fiesta / Salida' },
];

const POPULAR_STYLES = ['minimalist', 'casual', 'romantic', 'sporty', 'elegant', 'cozy', 'streetwear', 'boho', 'edgy'];

const PRESETS_COLORS = [
  { name: 'Negro', hex: '#1A1A1A' },
  { name: 'Blanco', hex: '#FFFFFF', hasBorder: true },
  { name: 'Gris', hex: '#8E918F' },
  { name: 'Crema', hex: '#F3E5AB' },
  { name: 'Marrón', hex: '#704214' },
  { name: 'Azul', hex: '#2A52BE' },
  { name: 'Celeste', hex: '#87CEEB' },
  { name: 'Verde', hex: '#2E8B57' },
  { name: 'Bordeaux', hex: '#800020' },
  { name: 'Rosa', hex: '#FFC0CB' },
  { name: 'Mostaza', hex: '#E1AD01' },
];

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<Prenda['category']>('superior');
  const [weather, setWeather] = useState<Prenda['weather']>(['templado']);
  const [formality, setFormality] = useState<Prenda['formality']>(['casual']);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [customStyle, setCustomStyle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadSuccess(false);
      setErrorMsg(null);
    }
  };

  const toggleWeather = (val: Prenda['weather'][number]) => {
    setWeather(prev =>
      prev.includes(val) ? prev.filter(w => w !== val) : [...prev, val]
    );
  };

  const toggleFormality = (val: Prenda['formality'][number]) => {
    setFormality(prev =>
      prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]
    );
  };

  const toggleColor = (hex: string) => {
    setSelectedColors(prev =>
      prev.includes(hex) ? prev.filter(c => c !== hex) : [...prev, hex]
    );
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const handleAddCustomStyle = (e: React.FormEvent) => {
    e.preventDefault();
    const styleTrim = customStyle.trim().toLowerCase();
    if (styleTrim && !selectedStyles.includes(styleTrim)) {
      setSelectedStyles(prev => [...prev, styleTrim]);
    }
    setCustomStyle('');
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      setErrorMsg('Por favor selecciona o toma una foto de la prenda.');
      return;
    }
    if (weather.length === 0) {
      setErrorMsg('Selecciona al menos una opción de clima.');
      return;
    }
    if (formality.length === 0) {
      setErrorMsg('Selecciona al menos una opción de formalidad.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      // 1. Compress image in frontend (Canvas)
      const compressed = await compressImage(selectedImage, 600, 800, 0.7);

      // 2. Upload image (to Supabase Storage or LocalStorage Base64)
      const imageUrl = await uploadPrendaImage(compressed);

      // 3. Add item metadata to Database
      await addPrenda({
        image_url: imageUrl,
        category,
        weather,
        formality,
        styles: selectedStyles,
        colors: selectedColors,
      });

      // Clear form
      setSelectedImage(null);
      setPreviewUrl(null);
      setWeather(['templado']);
      setFormality(['casual']);
      setSelectedColors([]);
      setSelectedStyles([]);
      setUploadSuccess(true);
      
      // Auto-dismiss success and refresh parent
      setTimeout(() => {
        setUploadSuccess(false);
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar la prenda. Reintenta por favor.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel slide-up fade-in" style={{ padding: '24px 16px' }}>
      <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '8px' }}>Subir Nueva Prenda</h2>
      <p className="subtitle">Agrega una foto y taggea sus metadatos</p>

      {/* Image Upload/Capture Card */}
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
          cursor: 'pointer',
          position: 'relative'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <img 
            src={previewUrl} 
            alt="Vista Previa" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            <ImageIcon size={48} style={{ margin: '0 auto 12px', strokeWidth: 1.5, opacity: 0.6 }} />
            <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>Toca para seleccionar foto</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.8 }}>Soporta cámara o galería</p>
          </div>
        )}

        {previewUrl && (
          <div 
            style={{ 
              position: 'absolute', 
              bottom: '12px', 
              right: '12px', 
              background: 'rgba(0,0,0,0.6)', 
              color: 'white', 
              padding: '6px 12px', 
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            Cambiar foto
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        capture="environment" 
        style={{ display: 'none' }} 
      />

      {/* Secondary Camera trigger option for mobile */}
      {!previewUrl && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
            style={{ flex: 1, padding: '10px' }}
          >
            <Camera size={18} /> Tomar Foto
          </button>
        </div>
      )}

      {/* Inputs Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Category */}
        <div className="form-group">
          <label className="form-label">Categoría</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value as Prenda['category'])}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--panel-border)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.95rem',
              outline: 'none'
            }}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Weather compatibility */}
        <div className="form-group">
          <label className="form-label">Clima Compatible</label>
          <div className="chip-container">
            {WEATHERS.map(item => (
              <button
                key={item.value}
                type="button"
                className={`chip ${weather.includes(item.value) ? 'selected' : ''}`}
                onClick={() => toggleWeather(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Formality level */}
        <div className="form-group">
          <label className="form-label">Formalidad / Ocasión</label>
          <div className="chip-container">
            {FORMALITIES.map(item => (
              <button
                key={item.value}
                type="button"
                className={`chip ${formality.includes(item.value) ? 'selected' : ''}`}
                onClick={() => toggleFormality(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Colors selector */}
        <div className="form-group">
          <label className="form-label">Colores Predominantes</label>
          <div className="color-picker">
            {PRESETS_COLORS.map(col => (
              <button
                key={col.hex}
                type="button"
                className={`color-dot ${selectedColors.includes(col.hex) ? 'selected' : ''}`}
                style={{ 
                  backgroundColor: col.hex, 
                  border: col.hasBorder ? '1px solid #CCC' : undefined,
                }}
                onClick={() => toggleColor(col.hex)}
                title={col.name}
              >
                {selectedColors.includes(col.hex) && (
                  <Check 
                    size={14} 
                    color={col.hex === '#FFFFFF' || col.hex === '#F3E5AB' || col.hex === '#FFC0CB' ? '#1A1A1A' : '#FFFFFF'} 
                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Style Tag selector */}
        <div className="form-group">
          <label className="form-label">Estilo / Tags</label>
          <div className="chip-container" style={{ marginBottom: '8px' }}>
            {POPULAR_STYLES.map(style => (
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
            {selectedStyles.filter(s => !POPULAR_STYLES.includes(s)).map(style => (
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
              placeholder="Ej: vintage, grunge"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--panel-border)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
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

        {errorMsg && (
          <div style={{ color: 'var(--danger-color)', fontSize: '0.9rem', textAlign: 'center', marginTop: '8px', fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}

        {/* Upload Button */}
        <div style={{ marginTop: '12px' }}>
          {uploadSuccess ? (
            <div 
              className="pop-in"
              style={{ 
                backgroundColor: 'var(--success-color)', 
                color: 'white', 
                padding: '14px', 
                borderRadius: 'var(--radius-md)', 
                textAlign: 'center', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={20} /> ¡Guardado con éxito!
            </div>
          ) : (
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Procesando Prenda...
                </>
              ) : (
                'Guardar en Armario'
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
