import { notFound } from 'next/navigation';
import ProductGallery from '@/components/sections/ProductGallery';
import SizePicker from '@/components/sections/SizePicker';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface SizeEntry {
  size: string;
  stock: number;
}

interface ShopItemDetail {
  itemId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photos: string[];
  thumbnailUrl: string;
  hasSizes: boolean;
  sizes?: SizeEntry[];
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
  const soldOut = item.hasSizes
    ? (item.sizes || []).every((s) => s.stock <= 0)
    : (item.stock ?? 0) <= 0;

  return (
    <main className="min-h-screen bg-white">
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <ProductGallery photos={photos} name={item.name} />

          <div>
            <p className="eyebrow mb-2">{item.category}</p>
            <h1 className="text-3xl font-bold text-spur-black mb-3">{item.name}</h1>
            <p className="text-2xl font-bold text-spur-orange mb-6">${item.price.toFixed(2)}</p>

            {item.description && (
              <p className="text-gray-600 leading-relaxed mb-6">{item.description}</p>
            )}

            {item.hasSizes && item.sizes && item.sizes.length > 0 && (
              <div className="mb-6">
                <SizePicker sizes={item.sizes} />
              </div>
            )}

            {soldOut && (
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Currently sold out
              </p>
            )}

            <p className="text-sm text-gray-500 mt-8">
              Every purchase supports the animals at Six Spur Ranch and Rescue.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
