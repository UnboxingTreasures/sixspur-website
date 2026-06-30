'use client';

import Link from 'next/link';

const ways = [
  {
    id: 'one-time',
    icon: '❤️',
    title: 'One-time donation',
    description: 'Any amount helps feed, house, and care for the animals at Six Spur. Every dollar goes directly to the animals.',
    cta: 'Donate now',
    href: '/donate',
    highlight: true,
  },
  {
    id: 'monthly',
    icon: '🔁',
    title: 'Monthly giving',
    description: 'Become a ranch supporter with a recurring gift. Monthly donors are the backbone of what we do here.',
    cta: 'Give monthly',
    href: '/give#monthly',
    highlight: false,
  },
  {
    id: 'wishlists',
    icon: '📦',
    title: 'Wish lists',
    description: 'Send supplies directly from our Amazon and Chewy wish lists. Dog food, hay, medical supplies — it all helps.',
    cta: 'View wish lists',
    href: '/give#wishlists',
    highlight: false,
  },
];

export default function WaysToGive() {
  return (
    <section style={{ background: '#F7F4F0', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem', maxWidth: '580px', margin: '0 auto 3.5rem' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Make a Difference
          </p>
          <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            Every dollar goes to{' '}
            <span style={{ color: '#E77A2D' }}>the animals.</span>
          </h2>
          <p style={{ color: '#555555', fontSize: '1.05rem', lineHeight: 1.8, margin: 0 }}>
            Whether you give once, monthly, or send supplies from our wish list —
            every contribution makes a real difference at Six Spur.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
          {ways.map((way) => (
            <div
              key={way.id}
              style={{
                background: way.highlight ? '#111111' : '#FFFFFF',
                border: way.highlight ? 'none' : '1px solid #E8E2DC',
                borderRadius: '2px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ fontSize: '2rem' }}>{way.icon}</div>

              <div>
                <h3 style={{ color: way.highlight ? '#FFFFFF' : '#111111', fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
                  {way.title}
                </h3>
                <p style={{ color: way.highlight ? '#D1C0B0' : '#555555', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>
                  {way.description}
                </p>
              </div>

              <Link
                href={way.href}
                style={{
                  marginTop: 'auto',
                  display: 'inline-block',
                  color: way.highlight ? '#E77A2D' : '#E77A2D',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  borderBottom: '2px solid #E77A2D',
                  paddingBottom: '2px',
                  alignSelf: 'flex-start',
                }}
              >
                {way.cta} →
              </Link>
            </div>
          ))}
        </div>

        {/* Tax note */}
        <p style={{ textAlign: 'center', color: '#999999', fontSize: '0.8rem', lineHeight: 1.6 }}>
          Six Spur Ranch and Rescue is a registered 501(c)(3) nonprofit · EIN: 41-4123317 ·{' '}
          Your contribution is tax-deductible to the extent allowed by law.
        </p>

      </div>
    </section>
  );
}
