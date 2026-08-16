import Link from 'next/link';
import FarmCard from './FarmCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface FarmAnimal {
  animalId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
}

async function getFarmAnimals(): Promise<FarmAnimal[]> {
  try {
    const res = await fetch(`${API_URL}/farm-animals`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.animals || [];
  } catch {
    return [];
  }
}

export default async function FarmFamily() {
  const animals = await getFarmAnimals();

  return (
    <section style={{ background: '#111111', padding: '6rem 1.5rem' }}>
      {/* The grid below was hardcoded to 4 columns with no responsive
          behavior at all -- on a narrow phone, 4 fixed-width columns
          forced the whole grid (and the page along with it) wider than
          the viewport, causing horizontal overflow. FarmCard's <Image>
          sizes prop already assumed 2 columns on mobile
          ("(max-width: 640px) 50vw"), so this brings the actual grid in
          line with what the image sizing already expected. */}
      <style>{`
        .farm-animal-grid {
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 640px) {
          .farm-animal-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            The Farm Family
          </p>
          <h2 style={{ color: '#FFFFFF', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            They call Six Spur{' '}
            <span style={{ color: '#E77A2D' }}>home.</span>
          </h2>
          <p style={{ color: '#D1C0B0', fontSize: '1.05rem', lineHeight: 1.8, margin: 0 }}>
            Not every animal at Six Spur is here temporarily. Our farm residents are permanent members of the family that live out their lives on the ranch. Your donations keep them fed, healthy, and happy year-round.
          </p>
        </div>
        {/* Animal grid */}
        <div className="farm-animal-grid" style={{ display: 'grid', gap: '1rem', marginBottom: '3rem' }}>
          {animals.map((animal) => (
            <FarmCard
              key={animal.animalId}
              id={animal.animalId}
              name={animal.name}
              description={animal.description}
              image={animal.thumbnailUrl}
            />
          ))}
        </div>
        {/* Support CTA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '2rem', borderTop: '1px solid #2a2a2a', paddingTop: '3rem' }}>
          <div>
            <p style={{ color: '#D1C0B0', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Support the farm family
            </p>
            <p style={{ color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Every donation goes directly to their care.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', margin: 0 }}>
              Feed, veterinary care, shelter, and daily operations — your gift keeps them thriving.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              href="/ways-to-give"
              style={{ background: '#E77A2D', color: '#FFFFFF', padding: '0.875rem 2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '2px', whiteSpace: 'nowrap' }}
            >
              Donate now
            </Link>
            <Link
              href="/farm-animals"
              style={{ background: 'transparent', color: '#D1C0B0', padding: '0.875rem 2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '2px', border: '1px solid #2a2a2a', whiteSpace: 'nowrap' }}
            >
              Meet them all →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
