"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getIdToken } from "@/lib/cognito";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

interface Post {
  slug: string;
  title: string;
  date?: string;
  publishedAt: string;
  category: string;
  isPublished: string;
  isArchived?: string;
  archivedAt?: string;
}

interface Comment {
  commentId: string;
  slug: string;
  donorName: string;
  body: string;
  isDeleted: boolean;
  createdAt: string;
  deletedAt?: string;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getIdToken();
  if (!token) throw new Error("Not logged in");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

export default function AdminNewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archivingSlug, setArchivingSlug] = useState<string | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
    fetchComments();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await authedFetch("/admin/news");
      if (!res.ok) throw new Error("Failed to load posts");
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      setCommentsLoading(true);
      const res = await authedFetch("/admin/news/comments");
      if (!res.ok) throw new Error("Failed to load comments");
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error fetching comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment? It will be hidden from the public post immediately.")) return;
    setDeletingCommentId(commentId);
    try {
      const res = await authedFetch(`/admin/news/comments/${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete comment");
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.commentId === commentId ? updated : c)));
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete comment. Please try again.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const togglePublished = async (slug: string, currentlyPublished: boolean) => {
    try {
      const res = await authedFetch(`/admin/news/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ published: !currentlyPublished }),
      });
      if (!res.ok) throw new Error("Failed to update post");
      setPosts((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, isPublished: (!currentlyPublished).toString() } : p))
      );
    } catch (err) {
      console.error("Error toggling published status:", err);
      alert(err instanceof Error ? err.message : "Failed to update post status. Please try again.");
    }
  };

  const deletePost = async (slug: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      const res = await authedFetch(`/admin/news/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      setPosts((prev) => prev.filter((p) => p.slug !== slug));
    } catch (err) {
      console.error("Error deleting post:", err);
      alert(err instanceof Error ? err.message : "Failed to delete post. Please try again.");
    }
  };

  const archivePost = async (slug: string) => {
    if (!confirm("Archive this post? It'll move to the archive below for admin organization — it stays visible on the public news pages exactly as it does now.")) return;
    setArchivingSlug(slug);
    try {
      const res = await authedFetch(`/admin/news/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      if (!res.ok) throw new Error("Failed to archive post");
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.slug === slug ? updated : p)));
    } catch (err) {
      console.error("Error archiving post:", err);
      alert(err instanceof Error ? err.message : "Failed to archive post. Please try again.");
    } finally {
      setArchivingSlug(null);
    }
  };

  const activePosts = useMemo(() => posts.filter((p) => p.isArchived !== "true"), [posts]);
  const archivedPosts = useMemo(
    () =>
      posts
        .filter((p) => p.isArchived === "true")
        .sort((a, b) => new Date(b.archivedAt || b.publishedAt).getTime() - new Date(a.archivedAt || a.publishedAt).getTime()),
    [posts]
  );

  const availableYears = useMemo(() => {
    const years = new Set(archivedPosts.map((p) => new Date(p.archivedAt || p.publishedAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [archivedPosts]);

  const RECENT_ARCHIVE_LIMIT = 5;

  const filteredArchivedPosts = useMemo(() => {
    if (selectedYear === "all") return archivedPosts.slice(0, RECENT_ARCHIVE_LIMIT);
    return archivedPosts.filter((p) => {
      const date = new Date(p.archivedAt || p.publishedAt);
      if (date.getFullYear() !== Number(selectedYear)) return false;
      if (selectedMonth !== "all" && date.getMonth() !== Number(selectedMonth)) return false;
      return true;
    });
  }, [archivedPosts, selectedYear, selectedMonth]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth("all");
  };

  const postTitleBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of posts) map[p.slug] = p.title;
    return map;
  }, [posts]);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments]
  );

  return (
    <>
      <div className="bg-spur-black px-7 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-base">News & Updates</div>
          <div className="text-white/50 text-xs">{activePosts.length} post{activePosts.length !== 1 ? "s" : ""}</div>
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
          ) : activePosts.length === 0 ? (
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
                  {activePosts.map((post) => {
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
                          <button
                            onClick={() => archivePost(post.slug)}
                            disabled={archivingSlug === post.slug}
                            className="text-gray-400 text-xs font-semibold hover:underline mr-4 disabled:opacity-50"
                          >
                            {archivingSlug === post.slug ? "Archiving…" : "Archive"}
                          </button>
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

          {!loading && archivedPosts.length > 0 && (
            <div className="mt-10">
              <button
                type="button"
                onClick={() => setArchiveOpen((open) => !open)}
                className="w-full flex items-center justify-between mb-1 bg-transparent border-none cursor-pointer p-0"
              >
                <h2 className="text-sm font-bold text-gray-500">Archive ({archivedPosts.length})</h2>
                <span className="text-gray-400 text-xs">{archiveOpen ? "▾" : "▸"}</span>
              </button>
              <p className="text-xs text-gray-400 mb-4">
                Admin-only organization — these stay visible on the public news pages, view-only here.
                {selectedYear === "all" && archivedPosts.length > RECENT_ARCHIVE_LIMIT && (
                  <> Showing the {RECENT_ARCHIVE_LIMIT} most recent — pick a year to see the rest.</>
                )}
              </p>

              {archiveOpen && (
                <>
                  <div className="flex gap-2 mb-4">
                    <select
                      value={selectedYear}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      disabled={selectedYear === "all"}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed"
                    >
                      <option value="all">All Months</option>
                      {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {filteredArchivedPosts.length === 0 ? (
                    <p className="text-gray-400 text-sm">No archived posts in this period.</p>
                  ) : (
                    <div className="bg-gray-50 rounded shadow-sm overflow-hidden border border-gray-100">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Archived</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredArchivedPosts.map((post) => (
                            <tr key={post.slug}>
                              <td className="px-6 py-4 text-sm text-gray-500">{post.title}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-xs font-semibold rounded">
                                  {post.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                                {formatDate(post.archivedAt || post.publishedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!commentsLoading && comments.length > 0 && (
            <div className="mt-10">
              <button
                type="button"
                onClick={() => setCommentsOpen((open) => !open)}
                className="w-full flex items-center justify-between mb-1 bg-transparent border-none cursor-pointer p-0"
              >
                <h2 className="text-sm font-bold text-gray-500">
                  Comments ({sortedComments.filter((c) => !c.isDeleted).length})
                </h2>
                <span className="text-gray-400 text-xs">{commentsOpen ? "▾" : "▸"}</span>
              </button>
              <p className="text-xs text-gray-400 mb-4">
                Deleting a comment hides it from the public post immediately. Deleted comments stay listed here, greyed out, for reference.
              </p>

              {commentsOpen && (
                <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Author</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Comment</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Post</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedComments.map((c) => (
                        <tr key={c.commentId} className={c.isDeleted ? "bg-gray-50 opacity-50" : "hover:bg-gray-50 transition-colors"}>
                          <td className="px-6 py-4 text-sm font-semibold text-spur-black whitespace-nowrap">{c.donorName}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            <span title={c.body}>{c.body.length > 100 ? `${c.body.slice(0, 100)}…` : c.body}</span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <Link href={`/news/${c.slug}`} target="_blank" className="text-spur-orange hover:underline">
                              {postTitleBySlug[c.slug] || c.slug}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {c.isDeleted ? (
                              <span className="text-gray-400 text-xs font-semibold">Deleted</span>
                            ) : (
                              <button
                                onClick={() => deleteComment(c.commentId)}
                                disabled={deletingCommentId === c.commentId}
                                className="text-red-400 text-xs font-semibold hover:underline disabled:opacity-50"
                              >
                                {deletingCommentId === c.commentId ? "Deleting…" : "Delete"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
