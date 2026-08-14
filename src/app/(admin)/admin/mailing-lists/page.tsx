"use client";

import { useState, useEffect } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface SendResult {
  sent: number;
  failed: number;
  total: number;
  failedEmails?: string[];
  message?: string;
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getIdToken();
  if (!token) throw new Error("Not logged in");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

async function uploadPhoto(file: File): Promise<string> {
  const presignRes = await authedFetch("/admin/newsletter/photo/presign", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name }),
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

export default function AdminMailingListsPage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [imageFileName, setImageFileName] = useState<string | null>(null);

  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);

  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCount();
  }, []);

  const fetchCount = async () => {
    setLoadingCount(true);
    try {
      const res = await authedFetch("/admin/newsletter/subscribers");
      const data = await res.json();
      if (res.ok) setSubscriberCount(data.count);
    } catch (err) {
      console.error("Failed to load subscriber count:", err);
    } finally {
      setLoadingCount(false);
    }
  };

  const handlePhotoSelect = async (file: File) => {
    setImageFileName(file.name);
    setError("");
    try {
      setUploadingPhoto(true);
      const cdnUrl = await uploadPhoto(file);
      setImageUrl(cdnUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
      setImageFileName(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    if (imageUrl) {
      try {
        await authedFetch("/admin/newsletter/photo", {
          method: "DELETE",
          body: JSON.stringify({ imageUrl }),
        });
      } catch {
        // Non-fatal -- just a best-effort cleanup, the compose form still works either way
      }
    }
    setImageUrl("");
    setImageFileName(null);
  };

  const canSend = subject.trim().length > 0 && description.trim().length > 0 && !sending && !uploadingPhoto;

  const handleSendClick = () => {
    if (!canSend) return;
    setError("");
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await authedFetch("/admin/newsletter/send", {
        method: "POST",
        body: JSON.stringify({ subject, description, imageUrl: imageUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setResult(data);
      setSubject("");
      setDescription("");
      setImageUrl("");
      setImageFileName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send newsletter");
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "0.5rem" }}>
        Mailing List
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.5rem" }}>
        {loadingCount
          ? "Loading subscriber count…"
          : subscriberCount === 0
          ? "No active subscribers yet."
          : `${subscriberCount} active subscriber${subscriberCount === 1 ? "" : "s"}.`}
      </p>

      {result && (
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "#EAF7EE", border: "1.5px solid #C8E6D0", color: "#1E8A4C", fontSize: 13, marginBottom: "1.5rem", lineHeight: 1.5 }}>
          <strong>Sent!</strong> {result.sent} of {result.total} delivered successfully.
          {result.failed > 0 && (
            <div style={{ marginTop: 6, color: "#B5900F" }}>
              {result.failed} failed to send{result.failedEmails && result.failedEmails.length > 0 ? `: ${result.failedEmails.join(", ")}` : "."}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>
            Subject <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. September Update from Six Spur"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>
            Description <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={10}
            placeholder="Write your update here. Separate paragraphs with a blank line."
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>
            Photo <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          {imageUrl ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1.5px solid #E8E2DC", display: "block", marginBottom: 8 }} />
              <button
                onClick={removePhoto}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Remove Photo
              </button>
            </div>
          ) : (
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              border: "2px dashed #E8D5C4", borderRadius: 10, padding: "16px", cursor: uploadingPhoto ? "default" : "pointer",
              background: "#FAFAF8", fontSize: 13, color: "#E77A2D", fontWeight: 700,
            }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                disabled={uploadingPhoto}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelect(file);
                  e.target.value = "";
                }}
              />
              {uploadingPhoto ? "Uploading…" : imageFileName ? `✓ ${imageFileName}` : "Click to upload a photo"}
            </label>
          )}
        </div>

        <button
          onClick={handleSendClick}
          disabled={!canSend}
          style={{
            width: "100%", padding: "12px 20px", borderRadius: 8, border: "none",
            background: canSend ? "#E77A2D" : "#F3F4F6", color: canSend ? "#fff" : "#9CA3AF",
            fontSize: 14, fontWeight: 700, cursor: canSend ? "pointer" : "not-allowed", fontFamily: "inherit",
          }}
        >
          {sending ? "Sending…" : "Send to Mailing List"}
        </button>
      </div>

      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 8 }}>
              Send to {subscriberCount ?? "all"} subscriber{subscriberCount === 1 ? "" : "s"}?
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              This sends immediately and can&apos;t be undone or recalled once sent.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
