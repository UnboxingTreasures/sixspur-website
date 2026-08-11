import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const metadata = {
  title: "Shop | Six Spur Ranch and Rescue",
  description: "Shop Six Spur Ranch and Rescue merchandise — every purchase supports our animals.",
};

interface ShopItem {
  itemId: string;
  name: string;
  category: string;
  price: number;
  thumbnailUrl: string;
}

async function getShopItems(): Promise<ShopItem[]> {
  try {
    const res = await fetch(`${API_URL}/shop`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function ShopPage() {
  const shopItems = await getShopItems();

  // Grouped dynamically from the actual product data -- no hardcoded
  // category list, matches the original design. New categories added via
  // /admin/shop show up here automatically.
  const categories = Array.from(new Set(shopItems.map((item) => item.category)));

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-3">Shop</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Six Spur Merch</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Every purchase directly supports the animals at Six Spur Ranch and Rescue.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {categories.map((category) => {
            const items = shopItems.filter((item) => item.category === category);
            return (
              <div key={category} id={category} className="mb-16 scroll-mt-24">
                <h2 className="text-2xl font-bold text-spur-black mb-6">{capitalize(category)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {items.map((item) => (
                    <a key={item.itemId} href={`/shop/${item.itemId}`} className="flex flex-col rounded overflow-hidden border border-spur-tan-light hover:shadow-md transition-shadow">
                      <div className="relative aspect-square bg-spur-tan-light overflow-hidden">
                        <Image src={item.thumbnailUrl} alt={item.name} fill className="object-cover" />
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-spur-black text-base mb-1">{item.name}</h3>
                        <p className="text-spur-orange font-semibold">${item.price.toFixed(2)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
