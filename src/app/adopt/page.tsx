"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const ALL_SEXES = ["Male", "Female"];

interface AgeValue {
  value: number;
  unit: string;
}

interface Descriptor {
  label: string;
  value: string;
}

interface AdoptableAnimal {
  animalId: string;
  name: string;
  type: string;
  age: AgeValue | null;
  sex: string;
  description: string;
  customDescriptors?: Descriptor[];
  thumbnailUrl: string;
}

function formatAge(age: AgeValue | null): string {
  if (!age) return "";
  return `${age.value} ${age.unit}`;
}

export default function AdoptPage() {
  const [animals, setAnimals] = useState<AdoptableAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sex, setSex] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/adoptable-animals`)
      .then((res) => res.json())
      .then((data) => setAnimals(data.animals || []))
      .catch((err) => console.error("Error fetching adoptable animals:", err))
      .finally(() => setLoading(false));
  }, []);

  const selectClass = "px-3 py-2 border border-spur-tan rounded text-sm text-spur-black bg-white focus:outline-none focus:border-spur-orange transition-colors";

  // Every animal in the table is currently shown as available -- there's
  // no "adopted"/"pending" status concept yet (that's tied to linking
  // applications to specific animals, which is separate, not-yet-built
  // work). For now, existing in this table means available.
  const filtered = animals.filter((a) => {
    if (sex && a.sex !== sex) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-3">Adopt</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Find Your New Family Member</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Every animal here is looking for a loving forever home. Browse our available animals
            and start the adoption process today.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">

          {loading ? (
            <p className="text-gray-500 text-sm">Loading animals...</p>
          ) : animals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-sm">No adoptable animals at the moment. Check back soon!</p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-10">
                <select value={sex} onChange={(e) => setSex(e.target.value)} className={selectClass}>
                  <option value="">Any Sex</option>
                  {ALL_SEXES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {sex && (
                  <button onClick={() => setSex("")} className="px-3 py-2 text-sm text-spur-orange hover:underline">
                    Clear filters
                  </button>
                )}
              </div>

              {/* Grid */}
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-500 text-sm mb-4">No animals match your current filters.</p>
                  <button onClick={() => setSex("")} className="text-spur-orange text-sm font-semibold hover:underline">
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filtered.map((animal) => (
                    <div key={animal.animalId} className="flex flex-col rounded overflow-hidden border border-spur-tan-light hover:border-spur-tan transition-colors">
                      {/* Photo */}
                      <div className="relative aspect-[4/3] bg-spur-tan-light overflow-hidden">
                        <img
                          src={animal.thumbnailUrl}
                          alt={animal.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h2 className="text-xl font-bold text-spur-black">{animal.name}</h2>
                          <span className="text-xs font-semibold text-spur-orange uppercase tracking-wide">{animal.type}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mb-3">
                          <span>{animal.sex}</span>
                          {animal.age && (
                            <>
                              <span>·</span>
                              <span>{formatAge(animal.age)}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed mb-2 flex-1">{animal.description}</p>
                        {animal.customDescriptors && animal.customDescriptors.length > 0 && (
                          <p className="text-xs text-gray-500 mb-5">
                            {animal.customDescriptors.map((d) => `${d.label}: ${d.value}`).join(" · ")}
                          </p>
                        )}
                        <div className="flex gap-3">
                          <Link
                            href={`/adopt/${animal.animalId}`}
                            className="flex-1 text-center border border-spur-tan text-spur-black text-sm font-semibold py-2 rounded hover:border-spur-orange hover:text-spur-orange transition-colors"
                          >
                            Learn More
                          </Link>
                          <Link
                            href={`/adopt/apply?animal=${encodeURIComponent(animal.name)}`}
                            className="flex-1 text-center bg-spur-orange text-white text-sm font-semibold py-2 rounded hover:bg-spur-orange-dark transition-colors"
                          >
                            Adopt
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </section>
    </main>
  );
}
