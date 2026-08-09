'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import SixSpurLogo from '@/components/admin/SixSpurLogo';

// Each category maps to its real route. Mail and Blog/News point at their
// existing pages from Session 3/4 (/admin/inbox, /admin/news) -- nothing
// moved, they just start picking up this sidebar automatically since this
// layout wraps everything under /admin/*.
const CATEGORIES: { name: string; href: string }[] = [
  { name: 'Home', href: '/admin' },
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

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/admin';
  const router = useRouter();
  const activeHref = getActiveHref(pathname);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '200px', borderRight: '1px solid #E8E2DC', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', textAlign: 'center', borderBottom: '1px solid #E8E2DC', background: '#FFFFFF' }}>
          <div style={{ marginBottom: '8px' }}>
            <SixSpurLogo size={36} color="#111111" />
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#111111', lineHeight: 1.3 }}>
            Six Spur Ranch<br />Admin Panel
          </div>
        </div>

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

      {/* Content area -- each /admin/* page renders here */}
      <div style={{ flex: 1, background: '#F7F4F0' }}>
        {children}
      </div>
    </div>
  );
}
