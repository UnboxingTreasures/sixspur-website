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

  return (
    <div style={{ background: '#111111', borderRadius: '2px', padding: '2.5rem', marginBottom: '3rem' }}>
      <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem', textAlign: 'center' }}>
        Active Campaign
      </p>
      <h3 style={{ color: '#FFFFFF', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem' }}>
        {fundraiser.title}
      </h3>
      {fundraiser.description && (
        <p style={{ color: '#D1C0B0', fontSize: '0.95rem', textAlign: 'center', marginBottom: '2rem', maxWidth: '560px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
          {fundraiser.description}
        </p>
      )}

      {/* Large thermometer */}
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ width: '100%', height: '36px', background: '#FFFFFF', borderRadius: '18px', overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: '#E77A2D', transition: 'width 0.5s ease', borderRadius: '18px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1.1rem' }}>${fundraiser.raisedAmount.toFixed(0)} raised</span>
          <span style={{ color: '#D1C0B0', fontSize: '0.9rem' }}>Goal: ${fundraiser.goalAmount.toFixed(0)} · Ends {formatDate(fundraiser.closingDate)}</span>
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
  );
}
