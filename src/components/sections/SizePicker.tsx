'use client';

import { useState } from 'react';

interface SizeEntry {
  size: string;
  stock: number;
}

interface SizePickerProps {
  sizes: SizeEntry[];
}

// No cart/checkout system exists yet -- this shows availability and lets
// the visitor select a size, but doesn't wire up to any purchase action.
// Sold-out sizes are shown but disabled, not hidden, so it's clear the
// size exists and might come back in stock rather than looking unavailable.
export default function SizePicker({ sizes }: SizePickerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <p style={{ color: '#111111', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem' }}>
        Size
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {sizes.map(({ size, stock }) => {
          const soldOut = stock <= 0;
          const isSelected = selected === size;
          return (
            <button
              key={size}
              disabled={soldOut}
              onClick={() => setSelected(size)}
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
              title={soldOut ? `${size} — sold out` : `${size} — ${stock} in stock`}
            >
              {size}
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
