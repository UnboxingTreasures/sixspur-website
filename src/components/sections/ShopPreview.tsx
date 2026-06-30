'use client';

import Link from 'next/link';
import shopItems from '@/data/shopItems.json';

export default function ShopPreview() {
  return (
    <section style={{ background: '#FFFFFF', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Shop
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Wear your{' '}
              <span style={{ color: '#E77A2D' }}>support.</span>
            </h2>
            <Link
              href="/shop"
              style={{ color: '#E77A2D', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px', whiteSpace: 'nowrap' }}
            >
              Shop all →
            </Link>
          </div>
          <p style={{ color: '#555555', fontSize: '1.05rem', lineHeight: 1.8, marginTop: '1rem', maxWidth: '520px' }}>
            Every purchase supports the animals at Six Spur Ranch and Rescue.
          </p>
        </div>

        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {shopItems.map((item) => (
            <Link
              key={item.id}
              href={`/shop/${item.id}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                style={{ borderRadius: '2px', overflow: 'hidden', border: '1px solid #E8E2DC' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Product image */}
                <div style={{ width: '100%', aspectRatio: '1/1', background: '#D1C0B0', overflow: 'hidden', transition: 'transform 0.3s ease' }}>
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>

                {/* Product info */}
                <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
                  <p style={{ color: '#888888', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 0.25rem' }}>
                    {item.category}
                  </p>
                  <h3 style={{ color: '#111111', fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                    {item.name}
                  </h3>
                  <p style={{ color: '#E77A2D', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                    ${item.price}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
