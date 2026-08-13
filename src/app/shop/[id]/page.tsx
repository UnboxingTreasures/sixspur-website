import { notFound } from 'next/navigation';
import ShopVariantDisplay from '@/components/sections/ShopVariantDisplay';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface VariantEntry {
  value: string;
  stock: number;
  photoUrls?: string[];
}

interface ShopItemDetail {
  itemId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photos: string[];
  thumbnailUrl: string;
  hasVariants: boolean;
  variantLabel?: string;
  variants?: VariantEntry[];
  stock?: number;
}

async function getShopItem(itemId: string): Promise<ShopItemDetail | null> {
  try {
    const res = await fetch(`${API_URL}/shop/${itemId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getShopItem(id);
  if (!item) return { title: 'Product Not Found | Six Spur Ranch and Rescue' };
  return {
    title: `${item.name} | Six Spur Ranch and Rescue Shop`,
    description: item.description || `Shop ${item.name} — every purchase supports our animals.`,
  };
}

export default async function ShopItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getShopItem(id);

  if (!item) notFound();

  const photos = item.photos && item.photos.length > 0 ? item.photos : [item.thumbnailUrl];
  const soldOut = item.hasVariants
    ? (item.variants || []).every((v) => v.stock <= 0)
    : (item.stock ?? 0) <= 0;

  return (
    <main className="min-h-screen bg-white">
      <section className="py-16 px-6">
        <ShopVariantDisplay
          photos={photos}
          name={item.name}
          category={item.category}
          price={item.price}
          description={item.description}
          hasVariants={item.hasVariants}
          variantLabel={item.variantLabel}
          variants={item.variants}
          soldOut={soldOut}
        />
      </section>
    </main>
  );
}
