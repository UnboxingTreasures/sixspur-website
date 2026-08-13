'use client';

import { useState, useEffect } from 'react';

interface VariantDimension {
  label: string;
  values: string[];
}

interface Combination {
  values: Record<string, string>; // dimension label -> value
  stock: number;
}

interface MultiVariantPickerProps {
  dimensions: VariantDimension[];
  combinations: Combination[];
  onFirstDimensionSelect?: (value: string) => void; // triggers gallery photo swap
}

// One picker row per dimension (Size, Color, etc.). Stock/sold-out status
// is only known once a value is picked for EVERY dimension -- it's
// looked up from the matching combination, not per-value, since the same
// color can be in stock in one size and sold out in another. Individual
// buttons don't cross-filter based on partial selections (e.g. greying
// out a color that's sold out for the currently-picked size) -- that's a
// nice-to-have left for later, not built here.
//
// No cart/checkout system exists yet -- this shows availability and lets
// the visitor select options, but doesn't wire up to any purchase action.
export default function MultiVariantPicker({ dimensions, combinations, onFirstDimensionSelect }: MultiVariantPickerProps) {
  // Defaults to the first dimension's first value on load, matching
  // Amazon-style behavior -- otherwise the gallery would show every
  // variant's photos mixed together until the customer clicks something.
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const first = dimensions[0];
    return first && first.values.length > 0 ? { [first.label]: first.values[0] } : {};
  });

  useEffect(() => {
    const first = dimensions[0];
    if (first && first.values.length > 0) {
      onFirstDimensionSelect?.(first.values[0]);
    }
    // Only on mount -- this sets the INITIAL default photo set. Further
    // changes happen through handleSelect below when the customer clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (dimLabel: string, value: string, dimIndex: number) => {
    setSelected((prev) => ({ ...prev, [dimLabel]: value }));
    if (dimIndex === 0) onFirstDimensionSelect?.(value);
  };

  const allSelected = dimensions.every((d) => selected[d.label]);
  const matchedCombo = allSelected
    ? combinations.find((c) => dimensions.every((d) => c.values[d.label] === selected[d.label]))
    : null;

  return (
    <div>
      {dimensions.map((dim, dimIndex) => (
        <div key={dim.label} style={{ marginBottom: '1rem' }}>
          <p style={{ color: '#111111', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem' }}>
            {dim.label}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {dim.values.map((value) => {
              const isSelected = selected[dim.label] === value;
              return (
                <button
                  key={value}
                  onClick={() => handleSelect(dim.label, value, dimIndex)}
                  style={{
                    minWidth: '48px',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    border: isSelected ? '2px solid #E77A2D' : '1.5px solid #E8E2DC',
                    background: isSelected ? '#FEF3EB' : '#FFFFFF',
                    color: '#111111',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {matchedCombo && (
        <p style={{ color: matchedCombo.stock <= 0 ? '#DC2626' : '#888888', fontSize: '0.8rem', fontWeight: matchedCombo.stock <= 0 ? 700 : 400, marginTop: '0.4rem' }}>
          {matchedCombo.stock <= 0 ? 'Sold out in this combination' : `${matchedCombo.stock} in stock`}
        </p>
      )}
      {!allSelected && (
        <p style={{ color: '#9CA3AF', fontSize: '0.8rem', marginTop: '0.4rem' }}>
          Select {dimensions.filter((d) => !selected[d.label]).map((d) => d.label).join(' and ')} to check availability.
        </p>
      )}
    </div>
  );
}
