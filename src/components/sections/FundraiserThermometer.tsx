'use client';

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

// 8 sparks arranged in a rough circle, sharing one @keyframes via CSS
// custom properties set per-spark (same technique as the homepage
// version) -- burst origin is the RIGHT edge of the fill here, since
// this thermometer grows left-to-right instead of bottom-to-top.
const FIREWORK_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

// Horizontal counterpart to the homepage's vertical bulb-and-tube
// thermometer -- same visual language (traditional shape, tick marks,
// blue/red heat states, pulse, fireworks at 100%), just rotated to fit
// this page's layout: bulb on the left (start), tube extending right
// toward the goal, matching natural reading direction.
function ThermometerGraphicHorizontal({ percent, fillColor, isComplete }: { percent: number; fillColor: string; isComplete: boolean }) {
  const tubeInnerLeft = 60;
  const tubeInnerRight = 280;
  const tubeInnerWidth = tubeInnerRight - tubeInnerLeft;
  const fillWidth = (percent / 100) * tubeInnerWidth;

  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="320" height="110" viewBox="0 0 320 110" style={{ display: 'block', margin: '0 auto' }}>
        {/* Tick marks + labels, below the tube */}
        {ticks.map((tick) => {
          const x = tubeInnerLeft + (tick / 100) * tubeInnerWidth;
          return (
            <g key={tick}>
              <line x1={x} y1="72" x2={x} y2="80" stroke="#111111" strokeWidth="2" />
              <text x={x} y="94" fontSize="10" fontWeight="700" fill="#111111" textAnchor="middle">{tick}</text>
            </g>
          );
        })}

        {/* Outer outline: bulb + tube */}
        <circle cx="35" cy="50" r="35" fill="#FFFFFF" stroke="#111111" strokeWidth="6" />
        <rect x="55" y="30" width="230" height="40" rx="20" fill="#FFFFFF" stroke="#111111" strokeWidth="6" />

        {/* Fill: bulb always full, tube portion grows rightward */}
        <circle cx="35" cy="50" r="27" fill={fillColor} />
        <rect
          className="fundraiser-thermometer-fill"
          x="41" y="36" width={fillWidth + 20} height="28" rx="14"
          fill={fillColor}
        />

        {/* Fireworks, only once the goal is fully met -- burst from the
            right edge of the fill. */}
        {isComplete && FIREWORK_ANGLES.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const distance = 46;
          const tx = Math.cos(rad) * distance;
          const ty = Math.sin(rad) * distance;
          const color = i % 2 === 0 ? '#E77A2D' : '#FFC857';
          return (
            <foreignObject key={angle} x="240" y="0" width="80" height="80" style={{ overflow: 'visible' }}>
              <span
                className="firework-spark"
                style={{
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  animationDelay: `${i * 0.06}s`,
                  background: color,
                } as React.CSSProperties}
              />
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
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
          setAmount("");
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
  const isComplete = percent >= 100;
  // Same thermometer-heat metaphor as the homepage version.
  const fillColor = percent >= 50 ? "#DC2626" : "#3B82F6";

  return (
    <div style={{ maxWidth: "540px", margin: "3rem auto 0", padding: "2rem", background: "#F7F4F0", border: "4px solid #111111", borderRadius: "2px" }}>
      <style>{`
        @keyframes fundraiser-pulse-h {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }
        .fundraiser-thermometer-fill {
          animation: fundraiser-pulse-h 2.2s ease-in-out infinite;
        }
        @keyframes firework-spark-h {
          0% { transform: translate(0, 0) scale(0.4); opacity: 1; }
          15% { transform: translate(calc(var(--tx) * 0.2), calc(var(--ty) * 0.2)) scale(1.3); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        .firework-spark {
          display: block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: firework-spark-h 0.9s ease-out infinite;
        }
      `}</style>

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

      <ThermometerGraphicHorizontal percent={percent} fillColor={fillColor} isComplete={isComplete} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
        <span style={{ fontWeight: 800, color: "#111111" }}>${fundraiser.raisedAmount.toFixed(0)} raised{isComplete ? " 🎉" : ""}</span>
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
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 12px 12px 28px", border: "1.5px solid #E8D5C4", borderRadius: 6, fontSize: "0.95rem", color: "#111111", background: "#fff" }}
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
