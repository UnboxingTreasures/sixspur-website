'use client';

import Link from 'next/link';
import dogs from '@/data/dogs.json';


export default function AdoptableAnimals() {
  return (
    <section style={{ background: '#F7F4F0', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Find Your Match
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Ready for their{' '}
              <span style={{ color: '#E77A2D' }}>forever home.</span>
            </h2>
            <Link
              href="/adopt"
              style={{ color: '#E77A2D', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px', whiteSpace: 'nowrap' }}
            >
              View all animals →
            </Link>
          </div>
        </div>

        {/* Dogs */}
        <p style={{ color: '#111111', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #E0D8D0', paddingBottom: '0.5rem' }}>
          Dogs
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {dogs.map((dog) => (
            <Link key={dog.id} href={`/adopt/${dog.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                style={{ background: '#FFFFFF', borderRadius: '2px', overflow: 'hidden', border: '1px solid #E8E2DC' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img src={dog.image} alt={dog.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: '#E77A2D', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px' }}>
                    Available
                  </div>
                </div>
                <div style={{ padding: '1.25rem' }}>
                  <h3 style={{ color: '#111111', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>{dog.name}</h3>
                  <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 600, margin: '0 0 0.75rem' }}>{dog.breed} · {dog.age} · {dog.gender}</p>
                  <p style={{ color: '#555555', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1rem' }}>{dog.description}</p>
                  <span style={{ color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Meet {dog.name} →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ background: '#111111', padding: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', borderRadius: '2px' }}>
          <div>
            <p style={{ color: '#D1C0B0', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Don't see your match?
            </p>
            <p style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              New animals arrive regularly. Check back often or get in touch.
            </p>
          </div>
          <Link href="/contact" style={{ background: '#E77A2D', color: '#FFFFFF', padding: '0.875rem 2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '2px', whiteSpace: 'nowrap' }}>
            Get in touch
          </Link>
        </div>

      </div>
    </section>
  );
}
