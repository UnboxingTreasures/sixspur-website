"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

function UnsubscribePageInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      setErrorMessage("This unsubscribe link is missing information and can't be processed.");
      return;
    }

    fetch(`${API_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong.");
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      });
  }, [email, token]);

  return (
    <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        {status === "loading" && (
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Processing…</p>
        )}
        {status === "success" && (
          <>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111111", marginBottom: 12 }}>
              You&apos;ve been unsubscribed
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
              You won&apos;t receive any more mailing list emails from Six Spur Ranch and Rescue.
              You can always resubscribe later on our site.
            </p>
            <Link href="/" style={{ color: "#E77A2D", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              ← Back to sixspurranch.org
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#111111", marginBottom: 12 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>{errorMessage}</p>
            <Link href="/" style={{ color: "#E77A2D", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              ← Back to sixspurranch.org
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <UnsubscribePageInner />
    </Suspense>
  );
}
