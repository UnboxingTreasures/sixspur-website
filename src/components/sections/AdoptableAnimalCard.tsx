'use client';

import Link from 'next/link';
import { useState } from 'react';

interface AdoptableAnimalCardProps {
  animalId: string;
  name: string;
  ageText: string;
  sex: string;
  description: string;
  thumbnailUrl: string;
}

export default function AdoptableAnimalCard({ animalId, name, ageText, sex, description, thumbnailUrl }: AdoptableAnimalCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/adopt/${animalId}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: '#FFFFFF', borderRadius: '2px', overflow: 'hidden', border: '1px solid #E8E2DC',
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : 'none',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{ position: 'relative' }}>
          <img src={thumbnailUrl} alt={name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: '#E77A2D', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px' }}>
            Available
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <h3 style={{ color: '#111111', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{name}</h3>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            {[ageText, sex].filter(Boolean).join(' · ')}
          </p>
          <p style={{ color: '#555555', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1rem' }}>{description}</p>
          <span style={{ color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Meet {name} →</span>
        </div>
      </div>
    </Link>
  );
}
