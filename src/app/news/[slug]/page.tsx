"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getIdToken } from "@/lib/cognito";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  image: string;
  author: string;
}

// NEW (Session 20) -- blog comments.
interface Comment {
  commentId: string;
  donorName: string;
  body: string;
  createdAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCommentDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NewsPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // NEW (Session 20) -- comments state, separate from the post fetch
  // above since they come from a different endpoint and load
  // independently (comments shouldn't block the post content from
  // rendering, and vice versa).
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [needsName, setNeedsName] = useState(false);

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

  // NEW (Session 20) -- loads the comment thread and checks login
  // status independently of the post fetch above.
  useEffect(() => {
    fetch(`${API_URL}/news/${slug}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments || []))
      .catch((err) => console.error("Error fetching comments:", err))
      .finally(() => setCommentsLoading(false));

    getIdToken().then((token) => {
      setIsLoggedIn(Boolean(token));
      setCheckingAuth(false);
    });
  }, [slug]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    setPostError("");
    setNeedsName(false);

    const token = await getIdToken();
    if (!token) {
      router.push(`/account/login?returnTo=${encodeURIComponent(`/news/${slug}`)}`);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/news/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "NO_NAME_SET") {
          setNeedsName(true);
        }
        throw new Error(data.error || "Failed to post comment");
      }
      setComments((prev) => [...prev, data]);
      setNewComment("");
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

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

          {/* Comments -- NEW (Session 20) */}
          <div className="mt-16 pt-10 border-t border-spur-tan-light">
            <h2 className="text-xl font-bold text-spur-black mb-6">
              Comments{comments.length > 0 ? ` (${comments.length})` : ""}
            </h2>

            {commentsLoading ? (
              <p className="text-gray-400 text-sm">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-gray-400 text-sm mb-8">Be the first to comment.</p>
            ) : (
              <div className="space-y-6 mb-10">
                {comments.map((c) => (
                  <div key={c.commentId} className="border-b border-spur-tan-light pb-6 last:border-b-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-spur-black text-sm">{c.donorName}</span>
                      <span className="text-gray-400 text-xs">{formatCommentDate(c.createdAt)}</span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Comment form -- three states: checking auth (brief),
                logged out (prompt to log in), logged in (real form).
                Not gating on whether a name is set client-side -- that
                check happens server-side on submit and surfaces as
                needsName below, since a name could be added/removed
                between page load and submit anyway. */}
            {checkingAuth ? null : !isLoggedIn ? (
              <div className="bg-spur-tan-light rounded p-5 text-sm">
                <Link
                  href={`/account/login?returnTo=${encodeURIComponent(`/news/${slug}`)}`}
                  className="text-spur-orange font-semibold hover:underline"
                >
                  Log in
                </Link>
                {" "}to leave a comment.
              </div>
            ) : (
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Share your thoughts..."
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black text-sm resize-vertical"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">{newComment.length}/2000</span>
                  <button
                    onClick={submitComment}
                    disabled={posting || !newComment.trim()}
                    className="bg-spur-orange text-white font-semibold px-5 py-2 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {posting ? "Posting..." : "Post Comment"}
                  </button>
                </div>
                {postError && (
                  <p className="text-red-600 text-sm mt-2">
                    {postError}
                    {needsName && (
                      <>
                        {" "}
                        <Link href="/account" className="font-semibold underline">Go to Account Settings →</Link>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
