import Image from "next/image";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const metadata = {
  title: "The Farm Family | Six Spur Ranch and Rescue",
  description: "Meet the permanent animal residents of Six Spur Ranch and Rescue in Maud, Texas.",
};

interface FarmAnimal {
  animalId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
}

async function getFarmAnimals(): Promise<FarmAnimal[]> {
  try {
    const res = await fetch(`${API_URL}/farm-animals`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.animals || [];
  } catch {
    return [];
  }
}

export default async function FarmAnimalsPage() {
  const animals = await getFarmAnimals();

  return (
    <main className="min-h-screen bg-white">

      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-3">The Farm Family</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">They Call Six Spur Home</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Not every animal here is looking for a new home. Our farm residents are permanent
            members of the Six Spur family, living out their lives on the ranch with the care
            and love they deserve.
          </p>
        </div>
      </section>

      {/* Animal grid */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {animals.map((animal) => (
              <Link key={animal.animalId} href={`/farm-animals/${animal.animalId}`} className="flex flex-col group">
                <div className="relative w-full aspect-[4/3] bg-spur-tan-light rounded overflow-hidden mb-5">
                  <Image
                    src={animal.thumbnailUrl}
                    alt={animal.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-spur-black mb-1 group-hover:text-spur-orange transition-colors">{animal.name}</h2>
                  <div className="orange-divider mb-3" />
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {animal.description || "More information coming soon."}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="eyebrow mb-3">Support the farm family</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Every donation goes directly to their care.</h2>
            <p className="text-white/50 max-w-lg leading-relaxed text-sm">
              Feed, veterinary care, shelter, and daily operations — your gift keeps them thriving year-round.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap flex-shrink-0">
            <Link href="/ways-to-give" className="bg-spur-orange text-white font-semibold px-8 py-3 rounded hover:bg-spur-orange-dark transition-colors whitespace-nowrap">
              Donate Now
            </Link>
            <Link href="/contact" className="border border-white/20 text-white/70 font-semibold px-8 py-3 rounded hover:border-spur-orange hover:text-spur-orange transition-colors whitespace-nowrap">
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
