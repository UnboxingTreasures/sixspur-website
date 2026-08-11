import Link from 'next/link';
import ShopProductCard from './ShopProductCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ShopItem {
  itemId: string;
  name: string;
  category: string;
  price: number;
  thumbnailUrl: string;
}

async function getShopItems(): Promise<ShopItem[]> {
  try {
    const res = await fetch(`${API_URL}/shop`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export default async function ShopPreview() {
  const items = await getShopItems();

  return (
    <section style={{ background: '#FFFFFF', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Shop
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
              Wear your{' '}
              <span style={{ color: '#E77A2D' }}>support.</span>
            </h2>
            <Link
              href="/shop"
              style={{ color: '#E77A2D', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: '2px solid #E77A2D', paddingBottom: '2px', whiteSpace: 'nowrap' }}
            >
              Shop all →
            </Link>
          </div>
          <p style={{ color: '#555555', fontSize: '1.05rem', lineHeight: 1.8, marginTop: '1rem', maxWidth: '520px' }}>
            Every purchase supports the animals at Six Spur Ranch and Rescue.
          </p>
        </div>

        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {items.map((item) => (
            <ShopProductCard
              key={item.itemId}
              itemId={item.itemId}
              name={item.name}
              category={item.category}
              price={item.price}
              thumbnailUrl={item.thumbnailUrl}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
