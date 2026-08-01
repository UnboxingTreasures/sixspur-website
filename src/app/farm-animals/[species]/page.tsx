import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import farmAnimals from "@/data/farmAnimals.json";
import galleries from "@/data/farmAnimalGalleries.json";

const descriptions: Record<string, string> = {
  cattle:      "Longhorns, mama cows, and calves — our cattle are the backbone of Six Spur. They roam the pasture and remind us every day why this land matters.",
  goats:       "Curious, playful, and always getting into something. Our goats bring energy and laughter to the ranch every single day.",
  ducks:       "Waddling around the property and keeping everyone entertained — our ducks are a daily delight from sunrise to sundown.",
  geese:       "The self-appointed welcoming committee of Six Spur. Loud, proud, and impossible to ignore.",
  chickens:    "The Breakfast Factory is open year round. Colorful, busy, and endlessly entertaining — our chickens have big personalities for their size.",
  donkeys:     "Equal parts stubborn and sweet. Our donkeys will follow you around the pasture all day if you let them.",
  minidonkeys: "Small in size, huge in personality. Our mini donkeys are fan favorites with every visitor to the ranch.",
  horses:      "Our paint horses are a beautiful sight on the ranch — graceful, strong, and always curious about what you've got in your pocket.",
  dogs:        "Not every dog at Six Spur is up for adoption. Some are permanent members of the ranch family, keeping watch and keeping things lively.",
};

export async function generateStaticParams() {
  return farmAnimals.map((a) => ({ species: a.id }));
}

export default async function FarmSpeciesGalleryPage({ params }: { params: Promise<{ species: string }> }) {
  const { species } = await params;
  const animal = farmAnimals.find((a) => a.id === species);
  if (!animal) notFound();

  const photos: string[] = (galleries as Record<string, string[]>)[species] || [];

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
            {descriptions[animal.id] ?? "More information coming soon."}
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
