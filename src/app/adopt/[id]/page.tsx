import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/sections/ProductGallery";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface AgeValue {
  value: number;
  unit: string;
}

interface Descriptor {
  label: string;
  value: string;
}

interface AdoptableAnimalDetail {
  animalId: string;
  name: string;
  type: string;
  age: AgeValue | null;
  sex: string;
  description: string;
  customDescriptors: Descriptor[];
  photos: string[];
  thumbnailUrl: string;
  adoptedAt?: string; // NEW Session 18 -- present once this animal has been adopted
}

async function getAnimal(animalId: string): Promise<AdoptableAnimalDetail | null> {
  try {
    const res = await fetch(`${API_URL}/adoptable-animals/${animalId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animal = await getAnimal(id);
  if (!animal) return { title: "Animal Not Found | Six Spur Ranch and Rescue" };
  return {
    title: `${animal.name} | Adopt | Six Spur Ranch and Rescue`,
    description: animal.description || `Meet ${animal.name}, available for adoption at Six Spur Ranch and Rescue.`,
  };
}

export default async function AdoptAnimalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const animal = await getAnimal(id);
  if (!animal) notFound();

  const photos = animal.photos && animal.photos.length > 0 ? animal.photos : [animal.thumbnailUrl];
  const isAdopted = Boolean(animal.adoptedAt);

  const fixedDetails = [
    { label: "Sex", value: animal.sex },
    ...(animal.age ? [{ label: "Age", value: `${animal.age.value} ${animal.age.unit}` }] : []),
    { label: "Type", value: animal.type },
  ];
  const customDetails = (animal.customDescriptors || []).map((d) => ({ label: d.label, value: d.value }));
  const allDetails = [...fixedDetails, ...customDetails];

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/adopt" className="text-spur-orange text-sm font-semibold hover:underline mb-6 inline-block">
            ← Back to Adoptable Animals
          </Link>
          <p className="eyebrow mb-2">{animal.type}</p>
          <h1 className="text-4xl md:text-5xl font-bold">{animal.name}</h1>
        </div>
      </section>
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Photo gallery */}
          <ProductGallery photos={photos} name={animal.name} />

          {/* Details */}
          <div>
            <div className="flex flex-wrap gap-4 mb-6">
              {allDetails.map((detail) => (
                <div key={detail.label} className="bg-spur-tan-light rounded px-4 py-3 min-w-[100px]">
                  <p className="text-xs font-semibold text-spur-orange uppercase tracking-wide mb-1">{detail.label}</p>
                  <p className="text-sm font-semibold text-spur-black">{detail.value}</p>
                </div>
              ))}
            </div>
            <div className="orange-divider mb-4" />
            <p className="text-gray-700 leading-relaxed mb-8">{animal.description}</p>

            {isAdopted ? (
              // Adopted animals no longer show up in the main /adopt
              // listing, so reaching this page at all means someone
              // followed an old link/bookmark/search result -- shown
              // gracefully rather than as a dead end or a broken "Apply"
              // button pointed at an animal that's no longer available.
              <div className="bg-spur-tan-light border border-spur-tan rounded p-6">
                <p className="text-spur-black font-semibold mb-2">🏡 {animal.name} has found a forever home!</p>
                <p className="text-sm text-gray-600">
                  This animal has already been adopted.{" "}
                  <Link href="/adopt" className="text-spur-orange font-semibold hover:underline">
                    See who else is available →
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <Link
                  href={`/adopt/apply?animal=${encodeURIComponent(animal.name)}&animalId=${encodeURIComponent(animal.animalId)}`}
                  className="inline-block bg-spur-orange text-white font-semibold px-10 py-3 rounded hover:bg-spur-orange-dark transition-colors"
                >
                  Apply to Adopt {animal.name}
                </Link>
                <p className="text-xs text-gray-400 mt-4">
                  Submitting an application does not reserve this animal. All applications are reviewed carefully.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
