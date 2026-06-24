import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ background: '#111111', color: '#fff' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Top grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)', gap: '2rem', paddingBottom: '2rem', borderBottom: '0.5px solid #2a2a2a' }}>

          {/* Brand */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>Six Spur Ranch and Rescue</div>
            <div style={{ width: '32px', height: '2px', background: '#E77A2D', margin: '8px 0 12px' }}></div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: '1.65' }}>
              A 501(c)(3) nonprofit animal rescue and sanctuary in Texas.
              Rescuing dogs. Caring for farm animals. Building community.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '8px' }}>EIN: [XX-XXXXXXX]</p>
          </div>

          {/* Adopt */}
          <div>
            <h4 style={{ color: '#D1C0B0', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Adopt</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/adopt'         style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Adoptable dogs</Link>
              <Link href='/adopt/recent'  style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Recently adopted</Link>
              <Link href='/adopt/process' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Adoption process</Link>
              <Link href='/faq'           style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>FAQ</Link>
            </div>
          </div>

          {/* Give */}
          <div>
            <h4 style={{ color: '#D1C0B0', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Give</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/donate'         style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Donate</Link>
              <Link href='/give#monthly'   style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Monthly giving</Link>
              <Link href='/give#wishlists' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Wish lists</Link>
              <Link href='/give#workplace' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Workplace giving</Link>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 style={{ color: '#D1C0B0', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Shop</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/shop#hats'        style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Hats</Link>
              <Link href='/shop#tees'        style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Tees</Link>
              <Link href='/shop#hoodies'     style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Hoodies</Link>
              <Link href='/shop#accessories' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Accessories</Link>
            </div>
          </div>

          {/* Ranch */}
          <div>
            <h4 style={{ color: '#D1C0B0', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Ranch</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/about'   style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Our story</Link>
              <Link href='/farm'    style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>The farm family</Link>
              <Link href='/news'    style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>News and updates</Link>
              <Link href='/contact' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none' }}>Contact</Link>
            </div>
          </div>

        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '1.5rem' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>© {new Date().getFullYear()} Six Spur Ranch and Rescue. All rights reserved.</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '4px' }}>Six Spur Ranch and Rescue is a registered 501(c)(3). Your contribution is tax-deductible to the extent allowed by law.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href='https://facebook.com'  target='_blank' rel='noreferrer' style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textDecoration: 'none' }}>Facebook</a>
            <a href='https://instagram.com' target='_blank' rel='noreferrer' style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textDecoration: 'none' }}>Instagram</a>
            <a href='https://tiktok.com'    target='_blank' rel='noreferrer' style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textDecoration: 'none' }}>TikTok</a>
            <a href='https://youtube.com'   target='_blank' rel='noreferrer' style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textDecoration: 'none' }}>YouTube</a>
          </div>
        </div>

      </div>
    </footer>
  )
}
