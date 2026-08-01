import Link from "next/link";
import { notFound } from "next/navigation";
import dogs from "@/data/dogs.json";

export async function generateStaticParams() {
  return dogs.map((a) => ({ id: a.id }));
}

export default async function AdoptAnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animal = dogs.find((a) => a.id === id);
  if (!animal) notFound();

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/adopt" className="text-spur-orange text-sm font-semibold hover:underline mb-6 inline-block">
            ← Back to Adoptable Animals
          </Link>
          <p className="eyebrow mb-2">{animal.breed}</p>
          <h1 className="text-4xl md:text-5xl font-bold">{animal.name}</h1>
        </div>
      </section>
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Photo */}
          <div className="relative aspect-[4/3] bg-spur-tan-light rounded overflow-hidden">
            <img src={animal.image} alt={animal.name} className="w-full h-full object-cover" />
          </div>
          {/* Details */}
          <div>
            <div className="flex flex-wrap gap-4 mb-6">
              {[
                { label: "Gender", value: animal.gender },
                { label: "Age",    value: animal.age },
                { label: "Breed",  value: animal.breed },
              ].map((detail) => (
                <div key={detail.label} className="bg-spur-tan-light rounded px-4 py-3 min-w-[100px]">
                  <p className="text-xs font-semibold text-spur-orange uppercase tracking-wide mb-1">{detail.label}</p>
                  <p className="text-sm font-semibold text-spur-black">{detail.value}</p>
                </div>
              ))}
            </div>
            <div className="orange-divider mb-4" />
            <p className="text-gray-700 leading-relaxed mb-8">{animal.description}</p>
            <Link
              href={`/adopt/apply?animal=${encodeURIComponent(animal.name)}`}
              className="inline-block bg-spur-orange text-white font-semibold px-10 py-3 rounded hover:bg-spur-orange-dark transition-colors"
            >
              Apply to Adopt {animal.name}
            </Link>
            <p className="text-xs text-gray-400 mt-4">
              Submitting an application does not reserve this animal. All applications are reviewed carefully.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
