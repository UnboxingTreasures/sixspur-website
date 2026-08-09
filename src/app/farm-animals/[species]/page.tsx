import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface FarmAnimal {
  animalId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  photos: string[];
}

async function getFarmAnimal(species: string): Promise<FarmAnimal | null> {
  try {
    const res = await fetch(`${API_URL}/farm-animals/${species}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// No generateStaticParams here on purpose: animal types are now managed live
// through the admin panel (add/rename/delete), so this page needs to reflect
// a brand-new type immediately, not only after the next site rebuild.

export default async function FarmSpeciesGalleryPage({ params }: { params: Promise<{ species: string }> }) {
  const { species } = await params;
  const animal = await getFarmAnimal(species);
  if (!animal) notFound();

  const photos = animal.photos || [];

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/farm-animals" className="text-spur-orange text-sm font-semibold hover:underline mb-6 inline-block">
            ← Back to The Farm Family
          </Link>
          <p className="eyebrow mb-3">The Farm Family</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{animal.name}</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            {animal.description || "More information coming soon."}
          </p>
        </div>
      </section>

      {/* Photo grid */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {photos.length === 0 ? (
            <p className="text-gray-500 text-sm">No photos available yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {photos.map((src, i) => (
                <div key={src} className="relative aspect-[4/3] bg-spur-tan-light rounded overflow-hidden">
                  <Image
                    src={src}
                    alt={`${animal.name} photo ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Support CTA */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="eyebrow mb-3">Support the farm family</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Every donation goes directly to their care.</h2>
          </div>
          <div className="flex gap-4 flex-wrap flex-shrink-0">
            <Link href="/ways-to-give" className="bg-spur-orange text-white font-semibold px-8 py-3 rounded hover:bg-spur-orange-dark transition-colors whitespace-nowrap">
              Donate Now
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
