"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

interface Post {
  slug: string;
  title: string;
  date?: string;
  publishedAt: string;
  category: string;
  isPublished: string; // "true" | "false"
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminNewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/news`);
      if (!res.ok) throw new Error("Failed to load posts");
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError("Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const togglePublished = async (slug: string, currentlyPublished: boolean) => {
    try {
      const res = await fetch(`${API_URL}/admin/news/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !currentlyPublished }),
      });
      if (!res.ok) throw new Error("Failed to update post");
      setPosts((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, isPublished: (!currentlyPublished).toString() } : p))
      );
    } catch (err) {
      console.error("Error toggling published status:", err);
      alert("Failed to update post status. Please try again.");
    }
  };

  const deletePost = async (slug: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/admin/news/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Failed to delete post. Please try again.");
    }
  };

  return (
    <>
      <div className="bg-spur-black px-7 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-base">News & Updates</div>
          <div className="text-white/50 text-xs">{posts.length} post{posts.length !== 1 ? "s" : ""}</div>
        </div>
        <Link
          href="/admin/news/new"
          className="bg-spur-orange text-white text-sm font-semibold px-4 py-2 rounded hover:bg-spur-orange-dark transition-colors"
        >
          + New Post
        </Link>
      </div>

      <div className="min-h-screen bg-spur-tan-light p-8">
        <div className="max-w-5xl mx-auto">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
          )}

          {loading ? (
            <div className="bg-white rounded shadow p-8 text-center text-gray-500 text-sm">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="bg-white rounded shadow p-8 text-center text-gray-500 text-sm">
              No posts yet. Create your first post to get started.
            </div>
          ) : (
            <div className="bg-white rounded shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.map((post) => {
                    const isPublished = post.isPublished === "true";
                    return (
                      <tr key={post.slug} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/admin/news/${post.slug}`} className="font-semibold text-spur-black hover:text-spur-orange text-sm transition-colors">
                            {post.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-spur-orange-light text-spur-orange text-xs font-semibold rounded">
                            {post.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(post.publishedAt)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => togglePublished(post.slug, isPublished)}
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {isPublished ? "Published" : "Draft"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link href={`/admin/news/${post.slug}`} className="text-spur-orange text-xs font-semibold hover:underline mr-4">
                            Edit
                          </Link>
                          <button onClick={() => deletePost(post.slug)} className="text-red-400 text-xs font-semibold hover:underline">
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
