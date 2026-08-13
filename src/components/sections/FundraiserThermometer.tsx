"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => void };
    };
  }
}

interface Fundraiser {
  fundraiserId: string;
  title: string;
  description: string;
  goalAmount: number;
  closingDate: string;
  raisedAmount: number;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Self-contained: loads its own copy of the PayPal SDK and handles its
// own checkout flow, deliberately NOT sharing code with the general
// Give Once flow above it on this page -- that flow is already tested
// and working, safer to keep this genuinely separate than risk it via
// a shared-logic refactor.
export default function FundraiserThermometer() {
  const router = useRouter();
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [donationResult, setDonationResult] = useState<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const paypalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/fundraisers/active`)
      .then((res) => res.json())
      .then((data) => setFundraiser(data.fundraiser))
      .catch((err) => console.error("Failed to load active fundraiser:", err))
      .finally(() => setLoading(false));
  }, []);

  const loadPayPalScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.paypal) return resolve();
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load PayPal"));
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (!showPayPal || !paypalContainerRef.current || !window.paypal || !fundraiser) return;

    paypalContainerRef.current.innerHTML = "";
    const activeAmount = parseFloat(amount);

    window.paypal.Buttons({
      createOrder: async () => {
        const token = await getIdToken();
        if (!token) {
          router.push(`/account/login?returnTo=${encodeURIComponent("/ways-to-give")}`);
          throw new Error("Not logged in");
        }
        const res = await fetch(`${API_URL}/donate/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: activeAmount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start donation");
        return data.paypalOrderId;
      },
      onApprove: async (data: { orderID: string }) => {
        const token = await getIdToken();
        if (!token) {
          router.push(`/account/login?returnTo=${encodeURIComponent("/ways-to-give")}`);
          return;
        }
        try {
          const res = await fetch(`${API_URL}/donate/capture-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paypalOrderId: data.orderID, campaignId: fundraiser.fundraiserId }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Failed to confirm donation");
          setDonationResult("success");
          setShowPayPal(false);
          // Refresh so the thermometer reflects the new total immediately.
          fetch(`${API_URL}/fundraisers/active`).then((r) => r.json()).then((d) => setFundraiser(d.fundraiser));
        } catch (err: unknown) {
          setErrorMessage(err instanceof Error ? err.message : "Something went wrong confirming your donation.");
          setDonationResult("error");
        }
      },
      onError: () => {
        setErrorMessage("PayPal encountered an error. Please try again.");
        setDonationResult("error");
      },
      onCancel: () => {
        setShowPayPal(false);
      },
    }).render(paypalContainerRef.current);
  }, [showPayPal, amount, fundraiser, router]);

  const handleDonate = async () => {
    const activeAmount = parseFloat(amount);
    if (!activeAmount || activeAmount <= 0) return;
    setDonationResult(null);
    setErrorMessage("");
    setCheckingAuth(true);

    const token = await getIdToken();
    if (!token) {
      router.push(`/account/login?returnTo=${encodeURIComponent("/ways-to-give")}`);
      return;
    }

    try {
      await loadPayPalScript();
      setShowPayPal(true);
    } catch {
      setErrorMessage("Could not load PayPal. Please refresh and try again.");
      setDonationResult("error");
    } finally {
      setCheckingAuth(false);
    }
  };

  if (loading || !fundraiser) return null; // No active fundraiser -- this section just doesn't render at all.

  const percent = fundraiser.goalAmount > 0 ? Math.min(100, (fundraiser.raisedAmount / fundraiser.goalAmount) * 100) : 0;

  return (
    <div style={{ maxWidth: "540px", margin: "3rem auto 0", padding: "2rem", background: "#FEF3EB", border: "2px solid #E77A2D", borderRadius: "8px" }}>
      <p style={{ color: "#E77A2D", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem", textAlign: "center" }}>
        Active Campaign — Not Part of Regular Giving Above
      </p>
      <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#111111", textAlign: "center", marginBottom: "0.5rem" }}>
        {fundraiser.title}
      </h3>
      {fundraiser.description && (
        <p style={{ fontSize: "0.9rem", color: "#555555", textAlign: "center", marginBottom: "1.25rem", lineHeight: 1.5 }}>
          {fundraiser.description}
        </p>
      )}

      {/* Thermometer */}
      <div style={{ marginBottom: "0.5rem" }}>
        <div style={{ width: "100%", height: "24px", background: "#fff", borderRadius: "12px", overflow: "hidden", border: "1.5px solid #E8D5C4" }}>
          <div style={{ width: `${percent}%`, height: "100%", background: "#E77A2D", transition: "width 0.4s ease", borderRadius: "12px" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        <span style={{ fontWeight: 800, color: "#111111" }}>${fundraiser.raisedAmount.toFixed(0)} raised</span>
        <span style={{ color: "#888888" }}>Goal: ${fundraiser.goalAmount.toFixed(0)} · Ends {formatDate(fundraiser.closingDate)}</span>
      </div>

      {donationResult === "success" && (
        <div style={{ background: "#EAF7EE", border: "1.5px solid #B7E4C7", color: "#1E8A4C", padding: "12px 16px", borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: "center" }}>
          Thank you! Your gift toward {fundraiser.title} was successful. A receipt has been emailed to you.
        </div>
      )}
      {donationResult === "error" && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", padding: "12px 16px", borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: "center" }}>
          {errorMessage || "Something went wrong. Please try again."}
        </div>
      )}

      {!showPayPal ? (
        <>
          <div style={{ position: "relative", marginBottom: "0.75rem" }}>
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontWeight: 700 }}>$</span>
            <input
              type="number"
              min="1"
              placeholder="Custom amount"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setShowPayPal(false); setDonationResult(null); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 12px 12px 28px", border: "1.5px solid #E8D5C4", borderRadius: 6, fontSize: "0.95rem", color: "#111111" }}
            />
          </div>
          <button
            onClick={handleDonate}
            disabled={!amount || parseFloat(amount) <= 0 || checkingAuth}
            style={{
              width: "100%", background: "#111111", color: "#fff", fontWeight: 700, padding: "12px",
              borderRadius: 6, border: "none", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em",
              cursor: (!amount || parseFloat(amount) <= 0) ? "not-allowed" : "pointer",
              opacity: (!amount || parseFloat(amount) <= 0) ? 0.4 : 1,
            }}
          >
            {checkingAuth ? "One moment..." : `Give to ${fundraiser.title}`}
          </button>
        </>
      ) : (
        <div ref={paypalContainerRef} />
      )}
    </div>
  );
}
