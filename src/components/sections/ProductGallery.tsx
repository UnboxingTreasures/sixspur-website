'use client';

import { useState, useEffect } from 'react';

interface ProductGalleryProps {
  photos: string[];
  name: string;
}

export default function ProductGallery({ photos, name }: ProductGalleryProps) {
  const [activePhoto, setActivePhoto] = useState(photos[0] || '');
  const [imageError, setImageError] = useState(false);

  // Resets to the new set's first photo whenever the photos array itself
  // changes -- this is what makes variant switching work: a parent
  // (ShopVariantDisplay) swaps in a completely different array when a
  // variant with its own gallery is selected, and this picks that up
  // automatically. Adopt's usage passes a static array that never
  // changes after mount, so this has no effect there.
  useEffect(() => {
    setActivePhoto(photos[0] || '');
    setImageError(false);
  }, [photos]);

  return (
    <div>
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#D1C0B0', overflow: 'hidden', borderRadius: '4px', marginBottom: '1rem' }}>
        {!imageError && activePhoto && (
          <img
            src={activePhoto}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {photos.map((photo) => (
            <button
              key={photo}
              onClick={() => {
                setActivePhoto(photo);
                setImageError(false);
              }}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: photo === activePhoto ? '2px solid #E77A2D' : '2px solid #E8E2DC',
                padding: 0,
                cursor: 'pointer',
                background: '#D1C0B0',
                flexShrink: 0,
              }}
            >
              <img src={photo} alt={`${name} thumbnail`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
