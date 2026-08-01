'use client';
import { useState } from 'react';
import team from '@/data/team.json';

function TeamPhoto({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);

  return (
    <div style={{ width: '100%', aspectRatio: '1/1', background: '#D1C0B0', overflow: 'hidden', marginBottom: '1.5rem', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      {/* Silhouette always rendered underneath */}
      <svg style={{ width: '50%', height: '50%', opacity: 0.35, position: 'absolute' }} fill="#7A6A5A" viewBox="0 0 24 24">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
      {/* Image rendered on top — hidden on error, invisible until loaded */}
      <img
        src={src}
        alt={alt}
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
  );
}

export default function Team() {
  return (
    <section style={{ background: '#FFFFFF', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem', maxWidth: '580px' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            The People Behind the Ranch
          </p>
          <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            Meet the{' '}
            <span style={{ color: '#E77A2D' }}>team.</span>
          </h2>
          <p style={{ color: '#555555', fontSize: '1.05rem', lineHeight: 1.8, margin: 0 }}>
            Six Spur runs on passion and hard work. Every person here shows up every day
            because they believe in what we're building — a place where animals are safe,
            loved, and given a second chance.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
          {team.map((member) => (
            <div key={member.id}>
              <TeamPhoto src={member.image} alt={member.name} />
              <div style={{ width: '32px', height: '2px', background: '#E77A2D', marginBottom: '0.75rem' }} />
              <h3 style={{ color: '#111111', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
                {member.name}
              </h3>
              <p style={{ color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
                {member.title}
              </p>
              <p style={{ color: '#555555', fontSize: '0.9rem', lineHeight: 1.75, margin: '0 0 1.25rem' }}>
                {member.bio}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {member.duties.map((duty) => (
                  <li key={duty} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#444444', fontSize: '0.85rem' }}>
                    <span style={{ color: '#E77A2D', fontSize: '0.6rem' }}>●</span>
                    {duty}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
