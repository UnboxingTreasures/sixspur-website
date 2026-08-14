"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getIdToken } from "@/lib/cognito";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

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

  // The actual S3 PUT uses the presigned URL itself as authorization --
  // no bearer token here, and none needed; adding one would break the
  // presigned signature.
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
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    image: "",
    author: "Richard McGuire",
  });
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
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Photo</label>
              <label
                className={`flex items-center justify-center gap-2 border-2 border-dashed rounded px-4 py-6 cursor-pointer transition-colors ${
                  form.image ? "border-spur-orange bg-orange-50" : "border-gray-300 hover:border-spur-orange"
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
                <span className="text-sm font-semibold text-spur-orange">
                  {uploadingPhoto ? "Uploading..." : form.image ? `✓ ${imageFile?.name || "Photo uploaded"}` : "Click to upload a photo"}
                </span>
              </label>
              {form.image && !uploadingPhoto && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={form.image} alt="Preview" className="mt-3 max-h-48 rounded border border-gray-200 object-cover" />
              )}
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
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Excerpt</label>
              <textarea
                name="excerpt"
                value={form.excerpt}
                onChange={handleChange}
                rows={2}
                placeholder="Short summary shown on the news listing page"
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Content <span className="text-spur-orange">*</span>
              </label>
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
        </div>
      </div>
    </>
  );
}
