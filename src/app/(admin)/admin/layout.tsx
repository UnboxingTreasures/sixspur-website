'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import SixSpurLogo from '@/components/admin/SixSpurLogo';

// Each category maps to its real route. Mail and Blog/News point at their
// existing pages from Session 3/4 (/admin/inbox, /admin/news) -- nothing
// moved, they just start picking up this sidebar automatically since this
// layout wraps everything under /admin/*.
const CATEGORIES: { name: string; href: string }[] = [
  { name: 'Home', href: '/admin' },
  { name: 'Adoptable Animals', href: '/admin/adoptable-animals' },
  { name: 'Adoptions', href: '/admin/adoptions' },
  { name: 'Animals', href: '/admin/animals' },
  { name: 'Blog/News', href: '/admin/news' },
  { name: 'Donations', href: '/admin/donations' },
  { name: 'Fundraiser', href: '/admin/fundraiser' },
  { name: 'Mail', href: '/admin/inbox' },
  { name: 'Mailing Lists', href: '/admin/mailing-lists' },
  { name: 'Orders', href: '/admin/orders' },
  { name: 'Shop', href: '/admin/shop' },
  { name: 'Social Media', href: '/admin/social-media' },
  { name: 'Staff', href: '/admin/staff' },
  { name: 'User Access', href: '/admin/user-access' },
];

// Home only matches the exact /admin path. Everything else matches on
// startsWith so nested routes (e.g. /admin/news/new, /admin/news/some-slug)
// still highlight their parent category correctly.
function getActiveHref(pathname: string): string {
  if (pathname === '/admin') return '/admin';
  const matches = CATEGORIES.filter((c) => c.href !== '/admin' && pathname.startsWith(c.href));
  if (matches.length === 0) return '';
  return matches.reduce((longest, c) => (c.href.length > longest.href.length ? c : longest)).href;
}

const MOBILE_TOPBAR_HEIGHT = 60;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/admin';
  const router = useRouter();
  const activeHref = getActiveHref(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeCategoryName = CATEGORIES.find((c) => c.href === activeHref)?.name || 'Admin';

  const handleNavigate = (href: string) => {
    router.push(href);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Below 900px (same breakpoint the public Nav uses): the fixed-width
          sidebar hides entirely and a compact top bar takes over instead --
          a 200px-wide vertical column stacking 13 categories ate too much
          screen width and forced a lot of scrolling on a phone. */}
      <style>{`
        @media (max-width: 900px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-topbar { display: flex !important; }
          .admin-content-area { padding-top: ${MOBILE_TOPBAR_HEIGHT}px !important; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Desktop sidebar -- unchanged from before, just gained a className hook */}
        <div className="admin-sidebar-desktop" style={{ display: 'flex', flexDirection: 'column', width: '200px', borderRight: '1px solid #E8E2DC', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid #E8E2DC', background: '#FFFFFF' }}>
            <div style={{ marginBottom: '8px' }}>
              <SixSpurLogo size={36} color="#111111" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#111111', lineHeight: 1.3 }}>
              Six Spur Ranch<br />Admin Panel
            </div>
          </div>

          {/* Leaves the admin panel entirely -- (admin)/layout.tsx is its
              own separate root layout with no Nav/Footer, so this is a
              plain <a>, not a Next.js Link, to force a real navigation
              rather than a client-side route change within the admin
              shell. */}
          <a
            href="/"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px 16px', fontSize: '12px', fontWeight: 600, color: '#6B7280',
              borderBottom: '1px solid #E8E2DC', textDecoration: 'none', background: '#FAFAFA',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Public Site
          </a>

          {CATEGORIES.map(({ name, href }) => {
            const isActive = href === activeHref;
            return (
              <div
                key={name}
                onClick={() => router.push(href)}
                style={{
                  padding: '14px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textAlign: 'center',
                  color: isActive ? '#FFA860' : '#111111',
                  background: isActive ? '#111111' : '#FFFFFF',
                  borderBottom: '1px solid #E8E2DC',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = '#FEF3EB';
                    (e.currentTarget as HTMLDivElement).style.color = '#E77A2D';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = '#FFFFFF';
                    (e.currentTarget as HTMLDivElement).style.color = '#111111';
                  }
                }}
              >
                {name}
              </div>
            );
          })}
        </div>

        {/* Mobile top bar -- hidden by default (desktop), shown via the media
            query above. Fixed position so it stays visible while scrolling
            through a long admin page. */}
        <div
          className="admin-mobile-topbar"
          style={{
            display: 'none',
            position: 'fixed',
            top: 0, left: 0, right: 0,
            height: `${MOBILE_TOPBAR_HEIGHT}px`,
            zIndex: 100,
            background: '#FFFFFF',
            borderBottom: '1px solid #E8E2DC',
            padding: '0 16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <SixSpurLogo size={26} color="#111111" />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCategoryName}
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle admin menu"
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#111111', padding: '4px 8px', flexShrink: 0 }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile dropdown menu -- only rendered while open, so it never
            needs its own media-query guard (the toggle button that opens
            it is itself hidden on desktop). */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              top: `${MOBILE_TOPBAR_HEIGHT}px`, left: 0, right: 0, bottom: 0,
              zIndex: 99,
              background: '#FFFFFF',
              overflowY: 'auto',
            }}
          >
            {CATEGORIES.map(({ name, href }) => {
              const isActive = href === activeHref;
              return (
                <div
                  key={name}
                  onClick={() => handleNavigate(href)}
                  style={{
                    padding: '16px 20px',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: isActive ? '#FFA860' : '#111111',
                    background: isActive ? '#111111' : '#FFFFFF',
                    borderBottom: '1px solid #E8E2DC',
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </div>
              );
            })}
            <a
              href="/"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '16px 20px', fontSize: '15px', fontWeight: 500, color: '#6B7280',
                textDecoration: 'none',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to Public Site
            </a>
          </div>
        )}

        {/* Content area -- each /admin/* page renders here. Gains top
            padding on mobile only, to clear the fixed top bar. */}
        <div className="admin-content-area" style={{ flex: 1, background: '#F7F4F0' }}>
          {children}
        </div>
      </div>
    </>
  );
}
