'use client';

import Link from 'next/link';
import { useState } from 'react';

interface ShopProductCardProps {
  itemId: string;
  name: string;
  category: string;
  price: number;
  thumbnailUrl: string;
}

export default function ShopProductCard({ itemId, name, category, price, thumbnailUrl }: ShopProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Link href={`/shop/${itemId}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '2px',
          overflow: 'hidden',
          border: '1px solid #E8E2DC',
          boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          // Same equal-height fix as NewsGrid/AdoptableAnimalCard --
          // fills the grid cell's already-stretched height instead of
          // sitting at its own natural content height, so a product
          // name that wraps to 2 lines no longer makes that card taller
          // than its neighbors in the row.
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ width: '100%', aspectRatio: '1/1', background: '#D1C0B0', overflow: 'hidden', flexShrink: 0 }}>
          {!imageError && (
            <img
              src={thumbnailUrl}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImageError(true)}
            />
          )}
        </div>

        <div style={{ padding: '1rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <p style={{ color: '#888888', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 0.25rem' }}>
            {category}
          </p>
          <h3 style={{ color: '#111111', fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            {name}
          </h3>
          {/* marginTop: auto pins the price to the bottom regardless of
              whether the name above wrapped to one line or two. */}
          <p style={{ color: '#E77A2D', fontSize: '1rem', fontWeight: 800, margin: 0, marginTop: 'auto' }}>
            ${price.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}
