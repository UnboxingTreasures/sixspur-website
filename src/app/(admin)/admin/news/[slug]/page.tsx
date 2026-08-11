"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

async function uploadPhoto(slugHint: string, file: File): Promise<string> {
  const presignRes = await fetch(`${API_URL}/admin/news/photo/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export default function AdminNewsEditExistingPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [form, setForm] = useState({
    title: "",
    excerpt: "",
    content: "",
    image: "",
    author: "",
  });
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/news/${slug}`);
      if (!res.ok) throw new Error("Post not found");
      const data = await res.json();
      setForm({
        title: data.title || "",
        excerpt: data.excerpt || "",
        content: data.content || "",
        image: data.image || "",
        author: data.author || "",
      });
      setIsPublished(data.isPublished === "true");
    } catch (err) {
      console.error("Error fetching post:", err);
      setError("Could not load this post.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = async (file: File) => {
    setImageFileName(file.name);
    setError("");
    try {
      setUploadingPhoto(true);
      const cdnUrl = await uploadPhoto(slug, file);
      setForm((prev) => ({ ...prev, image: cdnUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
      setImageFileName(null);
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
      const res = await fetch(`${API_URL}/admin/news/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-spur-tan-light p-8">
        <div className="max-w-3xl mx-auto bg-white rounded shadow p-8 text-center text-gray-500 text-sm">
          Loading post...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-spur-black px-7 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-base">Edit Post</div>
          <div className="text-white/50 text-xs">{isPublished ? "Published" : "Draft"}</div>
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
            Save as Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || uploadingPhoto}
            className="bg-spur-orange text-white text-sm font-semibold px-4 py-2 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Publish"}
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
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
              <p className="text-xs text-gray-400 mt-1">URL: /news/{slug} (slug can&apos;t be changed after creation)</p>
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
                  {uploadingPhoto
                    ? "Uploading..."
                    : imageFileName
                    ? `✓ ${imageFileName}`
                    : form.image
                    ? "Click to replace photo"
                    : "Click to upload a photo"}
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
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black resize-none font-sans"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
