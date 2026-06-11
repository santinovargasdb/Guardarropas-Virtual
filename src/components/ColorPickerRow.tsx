import { Check } from 'lucide-react';
import { PRESETS_COLORS, LIGHT_SWATCHES } from '../lib/prendaOptions';

// Multi-select preset colour swatches. Shared by the upload form and the edit modal.
interface ColorPickerRowProps {
  selected: string[];
  onToggle: (hex: string) => void;
}

export function ColorPickerRow({ selected, onToggle }: ColorPickerRowProps) {
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
