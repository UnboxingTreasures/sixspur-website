"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  publishedAt: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/news`)
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching news:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = posts.filter((post) => {
    const d = new Date(post.publishedAt);
    if (selectedMonth && d.getMonth() !== parseInt(selectedMonth)) return false;
    if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
    return true;
  });

  const selectClass = "px-3 py-2 border border-spur-tan rounded text-sm text-spur-black bg-white focus:outline-none focus:border-spur-orange transition-colors";

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-3">News</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">News & Updates</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Stories from the ranch, rescue updates, and everything happening at Six Spur.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-3 mb-10">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={selectClass}>
              <option value="">All Months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>

            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={selectClass}>
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {(selectedMonth || selectedYear) && (
              <button
                onClick={() => { setSelectedMonth(""); setSelectedYear(""); }}
                className="px-3 py-2 text-sm text-spur-orange hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Loading posts...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">No posts found for the selected filters.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((post) => (
                <Link key={post.slug} href={`/news/${post.slug}`} className="group flex flex-col">
                  <div className="relative aspect-[16/9] bg-spur-tan-light rounded overflow-hidden mb-4">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h2 className="font-bold text-spur-black text-lg leading-snug mb-2 group-hover:text-spur-orange transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3 flex-1">{post.excerpt}</p>
                  <p className="text-xs text-gray-400">{formatDate(post.publishedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
