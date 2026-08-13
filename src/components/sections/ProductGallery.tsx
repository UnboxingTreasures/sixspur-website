'use client';

import { useState, useEffect } from 'react';

interface ProductGalleryProps {
  photos: string[];
  name: string;
  forcePhoto?: string; // optional external override, e.g. from a variant picker -- Adopt's usage never passes this, so its behavior is completely unchanged
}

export default function ProductGallery({ photos, name, forcePhoto }: ProductGalleryProps) {
  const [activePhoto, setActivePhoto] = useState(photos[0] || '');
  const [imageError, setImageError] = useState(false);

  // Jumps the main image when a parent explicitly asks for a specific
  // photo (e.g. selecting "Black/Grey" in the variant picker) -- doesn't
  // affect normal thumbnail-click behavior below, which still just sets
  // activePhoto directly.
  useEffect(() => {
    if (forcePhoto) {
      setActivePhoto(forcePhoto);
      setImageError(false);
    }
  }, [forcePhoto]);

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
