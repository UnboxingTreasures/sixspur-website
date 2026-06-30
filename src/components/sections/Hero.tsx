'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Hero() {
  return (
    <section style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background image */}
      <Image
        src="/images/hero/hero-boots-sunset.jpg"
        alt="Cowboy boots and longhorns at sunset on Six Spur Ranch"
        fill
        priority
        style={{ objectFit: 'cover', objectPosition: 'center' }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '0 1.5rem',
          textAlign: 'center',
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            color: '#E77A2D',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '1.25rem',
          }}
        >
          Maud, Texas
        </p>

        {/* Headline */}
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: '900px',
            marginBottom: '1.5rem',
          }}
        >
          Every Animal
          <br />
          Deserves a{' '}
          <span style={{ color: '#E77A2D' }}>Second Chance.</span>
        </h1>

        {/* Subheadline */}
        <p
          style={{
            color: '#D1C0B0',
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            maxWidth: '560px',
            lineHeight: 1.7,
            marginBottom: '2.75rem',
          }}
        >
          Six Spur Ranch and Rescue is a 501(c)(3) nonprofit sanctuary
          giving dogs, donkeys, goats, and more a safe place to heal and find their forever homes.
        </p>

        {/* CTA Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'center',
          }}
        >
          {/* Primary — Donate */}
          <Link
            href="/donate"
            style={{
              backgroundColor: '#E77A2D',
              color: '#FFFFFF',
              padding: '0.875rem 2.25rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderRadius: '2px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#cf6c22')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E77A2D')}
          >
            Donate
          </Link>

          {/* Secondary — Adopt */}
          <Link
            href="/adopt"
            style={{
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              padding: '0.875rem 2.25rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderRadius: '2px',
              border: '2px solid #FFFFFF',
              transition: 'border-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#E77A2D';
              e.currentTarget.style.color = '#E77A2D';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#FFFFFF';
              e.currentTarget.style.color = '#FFFFFF';
            }}
          >
            Adopt
          </Link>

          {/* Tertiary — Shop */}
          <Link
            href="/shop"
            style={{
              backgroundColor: 'transparent',
              color: '#D1C0B0',
              padding: '0.875rem 2.25rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderRadius: '2px',
              border: '2px solid #D1C0B0',
              transition: 'border-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#E77A2D';
              e.currentTarget.style.color = '#E77A2D';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#D1C0B0';
              e.currentTarget.style.color = '#D1C0B0';
            }}
          >
            Shop
          </Link>
        </div>

        {/* Scroll hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#D1C0B0',
            opacity: 0.7,
          }}
        >
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Scroll
          </span>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
            <rect x="1" y="1" width="14" height="22" rx="7" stroke="#D1C0B0" strokeWidth="1.5" />
            <circle cx="8" cy="7" r="2.5" fill="#E77A2D">
              <animate attributeName="cy" values="7;14;7" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </div>
    </section>
  );
}
