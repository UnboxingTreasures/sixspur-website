'use client';

import Link from 'next/link';
import { useState } from 'react';

const farmResidents = [
  {
    id: 'cattle',
    name: 'Cattle',
    description: 'Longhorns, mama cows, and calves — our cattle are the backbone of Six Spur.',
    image: '/images/cattle/cow-mama-calf-nuzzle.jpg',
    count: 'Several residents',
  },
  {
    id: 'donkeys',
    name: 'Donkeys',
    description: 'Equal parts stubborn and sweet — our donkeys will follow you around the pasture all day.',
    image: '/images/donkeys/donkey-white-portrait.jpg',
    count: '6 residents',
  },
  {
    id: 'minidonkeys',
    name: 'Mini Donkeys',
    description: 'Small in size, huge in personality. Our mini donkeys are fan favorites with every visitor.',
    image: '/images/mini_donkeys/minidonkey-grazing-dry-field.jpg',
    count: '2 residents',
  },
  {
    id: 'goats',
    name: 'Goats',
    description: 'Curious, playful, and always getting into something — our goats bring energy to the ranch every day.',
    image: '/images/goats/goat-mama-kids-barn.jpg',
    count: '8 residents',
  },
  {
    id: 'chickens',
    name: 'Chickens',
    description: 'The Breakfast Factory is open year round. Colorful, busy, and endlessly entertaining.',
    image: '/images/chickens/chicken-breakfast-factory.jpg',
    count: '22 residents',
  },
  {
    id: 'ducks',
    name: 'Ducks',
    description: 'Waddling around the ranch and keeping everyone entertained — our ducks are a daily delight.',
    image: '/images/ducks/duck-portrait-standing.jpg',
    count: '7 residents',
  },
  {
    id: 'geese',
    name: 'Geese',
    description: 'The self-appointed welcoming committee. Loud, proud, and impossible to ignore.',
    image: '/images/geese/geese-pair-necks-portrait.jpg',
    count: '5 residents',
  },
  {
    id: 'horses',
    name: 'Horses',
    description: 'Our paint horses are a beautiful sight on the ranch — graceful, strong, and always curious.',
    image: '/images/horses/horse-paint-grazing-closeup.jpg',
    count: 'Several residents',
  },
  {
    id: 'dogs',
    name: 'Ranch Dogs',
    description: 'Not every dog at Six Spur is up for adoption — some are permanent members of the ranch family, keeping watch and keeping things lively.',
    image: '/images/ranch/ranch-dogs-deck-logo.jpg',
    count: 'Several residents',
  },
];

function FarmCard({ resident }: { resident: typeof farmResidents[0] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ background: '#1A1A1A', border: '1px solid #2a2a2a', borderRadius: '2px', overflow: 'hidden', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={resident.image}
          alt={resident.name}
          style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', transform: hovered ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.4s ease' }}
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
            {resident.description}
          </p>
        </div>
      </div>

      {/* Name bar */}
      <div style={{ padding: '0.875rem 1rem' }}>
        <div style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem' }}>
          {resident.name}
        </div>
        <div style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 600 }}>
          {resident.count}
        </div>
      </div>
    </div>
  );
}

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
            Not every animal at Six Spur is here temporarily. Our farm residents are permanent members of the family that live out their lives on the ranch. Your donations keep them fed, healthy, and happy year-round.
          </p>
        </div>

        {/* Animal grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '3rem' }}>
          {farmResidents.map((resident) => (
            <FarmCard key={resident.id} resident={resident} />
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
              style={{ background: '#E77A2D', color: '#FFFFFF', padding: '0.875rem 2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '2px', whiteSpace: 'nowrap' }}
            >
              Donate now
            </Link>
            <Link
              href="/farm"
              style={{ background: 'transparent', color: '#D1C0B0', padding: '0.875rem 2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '2px', border: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}
            >
              Meet them all →
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
