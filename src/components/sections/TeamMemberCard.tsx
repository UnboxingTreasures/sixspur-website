'use client';

import { useState } from 'react';

interface TeamMemberCardProps {
  name: string;
  title: string;
  bio: string;
  image: string;
}

export default function TeamMemberCard({ name, title, bio, image }: TeamMemberCardProps) {
  const [error, setError] = useState(false);

  return (
    <div>
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#D1C0B0', overflow: 'hidden', marginBottom: '1.5rem', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg style={{ width: '50%', height: '50%', opacity: 0.35, position: 'absolute' }} fill="#7A6A5A" viewBox="0 0 24 24">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
        <img
          src={image}
          alt={name}
          onError={() => setError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            position: 'absolute',
            inset: 0,
            display: error ? 'none' : 'block',
          }}
        />
      </div>
      <div style={{ width: '32px', height: '2px', background: '#E77A2D', marginBottom: '0.75rem' }} />
      <h3 style={{ color: '#111111', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
        {name}
      </h3>
      <p style={{ color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
        {title}
      </p>
      <p style={{ color: '#555555', fontSize: '0.9rem', lineHeight: 1.75, margin: 0 }}>
        {bio}
      </p>
    </div>
  );
}
