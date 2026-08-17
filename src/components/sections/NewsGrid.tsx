'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://vvabeaemg5.execute-api.us-east-1.amazonaws.com';

interface Post {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  image: string;
  publishedAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function NewsGrid() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/news`)
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch((err) => console.error('Error fetching news:', err));
  }, []);

  // UPDATED (Session 20) -- previously returned null here when there
  // were no posts, which hid the whole section (including the light
  // #F7F4F0 background) entirely. That silently broke the site-wide
  // "no two adjacent sections share a background" rule whenever it
  // happened to sit between two other sections that were BOTH black
  // (ShopPreview above, Newsletter below) -- confirmed via screenshot,
  // Session 20. Now shows an empty state instead, matching the pattern
  // already established on Shop and Adopt for the same reason: keeps
  // the section (and its background color) always present, just with
  // different content inside it.

  return (
    <section style={{ background: '#F7F4F0', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

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

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#FFFFFF', borderRadius: '2px', border: '1px solid #E8E2DC' }}>
            <p style={{ color: '#888888', fontSize: '0.95rem', margin: 0 }}>Stay tuned for news and blog updates!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {posts.map((item) => (
              <Link
                key={item.slug}
                href={`/news/${item.slug}`}
                style={{ textDecoration: 'none', display: 'block', height: '100%' }}
              >
                <div
                  style={{
                    background: '#FFFFFF', border: '1px solid #E8E2DC', borderRadius: '2px', overflow: 'hidden',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    // Equal-height cards: the grid cell itself already
                    // stretches to match the tallest card in the row (CSS
                    // Grid's default align-items: stretch), but nothing
                    // was telling THIS box to actually fill that stretched
                    // cell -- so it just sat at its own natural content
                    // height instead, leaving ragged bottoms across a row
                    // whenever one excerpt ran longer than another.
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#D1C0B0', overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={item.image}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>

                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ background: '#E77A2D', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '2px' }}>
                        {item.category}
                      </span>
                      <span style={{ color: '#999999', fontSize: '0.8rem' }}>
                        {formatDate(item.publishedAt)}
                      </span>
                    </div>
                    <h3 style={{ color: '#111111', fontSize: '1rem', fontWeight: 700, lineHeight: 1.4, margin: '0 0 0.75rem' }}>
                      {item.title}
                    </h3>
                    <p style={{ color: '#666666', fontSize: '0.875rem', lineHeight: 1.65, margin: '0 0 1.25rem' }}>
                      {item.excerpt}
                    </p>
                    {/* marginTop: auto pushes this to the bottom of the
                        card no matter how long (or short) the excerpt
                        above it is, so "Read more" lines up across every
                        card in the row. */}
                    <span style={{ color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 'auto' }}>
                      Read more →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
