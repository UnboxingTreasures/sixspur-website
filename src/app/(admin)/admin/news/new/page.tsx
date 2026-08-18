"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getIdToken } from "@/lib/cognito";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

const EXCERPT_MAX = 200;

const EMPTY_FORM = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image: "",
  author: "Richard McGuire",
};

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getIdToken();
  if (!token) throw new Error("Not logged in");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

async function uploadPhoto(slugHint: string, file: File): Promise<string> {
  const presignRes = await authedFetch(`/admin/news/photo/presign`, {
    method: "POST",
    body: JSON.stringify({ slugHint, fileName: file.name }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || "Failed to get upload URL");

  const uploadRes = await fetch(presignData.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!uploadRes.ok) throw new Error("Upload to S3 failed");

  return presignData.cdnUrl;
}

export default function AdminNewsEditPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "title"
        ? { slug: value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }
        : {}),
    }));
  };

  const handlePhotoSelect = async (file: File) => {
    setImageFile(file);
    setError("");
    try {
      setUploadingPhoto(true);
      const cdnUrl = await uploadPhoto(form.slug || "post", file);
      setForm((prev) => ({ ...prev, image: cdnUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
      setImageFile(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // NEW -- clears the featured image, distinct from re-selecting a new
  // one. Public pages already handle a missing image gracefully.
  const handleRemovePhoto = () => {
    setForm((prev) => ({ ...prev, image: "" }));
    setImageFile(null);
  };

  // NEW -- equivalent of "Reset to Original" on the edit page, but for
  // a brand-new post there's no saved original to revert to -- this
  // just clears everything back to blank/defaults instead.
  const handleClearForm = () => {
    if (!confirm("Clear everything you've entered and start over?")) return;
    setForm(EMPTY_FORM);
    setImageFile(null);
    setError("");
  };

  const handleSave = async (published: boolean) => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required.");
      return;
    }
    try {
      setSaving(true);
      const res = await authedFetch(`/admin/news`, {
        method: "POST",
        body: JSON.stringify({ ...form, published }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save post");
      }
      router.push("/admin/news");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-spur-black px-7 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-base">New Post</div>
          <div className="text-white/50 text-xs">Create a news or update post</div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push("/admin/news")} className="text-white/60 text-sm hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || uploadingPhoto}
            className="bg-white/10 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || uploadingPhoto}
            className="bg-spur-orange text-white text-sm font-semibold px-4 py-2 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Publish"}
          </button>
        </div>
      </div>

      <div className="min-h-screen bg-spur-tan-light p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

          <div className="bg-white rounded shadow p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Title <span className="text-spur-orange">*</span>
              </label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Post title"
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Slug</label>
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                placeholder="auto-generated-from-title"
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">URL: /news/{form.slug || "post-slug"}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Featured Image
                <span className="ml-2 normal-case font-normal text-gray-400 lowercase">
                  shown as thumbnail on blog index and hero image at top of post — ideal size 800×500px
                </span>
              </label>

              {form.image && !uploadingPhoto && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={form.image} alt="Preview" className="mb-3 max-h-48 rounded border border-gray-200 object-cover" />
              )}

              <div className="flex items-center gap-3">
                <label
                  className={`inline-flex items-center gap-2 border-2 rounded px-4 py-2 cursor-pointer transition-colors text-sm font-semibold ${
                    form.image ? "border-spur-orange text-spur-orange hover:bg-orange-50" : "border-gray-300 text-gray-600 hover:border-spur-orange hover:text-spur-orange"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoSelect(file);
                    }}
                  />
                  {uploadingPhoto ? "Uploading..." : form.image ? `✓ ${imageFile?.name || "Photo uploaded"}` : "Upload a photo"}
                </label>
                {form.image && !uploadingPhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-red-500 text-sm font-semibold hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Author</label>
              <input
                name="author"
                value={form.author}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Excerpt</label>
                <span className="text-xs text-gray-400">
                  {form.excerpt.length}/{EXCERPT_MAX} — teaser text shown on blog index beneath the title
                </span>
              </div>
              <textarea
                name="excerpt"
                value={form.excerpt}
                onChange={handleChange}
                maxLength={EXCERPT_MAX}
                rows={2}
                placeholder="Short summary shown on the news listing page"
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black resize-none"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Content <span className="text-spur-orange">*</span>
                </label>
                <span className="text-xs text-gray-400">{form.content.length} characters</span>
              </div>
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                rows={16}
                placeholder="Write your post here. Separate paragraphs with a blank line."
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black resize-none font-sans"
              />
            </div>
          </div>

          <div className="flex justify-start">
            <button
              type="button"
              onClick={handleClearForm}
              className="text-gray-400 text-xs font-semibold hover:text-gray-600 hover:underline"
            >
              ↺ Clear Form
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
