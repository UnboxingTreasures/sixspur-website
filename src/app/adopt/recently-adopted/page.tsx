import Link from "next/link";
import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface RecentlyAdoptedAnimal {
  animalId: string;
  name: string;
  type: string;
  description: string;
  thumbnailUrl: string;
  adoptedAt: string;
}

async function getRecentlyAdopted(): Promise<RecentlyAdoptedAnimal[]> {
  try {
    const res = await fetch(`${API_URL}/adoptable-animals/recently-adopted`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.animals || [];
  } catch {
    return [];
  }
}

function formatAdoptedDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export const metadata = {
  title: "Recently Adopted | Six Spur Ranch and Rescue",
  description: "Meet some of the animals who have recently found their forever homes through Six Spur Ranch and Rescue.",
};

export default async function RecentlyAdoptedPage() {
  const animals = await getRecentlyAdopted();

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/adopt" className="text-spur-orange text-sm font-semibold hover:underline mb-6 inline-block">
            ← Back to Adoptable Animals
          </Link>
          <p className="eyebrow mb-3">Success Stories</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Recently Adopted</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            These animals have found their forever homes over the past six months, thanks to caring
            families just like yours.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {animals.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-sm mb-6">
                No animals have been adopted in the last six months. Every adoption is worth celebrating —
                check back soon, or see who&apos;s currently available.
              </p>
              <Link href="/adopt" className="inline-block bg-spur-orange text-white font-semibold px-8 py-3 rounded hover:bg-spur-orange-dark transition-colors">
                See Adoptable Animals
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {animals.map((animal) => (
                <div key={animal.animalId} className="rounded overflow-hidden border border-spur-tan-light">
                  <div className="relative aspect-square bg-spur-tan-light">
                    <Image src={animal.thumbnailUrl} alt={animal.name} fill className="object-cover" />
                    <div className="absolute top-3 left-3 bg-spur-orange text-white text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded">
                      Adopted
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-spur-black text-lg mb-1">{animal.name}</h3>
                    <p className="text-spur-orange text-xs font-semibold uppercase tracking-wide mb-3">
                      Found a home {formatAdoptedDate(animal.adoptedAt)}
                    </p>
                    {animal.description && (
                      <p className="text-gray-600 text-sm leading-relaxed">{animal.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
