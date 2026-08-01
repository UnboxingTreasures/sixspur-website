"use client";

import { useState } from "react";
import Link from "next/link";
import dogs from "@/data/dogs.json";

const ALL_GENDERS = ["Male", "Female"];

export default function AdoptPage() {
  const [gender, setGender] = useState("");

  const selectClass = "px-3 py-2 border border-spur-tan rounded text-sm text-spur-black bg-white focus:outline-none focus:border-spur-orange transition-colors";

  const filtered = dogs.filter((a) => {
    if (a.status !== "available") return false;
    if (gender && a.gender !== gender) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
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

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-10">
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
              <option value="">Any Gender</option>
              {ALL_GENDERS.map((g) => <option key={g}>{g}</option>)}
            </select>
            {gender && (
              <button onClick={() => setGender("")} className="px-3 py-2 text-sm text-spur-orange hover:underline">
                Clear filters
              </button>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-sm mb-4">No animals match your current filters.</p>
              <button onClick={() => setGender("")} className="text-spur-orange text-sm font-semibold hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((animal) => (
                <div key={animal.id} className="flex flex-col rounded overflow-hidden border border-spur-tan-light hover:border-spur-tan transition-colors">
                  {/* Photo */}
                  <div className="relative aspect-[4/3] bg-spur-tan-light overflow-hidden">
                    <img
                      src={animal.image}
                      alt={animal.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h2 className="text-xl font-bold text-spur-black">{animal.name}</h2>
                      <span className="text-xs font-semibold text-spur-orange uppercase tracking-wide">{animal.breed}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500 mb-3">
                      <span>{animal.gender}</span>
                      <span>·</span>
                      <span>{animal.age}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-5 flex-1">{animal.description}</p>
                    <div className="flex gap-3">
                      <Link
                        href={`/adopt/${animal.id}`}
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

          {/* General apply CTA */}
          <div className="mt-16 border-t border-spur-tan-light pt-12 text-center">
            <p className="text-gray-600 text-sm mb-4">Don't see the right match yet? Submit a general application and we'll reach out when a new animal becomes available.</p>
            <Link href="/adopt/apply" className="inline-block bg-spur-orange text-white font-semibold px-8 py-3 rounded hover:bg-spur-orange-dark transition-colors">
              Submit a General Application
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}
