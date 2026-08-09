'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface FarmCardProps {
  id: string;
  name: string;
  description: string;
  image: string;
}

export default function FarmCard({ id, name, description, image }: FarmCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/farm-animals/${id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{ background: '#1A1A1A', border: '1px solid #2a2a2a', borderRadius: '2px', overflow: 'hidden', cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Image */}
        <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3' }}>
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 300px"
            style={{ objectFit: 'cover', transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.4s ease' }}
          />
          {/* Hover overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(17,17,17,0.75)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem',
          }}>
            <p style={{ color: '#D1C0B0', fontSize: '0.85rem', lineHeight: 1.65, textAlign: 'center', margin: 0 }}>
              {description}
            </p>
          </div>
        </div>
        {/* Name bar */}
        <div style={{ padding: '0.875rem 1rem' }}>
          <div style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            {name}
          </div>
        </div>
      </div>
    </Link>
  );
}
