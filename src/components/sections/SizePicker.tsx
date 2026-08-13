'use client';

import { useState } from 'react';

interface VariantEntry {
  value: string;
  stock: number;
  photoUrl?: string;
}

interface SizePickerProps {
  label: string; // admin-defined dimension name, e.g. "Size" or "Style"
  variants: VariantEntry[];
  onSelect?: (variant: VariantEntry) => void; // optional -- lets a parent react to selection, e.g. swapping the gallery photo
}

// No cart/checkout system exists yet -- this shows availability and lets
// the visitor select an option, but doesn't wire up to any purchase
// action. Sold-out options are shown but disabled, not hidden, so it's
// clear the option exists and might come back in stock rather than
// looking unavailable.
export default function SizePicker({ label, variants, onSelect }: SizePickerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (variant: VariantEntry) => {
    setSelected(variant.value);
    onSelect?.(variant);
  };

  return (
    <div>
      <p style={{ color: '#111111', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem' }}>
        {label}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {variants.map((variant) => {
          const { value, stock } = variant;
          const soldOut = stock <= 0;
          const isSelected = selected === value;
          return (
            <button
              key={value}
              disabled={soldOut}
              onClick={() => handleClick(variant)}
              style={{
                minWidth: '48px',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                border: isSelected ? '2px solid #E77A2D' : '1.5px solid #E8E2DC',
                background: soldOut ? '#F5F3F0' : isSelected ? '#FEF3EB' : '#FFFFFF',
                color: soldOut ? '#B0AAA3' : '#111111',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: soldOut ? 'not-allowed' : 'pointer',
                textDecoration: soldOut ? 'line-through' : 'none',
                position: 'relative',
              }}
              title={soldOut ? `${value} — sold out` : `${value} — ${stock} in stock`}
            >
              {value}
            </button>
          );
        })}
      </div>
      {selected && (
        <p style={{ color: '#888888', fontSize: '0.8rem', marginTop: '0.6rem' }}>
          Selected: {selected}
        </p>
      )}
    </div>
  );
}
