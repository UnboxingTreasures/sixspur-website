'use client';

import Link from 'next/link';
import news from '@/data/news.json';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function NewsGrid() {
  return (
    <section style={{ background: '#F7F4F0', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            News & Updates
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              From the{' '}
              <span style={{ color: '#E77A2D' }}>ranch.</span>
            </h2>
            <Link
              href="/news"
              style={{ color: '#E77A2D', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px', whiteSpace: 'nowrap' }}
            >
              All updates →
            </Link>
          </div>
        </div>

        {/* News cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {news.map((item) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                style={{ background: '#FFFFFF', border: '1px solid #E8E2DC', borderRadius: '2px', overflow: 'hidden', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                {/* Thumbnail */}
                <div style={{ width: '100%', aspectRatio: '16/9', background: '#D1C0B0', overflow: 'hidden' }}>
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ background: '#E77A2D', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px' }}>
                      {item.category}
                    </span>
                    <span style={{ color: '#999999', fontSize: '0.8rem' }}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <h3 style={{ color: '#111111', fontSize: '1rem', fontWeight: 700, lineHeight: 1.4, margin: '0 0 0.75rem' }}>
                    {item.title}
                  </h3>
                  <p style={{ color: '#666666', fontSize: '0.875rem', lineHeight: 1.65, margin: '0 0 1.25rem' }}>
                    {item.excerpt}
                  </p>
                  <span style={{ color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Read more →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
