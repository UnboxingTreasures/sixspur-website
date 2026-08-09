"use client";

import { useState } from "react";

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

export default function SocialPostComposer() {
  const [activeTab, setActiveTab]   = useState("instagram");
  const [text, setText]             = useState<Record<string, string>>({ instagram: "", facebook: "" });
  const [imageUrl, setImageUrl]     = useState<Record<string, string>>({ instagram: "", facebook: "" });
  const [imageMode, setImageMode]   = useState<Record<string, "url" | "upload">>({ instagram: "url", facebook: "url" });
  const [uploading, setUploading]   = useState<Record<string, boolean>>({ instagram: false, facebook: false });
  const [uploadMsg, setUploadMsg]   = useState<Record<string, string>>({ instagram: "", facebook: "" });
  const [posting, setPosting]       = useState<Record<string, boolean>>({ instagram: false, facebook: false });
  const [results, setResults]       = useState<Record<string, PostResult | null>>({ instagram: null, facebook: null });
  // Snapshot of what was actually posted, frozen at the moment of a successful post —
  // so the read-only confirmation view shows exactly what went out, even if the
  // person then edits the (now-irrelevant) live text/image fields underneath.
  const [posted, setPosted]         = useState<Record<string, { text: string; imageUrl: string } | null>>({ instagram: null, facebook: null });

  const platform         = PLATFORMS.find(p => p.key === activeTab)!;
  const currentText      = text[activeTab] || "";
  const currentImageUrl  = imageUrl[activeTab] || "";
  const charsLeft        = platform.limit - currentText.length;
  const isOverLimit      = charsLeft < 0;
  const hasRequiredImage = !platform.requiresImage || currentImageUrl.trim().length > 0;
  const canPost           = platform.active && currentText.trim().length > 0 && !isOverLimit && hasRequiredImage && !posting[activeTab] && !uploading[activeTab];
  const isPosted          = results[activeTab]?.success && posted[activeTab];

  // ── Reset a tab back to a fresh, editable compose state ─────────────────────
  const resetTab = (tab: string) => {
    setText(t => ({ ...t, [tab]: "" }));
    setImageUrl(u => ({ ...u, [tab]: "" }));
    setImageMode(im => ({ ...im, [tab]: "url" }));
    setUploadMsg(um => ({ ...um, [tab]: "" }));
    setResults(r => ({ ...r, [tab]: null }));
    setPosted(p => ({ ...p, [tab]: null }));
  };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (file: File, tab: string) => {
    if (!file) return;
    setUploading(u => ({ ...u, [tab]: true }));
    setUploadMsg(m => ({ ...m, [tab]: "Uploading…" }));
    setImageUrl(u => ({ ...u, [tab]: "" }));

    try {
      const presignRes = await fetch(`${API_URL}/admin/social/presigned-url`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      const presignData = await presignRes.json();
      if (!presignData.success) throw new Error(presignData.message || "Failed to get upload URL");

      const uploadRes = await fetch(presignData.presigned_url, {
        method:  "PUT",
        body:    file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("S3 upload failed");

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
      let data: PostResult;
      if (tab === "instagram") {
        const res  = await fetch(`${API_URL}/admin/social/post-to-instagram`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ caption: currentText, image_url: currentImageUrl }),
        });
        data = await res.json();
      } else {
        const res  = await fetch(`${API_URL}/admin/social/post-to-facebook`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message: currentText, ...(currentImageUrl ? { image_url: currentImageUrl } : {}) }),
        });
        data = await res.json();
      }

      setResults(r => ({ ...r, [tab]: data }));
      // Freeze a snapshot of exactly what was posted, only on genuine success
      if (data.success) {
        setPosted(p => ({ ...p, [tab]: { text: currentText, imageUrl: currentImageUrl } }));
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

  // ── Read-only confirmation view, shown after a successful post ──────────────
  const renderPostedView = () => {
    const snapshot = posted[activeTab]!;
    return (
      <div>
        <div style={{
          padding: "14px 16px", borderRadius: 10,
          background: "#FEF3EB", border: "1.5px solid #F3D5B8",
          fontSize: 14, color: "#B55A18", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <span style={{ fontWeight: 700 }}>Posted to {platform.label}</span>
        </div>

        {snapshot.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshot.imageUrl}
            alt="Posted content"
            style={{
              width: "100%", borderRadius: 10, marginBottom: 12,
              border: "1.5px solid #E8E2DC", display: "block",
            }}
          />
        )}

        <div style={{
          padding: "14px 16px", borderRadius: 10,
          background: "#FAFAF8", border: "1.5px solid #E8E2DC",
          fontSize: 14, color: "#111111", lineHeight: 1.6,
          whiteSpace: "pre-wrap", marginBottom: 16,
        }}>
          {snapshot.text}
        </div>

        {postUrl && (
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", textAlign: "center",
              color: "#E77A2D", fontWeight: 700, fontSize: 13,
              marginBottom: 16, textDecoration: "none",
            }}
          >
            View live post →
          </a>
        )}

        <button
          onClick={() => resetTab(activeTab)}
          style={{
            width: "100%", padding: "14px 24px", borderRadius: 10,
            border: "1.5px solid #E77A2D", background: "#fff",
            color: "#E77A2D", fontFamily: "inherit", fontSize: 15,
            fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseOver={e => { e.currentTarget.style.background = "#FEF3EB"; }}
          onMouseOut={e  => { e.currentTarget.style.background = "#fff"; }}
        >
          Post Another
        </button>
      </div>
    );
  };

  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: 12,
      maxWidth: 560,
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      fontFamily: "inherit",
    }}>

      {/* Header */}
      <div style={{
        background: "#111111", padding: "20px 24px",
        borderRadius: "12px 12px 0 0",
      }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Post to Social Media</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 }}>
          Compose and publish to your social accounts
        </div>
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

      {/* Body: either the read-only posted view, or the normal composer */}
      <div style={{ padding: 24 }}>
        {isPosted ? renderPostedView() : (
          <>
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

            {results[activeTab] && !results[activeTab]!.success && (
              <div style={{
                marginTop: 16, padding: "12px 16px", borderRadius: 10,
                background: "#FEF2F2", border: "1.5px solid #FECACA",
                fontSize: 13, color: "#DC2626", lineHeight: 1.5,
              }}>
                ✕ {results[activeTab]!.message || "Post failed"}
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
          </>
        )}
      </div>
    </div>
  );
}
