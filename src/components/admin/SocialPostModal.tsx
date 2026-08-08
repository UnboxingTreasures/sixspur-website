"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL  = process.env.NEXT_PUBLIC_API_URL;
const CDN_BASE = "https://d1s8s7aw8vf5zu.cloudfront.net";
const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif";

const PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: "📸", limit: 2200,  active: true, requiresImage: true  },
  { key: "facebook",  label: "Facebook",  icon: "👥", limit: 63206, active: true, requiresImage: false },
];

interface PostResult {
  success: boolean;
  post_url?: string;
  message?: string;
}

interface SocialPostModalProps {
  onClose: () => void;
}

export default function SocialPostModal({ onClose }: SocialPostModalProps) {
  const [activeTab, setActiveTab]   = useState("instagram");
  const [text, setText]             = useState<Record<string, string>>({ instagram: "", facebook: "" });
  const [imageUrl, setImageUrl]     = useState<Record<string, string>>({ instagram: "", facebook: "" });
  const [imageMode, setImageMode]   = useState<Record<string, "url" | "upload">>({ instagram: "url", facebook: "url" });
  const [uploading, setUploading]   = useState<Record<string, boolean>>({ instagram: false, facebook: false });
  const [uploadMsg, setUploadMsg]   = useState<Record<string, string>>({ instagram: "", facebook: "" });
  const [posting, setPosting]       = useState<Record<string, boolean>>({ instagram: false, facebook: false });
  const [results, setResults]       = useState<Record<string, PostResult | null>>({ instagram: null, facebook: null });

  const platform         = PLATFORMS.find(p => p.key === activeTab)!;
  const currentText      = text[activeTab] || "";
  const currentImageUrl  = imageUrl[activeTab] || "";
  const charsLeft        = platform.limit - currentText.length;
  const isOverLimit      = charsLeft < 0;
  const hasRequiredImage = !platform.requiresImage || currentImageUrl.trim().length > 0;
  const canPost           = platform.active && currentText.trim().length > 0 && !isOverLimit && hasRequiredImage && !posting[activeTab] && !uploading[activeTab];

  // ESC to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  // ── Photo upload ──────────────────────────────────────────────────────────
  // NOTE: Six Spur has no admin auth (Cognito) yet — that's Session 8 scope.
  // This calls the presigned-url endpoint with no Authorization header, matching
  // the current (temporary, unprotected) state of the rest of /admin.
  const handleImageUpload = async (file: File, tab: string) => {
    if (!file) return;
    setUploading(u => ({ ...u, [tab]: true }));
    setUploadMsg(m => ({ ...m, [tab]: "Uploading…" }));
    setImageUrl(u => ({ ...u, [tab]: "" }));

    try {
      // 1. Get presigned URL
      const presignRes = await fetch(`${API_URL}/admin/social/presigned-url`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      const presignData = await presignRes.json();
      if (!presignData.success) throw new Error(presignData.message || "Failed to get upload URL");

      // 2. PUT file directly to S3
      const uploadRes = await fetch(presignData.presigned_url, {
        method:  "PUT",
        body:    file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("S3 upload failed");

      // 3. Build CloudFront URL from the staging key
      const cdnUrl = `${CDN_BASE}/${presignData.staging_key}`;
      setImageUrl(u => ({ ...u, [tab]: cdnUrl }));
      setUploadMsg(m => ({ ...m, [tab]: "✓ Photo ready" }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadMsg(m => ({ ...m, [tab]: `✕ ${msg}` }));
    } finally {
      setUploading(u => ({ ...u, [tab]: false }));
    }
  };

  // ── Post ─────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!canPost) return;
    const tab = activeTab;
    setPosting(p => ({ ...p, [tab]: true }));
    setResults(r => ({ ...r, [tab]: null }));

    try {
      if (tab === "instagram") {
        const res  = await fetch(`${API_URL}/admin/social/post-to-instagram`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ caption: currentText, image_url: currentImageUrl }),
        });
        const data = await res.json();
        setResults(r => ({ ...r, instagram: data }));

      } else if (tab === "facebook") {
        const res  = await fetch(`${API_URL}/admin/social/post-to-facebook`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message: currentText, ...(currentImageUrl ? { image_url: currentImageUrl } : {}) }),
        });
        const data = await res.json();
        setResults(r => ({ ...r, facebook: data }));
      }

    } catch {
      setResults(r => ({ ...r, [tab]: { success: false, message: "Network error — please try again." } }));
    } finally {
      setPosting(p => ({ ...p, [tab]: false }));
    }
  };

  const postUrl = results[activeTab]?.post_url;

  // ── Image section (URL or Upload toggle) ─────────────────────────────────
  const renderImageSection = () => {
    const isRequired = activeTab === "instagram";
    const mode       = imageMode[activeTab];
    const isUp       = uploading[activeTab];
    const msg        = uploadMsg[activeTab];
    const uploadOk   = msg.startsWith("✓");
    const uploadErr  = msg.startsWith("✕");

    return (
      <div style={{ marginBottom: 16 }}>
        {/* Label + toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#E77A2D" }}>
            Image{isRequired && <span style={{ color: "#DC2626" }}> *</span>}
            {!isRequired && <span style={{ color: "#9CA3AF", fontWeight: 400 }}> (optional)</span>}
          </label>
          <div style={{ display: "flex", background: "#F7F4F0", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["url", "upload"] as const).map(m => (
              <button
                key={m}
                onClick={() => {
                  setImageMode(im => ({ ...im, [activeTab]: m }));
                  setImageUrl(u => ({ ...u, [activeTab]: "" }));
                  setUploadMsg(um => ({ ...um, [activeTab]: "" }));
                  setResults(r => ({ ...r, [activeTab]: null }));
                }}
                style={{
                  padding: "3px 10px", border: "none", borderRadius: 6,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: mode === m ? "#fff" : "transparent",
                  color: mode === m ? "#E77A2D" : "#9CA3AF",
                  boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {m === "url" ? "🔗 URL" : "📤 Upload"}
              </button>
            ))}
          </div>
        </div>

        {mode === "url" ? (
          <>
            <input
              type="url"
              placeholder="https://d1s8s7aw8vf5zu.cloudfront.net/..."
              value={currentImageUrl}
              onChange={e => {
                setImageUrl(u => ({ ...u, [activeTab]: e.target.value }));
                setResults(r => ({ ...r, [activeTab]: null }));
              }}
              style={{
                width: "100%", boxSizing: "border-box",
                border: "1.5px solid #E8E2DC", borderRadius: 10,
                padding: "10px 14px", fontFamily: "inherit",
                fontSize: 13, color: "#111111", background: "#fff", outline: "none",
              }}
              onFocus={e => { e.target.style.borderColor = "#E77A2D"; }}
              onBlur={e  => { e.target.style.borderColor = "#E8E2DC"; }}
            />
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
              Must be a publicly accessible URL — CloudFront links from sixspurranch-assets work.
            </div>
          </>
        ) : (
          <>
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 8,
              border: `2px dashed ${uploadOk ? "#E77A2D" : uploadErr ? "#DC2626" : "#E8D5C4"}`,
              borderRadius: 10, padding: "20px 16px",
              background: uploadOk ? "#FEF3EB" : "#FAFAF8",
              cursor: isUp ? "default" : "pointer",
              transition: "all 0.15s",
            }}>
              <input
                type="file"
                accept={ACCEPTED}
                style={{ display: "none" }}
                disabled={isUp}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, activeTab);
                  e.target.value = "";
                }}
              />
              {isUp ? (
                <span style={{ fontSize: 13, color: "#9CA3AF" }}>⏳ Uploading…</span>
              ) : uploadOk ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#E77A2D" }}>✓ Photo ready</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Click to replace</span>
                </>
              ) : uploadErr ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>{msg}</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Click to try again</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 28 }}>🖼️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#E77A2D" }}>Click to choose a photo</span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>JPG, PNG, WebP or GIF</span>
                </>
              )}
            </label>
            {uploadOk && currentImageUrl && (
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 4, wordBreak: "break-all" }}>
                {currentImageUrl}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "#FFFFFF",
        borderRadius: 12,
        width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        fontFamily: "inherit",
      }}>

        {/* Header */}
        <div style={{
          background: "#111111", padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderRadius: "12px 12px 0 0",
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Post to Social Media</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>
              Compose and publish to your social accounts
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", borderRadius: 8, width: 32, height: 32,
              cursor: "pointer", fontSize: 16, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1.5px solid #E8E2DC", background: "#fff" }}>
          {PLATFORMS.map(p => (
            <button
              key={p.key}
              onClick={() => {
                setActiveTab(p.key);
                setResults({ instagram: null, facebook: null });
              }}
              style={{
                flex: 1, padding: "14px 8px",
                border: "none", background: "none", cursor: "pointer",
                borderBottom: activeTab === p.key ? "2.5px solid #E77A2D" : "2.5px solid transparent",
                color: activeTab === p.key ? "#E77A2D" : "#6B7280",
                fontWeight: activeTab === p.key ? 700 : 400,
                fontSize: 13, fontFamily: "inherit",
                transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Composer */}
        <div style={{ padding: 24 }}>
          {(activeTab === "instagram" || activeTab === "facebook") && renderImageSection()}

          <textarea
            value={currentText}
            onChange={e => {
              setText(t => ({ ...t, [activeTab]: e.target.value }));
              setResults(r => ({ ...r, [activeTab]: null }));
            }}
            placeholder={platform.requiresImage ? "Write your caption..." : `Write your ${platform.label} post...`}
            rows={6}
            style={{
              width: "100%", boxSizing: "border-box",
              border: `1.5px solid ${isOverLimit ? "#DC2626" : "#E8E2DC"}`,
              borderRadius: 10, padding: "14px 16px",
              fontFamily: "inherit", fontSize: 14,
              color: "#111111", background: "#fff",
              resize: "vertical", outline: "none",
              lineHeight: 1.6, transition: "border-color 0.15s",
            }}
            onFocus={e => { if (!isOverLimit) e.target.style.borderColor = "#E77A2D"; }}
            onBlur={e  => { e.target.style.borderColor = isOverLimit ? "#DC2626" : "#E8E2DC"; }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
              {platform.limit.toLocaleString()} character limit
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: isOverLimit ? "#DC2626" : charsLeft < 20 ? "#B55A18" : "#6B7280",
            }}>
              {charsLeft.toLocaleString()}
            </div>
          </div>

          {activeTab === "instagram" && (
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
              ⏱ Instagram posts may take up to 30 seconds to process
            </div>
          )}

          {results[activeTab] && (
            <div style={{
              marginTop: 16, padding: "12px 16px", borderRadius: 10,
              background: results[activeTab]!.success ? "#FEF3EB" : "#FEF2F2",
              border: `1.5px solid ${results[activeTab]!.success ? "#F3D5B8" : "#FECACA"}`,
              fontSize: 13,
              color: results[activeTab]!.success ? "#B55A18" : "#DC2626",
            }}>
              {results[activeTab]!.success ? (
                <div>
                  ✓ Posted successfully!{" "}
                  {postUrl && (
                    <a href={postUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#B55A18", fontWeight: 700 }}>
                      View post →
                    </a>
                  )}
                </div>
              ) : (
                <div>✕ {results[activeTab]!.message || "Post failed"}</div>
              )}
            </div>
          )}

          <button
            onClick={handlePost}
            disabled={!canPost}
            style={{
              marginTop: 16, width: "100%",
              padding: "14px 24px", borderRadius: 10, border: "none",
              fontFamily: "inherit", fontSize: 15, fontWeight: 700,
              cursor: canPost ? "pointer" : "not-allowed",
              background: canPost ? "#E77A2D" : "#F3F4F6",
              color: canPost ? "#fff" : "#9CA3AF",
              transition: "all 0.2s",
              boxShadow: canPost ? "0 2px 8px rgba(231,122,45,0.3)" : "none",
            }}
            onMouseOver={e => { if (canPost) e.currentTarget.style.background = "#B55A18"; }}
            onMouseOut={e  => { if (canPost) e.currentTarget.style.background = "#E77A2D"; }}
          >
            {posting[activeTab] ? "Posting..." : `Post to ${platform.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
