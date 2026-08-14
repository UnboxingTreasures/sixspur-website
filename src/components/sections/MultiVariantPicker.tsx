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
  // NEW: fires whenever the full set of dimensions resolves to (or stops
  // resolving to) one exact combination -- this is what a parent needs
  // to enable/disable "Add to Cart" and know which comboIndex to send to
  // checkout. comboIndex is this combination's position in the
  // `combinations` array, which is exactly what the backend's
  // buildReservationPlan expects (see lambda/orders/dynamo.js) -- it
  // re-reads the product fresh and indexes into ITS OWN combinations
  // array the same way, so this only breaks if admin reorders/edits
  // combinations between browse and checkout, an accepted edge case.
  onSelectionChange?: (combo: Combination | null, comboIndex: number | null) => void;
}

// One picker row per dimension (Size, Color, etc.). Stock/sold-out status
// is only known once a value is picked for EVERY dimension -- it's
// looked up from the matching combination, not per-value, since the same
// color can be in stock in one size and sold out in another. Individual
// buttons don't cross-filter based on partial selections (e.g. greying
// out a color that's sold out for the currently-picked size) -- that's a
// nice-to-have left for later, not built here.
export default function MultiVariantPicker({ dimensions, combinations, onFirstDimensionSelect, onSelectionChange }: MultiVariantPickerProps) {
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
  const matchedComboIndex = allSelected
    ? combinations.findIndex((c) => dimensions.every((d) => c.values[d.label] === selected[d.label]))
    : -1;
  const matchedCombo = matchedComboIndex >= 0 ? combinations[matchedComboIndex] : null;

  // Report the match (or lack of one) up to the parent any time the
  // selection resolves differently. Runs after every render where
  // `selected` changed, via the dependency array below -- not inside
  // handleSelect directly, so it also correctly reports null on initial
  // mount if fewer than all dimensions default-select.
  useEffect(() => {
    onSelectionChange?.(matchedCombo, matchedComboIndex >= 0 ? matchedComboIndex : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedComboIndex]);

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
