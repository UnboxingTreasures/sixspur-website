'use client';

import Link from 'next/link';

const farmResidents = [
  {
    id: 'longhorns',
    name: 'The Longhorns',
    description: 'Our longhorns are the heart of the ranch. These gentle giants roam the pastures and greet every visitor with quiet curiosity.',
    image: '/images/animals/cow-longhorn-haybale.jpg',
    count: 'Several residents',
  },
  {
    id: 'calves',
    name: 'Mama & Calves',
    description: 'Nothing captures the spirit of Six Spur quite like watching a mama longhorn tend to her calf. Family is everything here.',
    image: '/images/animals/cow-mama-calf-nuzzle.jpg',
    count: 'Born on the ranch',
  },
  {
    id: 'donkeys',
    name: 'The Donkeys',
    description: 'Equal parts stubborn and sweet, our donkeys are fan favorites. They love attention and will follow you around the pasture.',
    image: '/images/animals/donkey-mini-pair.jpg',
    count: '6 residents',
  },
  {
    id: 'goats',
    name: 'The Goats',
    description: 'Curious, playful, and always getting into something — our goats bring energy and laughter to the ranch every single day.',
    image: '/images/ranch/ranch-goats-sunset.jpg',
    count: '8 residents',
  },
];

export default function FarmFamily() {
  return (
    <section style={{ background: '#111111', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            The Farm Family
          </p>
          <h2 style={{ color: '#FFFFFF', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            They call Six Spur{' '}
            <span style={{ color: '#E77A2D' }}>home.</span>
          </h2>
          <p style={{ color: '#D1C0B0', fontSize: '1.05rem', lineHeight: 1.8, margin: 0 }}>
            Not every animal at Six Spur is here temporarily. Our farm residents are permanent members of the family — longhorns, donkeys, goats, ducks, chickens, and geese that live out their lives on the ranch. Your donations keep them fed, healthy, and happy year-round.
          </p>
        </div>

        {/* Photo grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1px', marginBottom: '3rem', background: '#2a2a2a' }}>
          {farmResidents.map((resident, index) => (
            <div
              key={resident.id}
              style={{ position: 'relative', aspectRatio: index === 0 ? '16/9' : '4/3', overflow: 'hidden', gridColumn: index === 0 ? 'span 2' : 'span 1' }}
              onMouseEnter={(e) => {
                const overlay = e.currentTarget.querySelector('.farm-overlay') as HTMLDivElement;
                if (overlay) overlay.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const overlay = e.currentTarget.querySelector('.farm-overlay') as HTMLDivElement;
                if (overlay) overlay.style.opacity = '0';
              }}
            >
              {/* Photo */}
              <img
                src={resident.image}
                alt={resident.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}
              />

              {/* Always-visible name bar at bottom */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                padding: '2rem 1.25rem 1.25rem',
              }}>
                <div style={{ color: '#D1C0B0', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  {resident.count}
                </div>
                <div style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 700 }}>
                  {resident.name}
                </div>
              </div>

              {/* Hover overlay with description */}
              <div
                className="farm-overlay"
                style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(17,17,17,0.82)',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'flex-start',
                  padding: '2rem',
                  opacity: 0,
                  transition: 'opacity 0.3s ease',
                }}
              >
                <div style={{ color: '#E77A2D', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {resident.count}
                </div>
                <h3 style={{ color: '#FFFFFF', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                  {resident.name}
                </h3>
                <p style={{ color: '#D1C0B0', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>
                  {resident.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Support CTA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', borderTop: '1px solid #2a2a2a', paddingTop: '3rem' }}>
          <div>
            <p style={{ color: '#D1C0B0', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Support the farm family
            </p>
            <p style={{ color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Every donation goes directly to their care.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', margin: 0 }}>
              Feed, veterinary care, shelter, and daily operations — your gift keeps them thriving.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href="/donate"
              style={{
                background: '#E77A2D', color: '#FFFFFF',
                padding: '0.875rem 2rem', fontSize: '0.85rem',
                fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', textDecoration: 'none',
                borderRadius: '2px', whiteSpace: 'nowrap',
              }}
            >
              Donate now
            </Link>
            <Link
              href="/farm"
              style={{
                background: 'transparent', color: '#D1C0B0',
                padding: '0.875rem 2rem', fontSize: '0.85rem',
                fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', textDecoration: 'none',
                borderRadius: '2px', border: '1px solid #2a2a2a',
                whiteSpace: 'nowrap',
              }}
            >
              Meet them all →
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
