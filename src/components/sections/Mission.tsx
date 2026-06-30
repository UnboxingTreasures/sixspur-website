export default function Mission() {
  return (
    <section style={{ background: '#FFFFFF', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '4rem', alignItems: 'center' }}>

        {/* Left — text */}
        <div>
          {/* Eyebrow */}
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Who We Are
          </p>

          <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
            A sanctuary built on{' '}
            <span style={{ color: '#E77A2D' }}>compassion.</span>
          </h2>

          <p style={{ color: '#444444', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '1.25rem' }}>
            Six Spur Ranch and Rescue is a 501(c)(3) nonprofit animal rescue and sanctuary
            nestled in Maud, Texas. We give dogs, donkeys, goats, ducks, chickens, and more
            the care, safety, and love they deserve — and we work every day to find them
            forever homes.
          </p>

          <p style={{ color: '#444444', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '2rem' }}>
            Every animal that comes through our gates is treated as family. Whether they're
            here for a week or for life, they get proper veterinary care, proper nutrition,
            and the kind of attention that helps them heal and thrive.
          </p>

          {/* Bullet list */}
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              'Rescuing and rehabilitating dogs of all breeds and ages',
              'Providing sanctuary for farm animals including donkeys, goats, and poultry',
              'Facilitating adoptions for animals ready for their forever homes',
              'Connecting our community through education and outreach',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: '#444444', fontSize: '0.95rem', lineHeight: 1.6 }}>
                <span style={{ color: '#E77A2D', fontSize: '1.1rem', lineHeight: 1.4, flexShrink: 0 }}>●</span>
                {item}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a
            href="/about"
            style={{
              display: 'inline-block',
              color: '#E77A2D',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              borderBottom: '2px solid #E77A2D',
              paddingBottom: '2px',
            }}
          >
            Our full story →
          </a>
        </div>

        {/* Right — stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { stat: '100+', label: 'Animals rescued', bg: '#111111', statColor: '#E77A2D', labelColor: '#D1C0B0' },
            { stat: '501(c)(3)', label: 'Registered nonprofit', bg: '#E77A2D', statColor: '#FFFFFF', labelColor: 'rgba(255,255,255,0.8)' },
            { stat: '7+', label: 'Species in our care', bg: '#D1C0B0', statColor: '#111111', labelColor: '#555555' },
            { stat: 'Maud, TX', label: 'Home base', bg: '#111111', statColor: '#FFFFFF', labelColor: '#D1C0B0' },
          ].map(({ stat, label, bg, statColor, labelColor }) => (
            <div
              key={label}
              style={{
                background: bg,
                padding: '2rem 1.5rem',
                borderRadius: '2px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: statColor, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 800, lineHeight: 1 }}>
                {stat}
              </span>
              <span style={{ color: labelColor, fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.05em' }}>
                {label}
              </span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
