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

// Comments -- matches Unboxing Treasures' shape: flat list, replies
// carry a parentCommentId pointing at their top-level parent. Grouped
// into a tree client-side (see buildCommentTree below) rather than by
// the backend, which just returns everything in one flat query.
interface Comment {
  commentId: string;
  donorName: string;
  isAdminComment: boolean;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
}

const MAX_COMMENT_LENGTH = 1000;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCommentDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Auto-links bare URLs inside comment text -- matches Unboxing
// Treasures showing a clickable link in its example comment. Simple
// regex split, not a full markdown parser -- fine for the "share a
// link" use case this is actually for.
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
function linkifyBody(body: string) {
  const parts = body.split(URL_PATTERN);
  return parts.map((part, i) =>
    URL_PATTERN.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-spur-orange underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// Groups the flat comment list into top-level comments each carrying
// their own replies array. One level of nesting only -- a reply can't
// itself be replied to, matching what the backend enforces and what
// Unboxing Treasures' UI actually supports.
function buildCommentTree(comments: Comment[]) {
  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesByParent: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (c.parentCommentId) {
      repliesByParent[c.parentCommentId] = repliesByParent[c.parentCommentId] || [];
      repliesByParent[c.parentCommentId].push(c);
    }
  }
  return topLevel.map((c) => ({ comment: c, replies: repliesByParent[c.commentId] || [] }));
}

export default function NewsPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [needsName, setNeedsName] = useState(false);

  // Reply state -- which comment's reply box is open, its draft text,
  // and posting/error state, all keyed by the parent commentId so
  // multiple reply boxes never interfere with each other.
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [replyError, setReplyError] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetch(`${API_URL}/news/${slug}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments || []))
      .catch((err) => console.error("Error fetching comments:", err))
      .finally(() => setCommentsLoading(false));

    // isAdmin reuses the same localStorage flag Nav.tsx already
    // maintains (set/cleared on every login/logout/route change) --
    // avoids a second /donor/profile fetch just to check admin status
    // on this page.
    getIdToken().then((token) => {
      setIsLoggedIn(Boolean(token));
      setIsAdmin(typeof window !== "undefined" && window.localStorage.getItem("sixspur_isAdmin") === "true");
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
        if (data.code === "NO_NAME_SET") setNeedsName(true);
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

  const submitReply = async (parentCommentId: string) => {
    if (!replyDraft.trim()) return;
    setPostingReply(true);
    setReplyError("");

    const token = await getIdToken();
    if (!token) {
      router.push(`/account/login?returnTo=${encodeURIComponent(`/news/${slug}`)}`);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/news/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: replyDraft.trim(), parentCommentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post reply");
      setComments((prev) => [...prev, data]);
      setReplyDraft("");
      setOpenReplyFor(null);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setPostingReply(false);
    }
  };

  // Inline admin delete -- soft-deletes on the backend, but this page
  // just removes it from local state immediately rather than waiting
  // for a refetch, since the admin's own action is the source of truth
  // for what they just did.
  const deleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    setDeletingId(commentId);
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_URL}/admin/news/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete comment");
      setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setDeletingId(null);
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

  const tree = buildCommentTree(comments);

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

          {/* Comments -- matches Unboxing Treasures' card-per-comment
              style: light box, circular initial avatar, name + Admin
              badge, date, inline admin Delete, Reply, one level of
              nested replies. */}
          <div className="mt-16 pt-10 border-t border-spur-tan-light">
            <h2 className="text-xl font-bold text-spur-black mb-6">
              Comments{comments.length > 0 ? ` (${comments.length})` : ""}
            </h2>

            {commentsLoading ? (
              <p className="text-gray-400 text-sm">Loading comments...</p>
            ) : tree.length === 0 ? (
              <p className="text-gray-400 text-sm mb-8">Be the first to comment.</p>
            ) : (
              <div className="space-y-4 mb-10">
                {tree.map(({ comment, replies }) => (
                  <div key={comment.commentId}>
                    <CommentCard
                      comment={comment}
                      isAdmin={isAdmin}
                      deletingId={deletingId}
                      onDelete={deleteComment}
                      onReplyClick={() => { setOpenReplyFor(openReplyFor === comment.commentId ? null : comment.commentId); setReplyDraft(""); setReplyError(""); }}
                      replyOpen={openReplyFor === comment.commentId}
                    />

                    {openReplyFor === comment.commentId && (
                      <div className="ml-11 mt-2">
                        <textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          rows={2}
                          maxLength={MAX_COMMENT_LENGTH}
                          placeholder={`Reply to ${comment.donorName}...`}
                          className="w-full px-3 py-2 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black text-sm resize-vertical"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">{replyDraft.length}/{MAX_COMMENT_LENGTH}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setOpenReplyFor(null)}
                              className="text-gray-400 text-xs font-semibold hover:underline"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => submitReply(comment.commentId)}
                              disabled={postingReply || !replyDraft.trim()}
                              className="bg-spur-orange text-white font-semibold px-4 py-1.5 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-40 text-xs"
                            >
                              {postingReply ? "Posting..." : "Post Reply"}
                            </button>
                          </div>
                        </div>
                        {replyError && <p className="text-red-600 text-xs mt-1">{replyError}</p>}
                      </div>
                    )}

                    {replies.length > 0 && (
                      <div className="ml-11 mt-2 space-y-2">
                        {replies.map((reply) => (
                          <CommentCard
                            key={reply.commentId}
                            comment={reply}
                            isAdmin={isAdmin}
                            deletingId={deletingId}
                            onDelete={deleteComment}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Leave a Comment */}
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
                <h3 className="text-sm font-bold text-spur-black mb-2">Leave a Comment</h3>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  maxLength={MAX_COMMENT_LENGTH}
                  placeholder="Share your thoughts..."
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black text-sm resize-vertical"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">{newComment.length}/{MAX_COMMENT_LENGTH}</span>
                  <button
                    onClick={submitComment}
                    disabled={posting || !newComment.trim()}
                    className="bg-spur-orange text-white font-semibold px-5 py-2 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {posting ? "Posting..." : "Post Comment"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Comments appear immediately.</p>
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

// Single comment (or reply) card. Replies pass no onReplyClick/replyOpen
// -- Reply is only offered on top-level comments, matching the one-level
// nesting rule.
function CommentCard({
  comment,
  isAdmin,
  deletingId,
  onDelete,
  onReplyClick,
  replyOpen,
}: {
  comment: Comment;
  isAdmin: boolean;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onReplyClick?: () => void;
  replyOpen?: boolean;
}) {
  const initial = comment.donorName.charAt(0).toUpperCase();
  return (
    <div className="bg-spur-tan-light rounded p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-spur-orange text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </div>
          <span className="font-semibold text-spur-black text-sm">{comment.donorName}</span>
          {comment.isAdminComment && (
            <span className="bg-spur-black text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">
              Admin
            </span>
          )}
          <span className="text-gray-400 text-xs">{formatCommentDate(comment.createdAt)}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => onDelete(comment.commentId)}
            disabled={deletingId === comment.commentId}
            className="text-red-500 text-xs font-semibold hover:underline whitespace-nowrap disabled:opacity-50"
          >
            {deletingId === comment.commentId ? "Deleting…" : "✕ Delete"}
          </button>
        )}
      </div>
      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mt-2">{linkifyBody(comment.body)}</p>
      {onReplyClick && (
        <button
          onClick={onReplyClick}
          className="text-spur-orange text-xs font-semibold hover:underline mt-2"
        >
          {replyOpen ? "Cancel Reply" : "Reply"}
        </button>
      )}
    </div>
  );
}
