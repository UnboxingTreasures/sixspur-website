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
const FIREWORK_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

// Traditional bulb-and-tube thermometer, drawn as SVG for precise
// control over the shape -- much cleaner than faking it with CSS.
// Coordinates: tube runs from y=20 (rounded top) to y=250 (where it
// meets the bulb), bulb centered at (70, 260). Fill height is computed
// from percent and grows upward from the always-full-looking bulb.
function ThermometerGraphic({ percent, fillColor, isComplete }: { percent: number; fillColor: string; isComplete: boolean }) {
  const tubeInnerTop = 26;
  const tubeInnerBottom = 250;
  const tubeInnerHeight = tubeInnerBottom - tubeInnerTop;
  const fillHeight = (percent / 100) * tubeInnerHeight;
  const fillY = tubeInnerBottom - fillHeight;

  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <svg width="140" height="320" viewBox="0 0 140 320">
        {/* Tick marks + labels */}
        {ticks.map((tick) => {
          const y = tubeInnerBottom - (tick / 100) * tubeInnerHeight;
          return (
            <g key={tick}>
              <line x1="92" y1={y} x2="102" y2={y} stroke="#111111" strokeWidth="2" />
              <text x="107" y={y + 4} fontSize="11" fontWeight="700" fill="#111111">{tick}</text>
            </g>
          );
        })}

        {/* Outer outline: tube + bulb */}
        <rect x="50" y="20" width="40" height="230" rx="20" fill="#FFFFFF" stroke="#111111" strokeWidth="6" />
        <circle cx="70" cy="260" r="35" fill="#FFFFFF" stroke="#111111" strokeWidth="6" />

        {/* Fill: tube portion grows upward, bulb portion always full */}
        <rect
          className="fundraiser-thermometer-fill"
          x="56" y={fillY} width="28" height={fillHeight + 20} rx="14"
          fill={fillColor}
        />
        <circle cx="70" cy="260" r="27" fill={fillColor} />

        {/* Fireworks, only once the goal is fully met -- burst from the
            top-center of the filled tube. */}
        {isComplete && FIREWORK_ANGLES.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const distance = 46;
          const tx = Math.cos(rad) * distance;
          const ty = Math.sin(rad) * distance;
          const color = i % 2 === 0 ? '#E77A2D' : '#FFC857';
          return (
            <foreignObject key={angle} x="30" y="-20" width="80" height="80" style={{ overflow: 'visible' }}>
              <span
                className="firework-spark"
                style={{
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  animationDelay: `${i * 0.06}s`,
                  background: color,
                } as React.CSSProperties}
              />
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}

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
          shape. */}
      <style>{`
        @keyframes fundraiser-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }
        .fundraiser-thermometer-fill {
          animation: fundraiser-pulse 2.2s ease-in-out infinite;
        }
        @keyframes firework-spark {
          0% { transform: translate(0, 0) scale(0.4); opacity: 1; }
          15% { transform: translate(calc(var(--tx) * 0.2), calc(var(--ty) * 0.2)) scale(1.3); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        .firework-spark {
          display: block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: firework-spark 0.9s ease-out infinite;
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

        {/* Thermometer + stats, side by side */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
          <ThermometerGraphic percent={percent} fillColor={fillColor} isComplete={isComplete} />

          <div style={{ textAlign: 'left', minWidth: '200px' }}>
            <div style={{ color: '#111111', fontWeight: 800, fontSize: '2rem', lineHeight: 1.1, marginBottom: '0.5rem' }}>
              ${fundraiser.raisedAmount.toFixed(0)}{isComplete ? ' 🎉' : ''}
            </div>
            <div style={{ color: '#888888', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              raised of ${fundraiser.goalAmount.toFixed(0)} goal
            </div>
            <div style={{ color: '#888888', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Ends {formatDate(fundraiser.closingDate)}
            </div>

            <Link
              href="/ways-to-give"
              style={{
                display: 'inline-block',
                color: '#E77A2D', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px',
              }}
            >
              Give to this campaign →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
