import Link from 'next/link';
import AdoptableAnimalCard from './AdoptableAnimalCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface AgeValue {
  value: number;
  unit: string;
}

interface AdoptableAnimalSummary {
  animalId: string;
  name: string;
  type: string;
  age: AgeValue | null;
  sex: string;
  description: string;
  thumbnailUrl: string;
}

async function getAdoptableAnimals(): Promise<AdoptableAnimalSummary[]> {
  try {
    const res = await fetch(`${API_URL}/adoptable-animals`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.animals || [];
  } catch {
    return [];
  }
}

function formatAge(age: AgeValue | null): string {
  if (!age) return '';
  return `${age.value} ${age.unit}`;
}

export default async function AdoptableAnimals() {
  const animals = await getAdoptableAnimals();

  return (
    <section style={{ background: '#F7F4F0', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Find Your Match
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Ready for their{' '}
              <span style={{ color: '#E77A2D' }}>forever home.</span>
            </h2>
            <Link
              href="/adopt"
              style={{ color: '#E77A2D', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px', whiteSpace: 'nowrap' }}
            >
              View all animals →
            </Link>
          </div>
        </div>

        {/* Animals -- flat grid, not grouped by type, since the new system
            covers any species (not just dogs) and a hardcoded "Dogs" label
            would be actively wrong once a horse or goat shows up here. */}
        {animals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', marginBottom: '2.5rem', background: '#FFFFFF', borderRadius: '2px', border: '1px solid #E8E2DC' }}>
            <p style={{ color: '#888888', fontSize: '0.95rem', margin: 0 }}>No adoptable animals at the moment. Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            {animals.map((animal) => (
              <AdoptableAnimalCard
                key={animal.animalId}
                animalId={animal.animalId}
                name={animal.name}
                ageText={formatAge(animal.age)}
                sex={animal.sex}
                description={animal.description}
                thumbnailUrl={animal.thumbnailUrl}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{ background: '#111111', padding: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', borderRadius: '2px' }}>
          <div>
            <p style={{ color: '#D1C0B0', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Don't see your match?
            </p>
            <p style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
              New animals arrive regularly. Check back often or get in touch.
            </p>
          </div>
          <Link href="/contact" style={{ background: '#E77A2D', color: '#FFFFFF', padding: '0.875rem 2rem', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', borderRadius: '2px', whiteSpace: 'nowrap' }}>
            Get in touch
          </Link>
        </div>

      </div>
    </section>
  );
}
