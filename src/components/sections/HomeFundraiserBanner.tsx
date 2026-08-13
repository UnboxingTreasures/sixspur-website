'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Fundraiser {
  fundraiserId: string;
  title: string;
  description: string;
  goalAmount: number;
  closingDate: string;
  raisedAmount: number;
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// 8 sparks arranged in a rough circle, each with its own outward
// direction set via CSS custom properties -- lets all 8 share one
// @keyframes definition instead of needing 8 separate ones.
const FIREWORK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Homepage teaser only -- large thermometer + a small link to the real
// donate flow on /ways-to-give (where FundraiserThermometer.tsx handles
// the actual PayPal checkout). This component doesn't process any
// payment itself, deliberately simpler than that one.
export default function HomeFundraiserBanner() {
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/fundraisers/active`)
      .then((res) => res.json())
      .then((data) => setFundraiser(data.fundraiser))
      .catch((err) => console.error('Failed to load active fundraiser:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !fundraiser) return null;

  const percent = fundraiser.goalAmount > 0 ? Math.min(100, (fundraiser.raisedAmount / fundraiser.goalAmount) * 100) : 0;
  const isComplete = percent >= 100;
  // Thermometer metaphor: blue (cold, far from goal) warms to red (hot,
  // close to or at goal) as progress climbs past the halfway point.
  const fillColor = percent >= 50 ? '#DC2626' : '#3B82F6';

  return (
    <>
      {/* Subtle "alive" pulse on the filled portion -- a gentle
          brightness breathe suggesting ongoing momentum, not a static
          bar. Uses filter (not box-shadow) since box-shadow would get
          clipped by the track's overflow:hidden. */}
      <style>{`
        @keyframes fundraiser-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }
        .fundraiser-thermometer-fill {
          animation: fundraiser-pulse 2.2s ease-in-out infinite;
        }
        @keyframes firework-spark {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        .firework-spark {
          position: absolute;
          top: 50%;
          right: 0;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #E77A2D;
          animation: firework-spark 1.1s ease-out infinite;
          pointer-events: none;
        }
      `}</style>

      <div style={{ background: '#F7F4F0', border: '4px solid #111111', borderRadius: '2px', padding: '2.5rem', marginBottom: '3rem' }}>
        <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem', textAlign: 'center' }}>
          Active Campaign
        </p>
        <h3 style={{ color: '#111111', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem' }}>
          {fundraiser.title}
        </h3>
        {fundraiser.description && (
          <p style={{ color: '#555555', fontSize: '0.95rem', textAlign: 'center', marginBottom: '2rem', maxWidth: '560px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
            {fundraiser.description}
          </p>
        )}

        {/* Large thermometer */}
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ position: 'relative', width: '100%', height: '36px', background: '#FFFFFF', borderRadius: '18px', overflow: isComplete ? 'visible' : 'hidden', border: '1.5px solid #E8E2DC' }}>
            <div
              className="fundraiser-thermometer-fill"
              style={{
                width: `${percent}%`, height: '100%', background: fillColor,
                transition: 'width 0.5s ease, background 0.5s ease',
                borderRadius: isComplete ? '18px' : '18px 0 0 18px',
                position: 'relative',
              }}
            >
              {/* Fireworks only render once the goal is fully met --
                  overflow on the track switches to visible above so
                  these aren't clipped at the rounded edge. */}
              {isComplete && FIREWORK_ANGLES.map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const distance = 28;
                const tx = Math.cos(rad) * distance;
                const ty = Math.sin(rad) * distance;
                return (
                  <span
                    key={angle}
                    className="firework-spark"
                    style={{
                      '--tx': `${tx}px`,
                      '--ty': `${ty}px`,
                      animationDelay: `${i * 0.08}s`,
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
            <span style={{ color: '#111111', fontWeight: 800, fontSize: '1.1rem' }}>
              ${fundraiser.raisedAmount.toFixed(0)} raised{isComplete ? ' 🎉' : ''}
            </span>
            <span style={{ color: '#888888', fontSize: '0.9rem' }}>Goal: ${fundraiser.goalAmount.toFixed(0)} · Ends {formatDate(fundraiser.closingDate)}</span>
          </div>
        </div>

        {/* Small link to the real donate flow */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <Link
            href="/ways-to-give"
            style={{
              color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px',
            }}
          >
            Give to this campaign →
          </Link>
        </div>
      </div>
    </>
  );
}
