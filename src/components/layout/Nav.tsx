'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav style={{ background: '#111111' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

        {/* Logo */}
        <Link href='/' style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '36px', background: '#E77A2D', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>
            6S
          </div>
          <div style={{ lineHeight: '1.25' }}>
            <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>Six Spur Ranch and Rescue</div>
            <div style={{ color: '#D1C0B0', fontSize: '11px' }}>Salem, Texas · 501(c)(3)</div>
          </div>
        </Link>

        {/* Desktop Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href='/'       style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>Home</Link>
          <Link href='/donate' style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>Donate</Link>
          <Link href='/adopt'  style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>Adopt</Link>
          <Link href='/shop'   style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>Shop</Link>
          <Link href='/give'   style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>Ways to give</Link>
          <Link href='/about'  style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>About</Link>
          <Link href='/contact' style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }}>Contact</Link>
        </div>

        {/* Donate CTA */}
        <Link
          href='/donate'
          style={{ background: '#E77A2D', color: '#fff', fontSize: '12px', fontWeight: 500, padding: '7px 16px', borderRadius: '999px', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Donate
        </Link>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'none', border: 'none', color: '#D1C0B0', fontSize: '20px', cursor: 'pointer', display: 'none' }}
          aria-label='Toggle menu'
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={{ background: '#000', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link href='/'       style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Home</Link>
          <Link href='/donate' style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Donate</Link>
          <Link href='/adopt'  style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Adopt</Link>
          <Link href='/shop'   style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Shop</Link>
          <Link href='/give'   style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Ways to give</Link>
          <Link href='/about'  style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>About</Link>
          <Link href='/contact' style={{ color: '#D1C0B0', fontSize: '13px', textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Contact</Link>
          <Link href='/donate' style={{ background: '#E77A2D', color: '#fff', fontSize: '13px', fontWeight: 500, padding: '8px 16px', borderRadius: '999px', textDecoration: 'none', textAlign: 'center' }}>Donate</Link>
        </div>
      )}
    </nav>
  )
}
