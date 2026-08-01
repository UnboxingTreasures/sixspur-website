"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  category: string;
  image: string;
  author: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function NewsPostPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/news/${slug}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setPost(data);
      })
      .catch((err) => {
        console.error("Error fetching post:", err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white py-24 px-6 text-center text-gray-500 text-sm">
        Loading post...
      </main>
    );
  }

  if (notFound || !post) {
    return (
      <main className="min-h-screen bg-white py-24 px-6 text-center">
        <p className="text-gray-500 mb-4">This post couldn't be found.</p>
        <Link href="/news" className="text-spur-orange font-semibold text-sm hover:underline">
          ← Back to News
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/news" className="text-spur-orange text-sm font-semibold hover:underline mb-6 inline-block">
            ← Back to News
          </Link>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="eyebrow">{post.category}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{post.title}</h1>
          <div className="flex items-center gap-3 text-white/50 text-sm">
            <span>{post.author}</span>
            <span>·</span>
            <span>{formatDate(post.publishedAt)}</span>
          </div>
        </div>
      </section>

      {post.image && (
        <div className="w-full aspect-[21/9] bg-spur-tan-light overflow-hidden">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="prose prose-gray max-w-none">
            {post.content.split("\n\n").map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed mb-6">{para}</p>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-spur-tan-light flex flex-wrap items-center justify-between gap-4">
            <Link href="/news" className="text-spur-orange font-semibold text-sm hover:underline">
              ← Back to News
            </Link>
            <Link
              href="/ways-to-give"
              className="bg-spur-orange text-white font-semibold px-6 py-2 rounded hover:bg-spur-orange-dark transition-colors text-sm"
            >
              Support the Ranch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
