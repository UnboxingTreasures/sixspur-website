'use client';

import { useState } from 'react';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <section style={{ background: '#111111', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>

        {/* Eyebrow */}
        <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          Stay Connected
        </p>

        {/* Headline */}
        <h2 style={{ color: '#FFFFFF', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
          Get updates from{' '}
          <span style={{ color: '#E77A2D' }}>the ranch.</span>
        </h2>

        {/* Subheadline */}
        <p style={{ color: '#D1C0B0', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '2.5rem' }}>
          Monthly rescue stories, farm animal news, adoption spotlights, and ways to help —
          straight to your inbox. No spam, ever.
        </p>

        {/* Form */}
        {status === 'success' ? (
          <div style={{
            background: 'rgba(231,122,45,0.15)',
            border: '1px solid #E77A2D',
            borderRadius: '2px',
            padding: '1.5rem 2rem',
          }}>
            <p style={{ color: '#E77A2D', fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem' }}>
              You're on the list! 🤠
            </p>
            <p style={{ color: '#D1C0B0', fontSize: '0.875rem', margin: 0 }}>
              Thanks for signing up. Watch for your first update soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              required
              disabled={status === 'loading'}
              style={{
                flex: '1 1 260px',
                padding: '0.875rem 1.25rem',
                fontSize: '0.95rem',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '2px',
                color: '#FFFFFF',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                background: '#E77A2D',
                color: '#FFFFFF',
                padding: '0.875rem 2rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                borderRadius: '2px',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                opacity: status === 'loading' ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        )}

        {/* Error message */}
        {status === 'error' && (
          <p style={{ color: '#ff6b6b', fontSize: '0.85rem', marginTop: '0.75rem' }}>
            Something went wrong. Please try again or email us at sixspurrescue@gmail.com.
          </p>
        )}

        {/* Fine print */}
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          We respect your privacy. Unsubscribe anytime.
        </p>

      </div>
    </section>
  );
}
