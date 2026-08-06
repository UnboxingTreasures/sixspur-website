"use client";

import { useState } from "react";
import SocialPostModal from "@/components/admin/SocialPostModal";

export default function TestSocialPostPage() {
  const [open, setOpen] = useState(false);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Social Posting Test
      </h1>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
        Temporary test trigger — not linked from the live site nav. The modal itself will move
        into the real admin Social Media section later.
      </p>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "#E77A2D", color: "#fff", border: "none",
          padding: "12px 24px", borderRadius: 8, fontWeight: 700,
          fontSize: 14, cursor: "pointer",
        }}
      >
        Open Post to Social Media
      </button>

      {open && <SocialPostModal onClose={() => setOpen(false)} />}
    </main>
  );
}
