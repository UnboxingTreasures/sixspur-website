"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

const PRESET_AMOUNTS = [5, 10, 20, 50];

const IMPACT = [
  { amount: 5,  label: "Feeds a chicken flock for a day" },
  { amount: 10, label: "Covers a goat's weekly feed" },
  { amount: 20, label: "Provides hay for a donkey for a week" },
  { amount: 50, label: "Helps fund a vet visit for a rescue animal" },
];

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => void };
    };
  }
}

export default function WaysToGivePage() {
  const router = useRouter();
  const [frequency, setFrequency] = useState<"once" | "monthly">("once");
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [donationResult, setDonationResult] = useState<"success" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  const activeAmount = custom ? parseFloat(custom) : selected;

  // Loads the PayPal JS SDK once, on demand -- not on every page load,
  // only once someone's actually confirmed they're ready to donate
  // (logged in, amount selected). Sandbox client ID for now, matches
  // PAYPAL_MODE=sandbox on the backend.
  const loadPayPalScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.paypal) {
        scriptLoadedRef.current = true;
        return resolve();
      }
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load PayPal"));
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (!showPayPal || !paypalContainerRef.current || !window.paypal) return;

    // Clear any previous render (e.g. if the amount changed and this
    // effect re-runs) before rendering fresh buttons.
    paypalContainerRef.current.innerHTML = "";

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
            body: JSON.stringify({ paypalOrderId: data.orderID }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "Failed to confirm donation");
          setDonationResult("success");
          setShowPayPal(false);
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
  }, [showPayPal, activeAmount, router]);

  const handleDonate = async () => {
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

  return (
    <main className="min-h-screen bg-white">

      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="eyebrow mb-3">Give</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Ways to Give</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Every dollar goes directly to the animals — feed, veterinary care, shelter, and the
            daily work of keeping Six Spur running.
          </p>
        </div>
      </section>

      {/* Donation widget */}
      <section className="py-16 px-6">
        <div className="max-w-xl mx-auto">

          {/* Frequency toggle */}
          <div className="flex rounded overflow-hidden border border-spur-tan mb-8">
            <button
              onClick={() => { setFrequency("once"); setShowPayPal(false); setDonationResult(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                frequency === "once"
                  ? "bg-spur-black text-white"
                  : "bg-white text-spur-black hover:bg-spur-tan-light"
              }`}
            >
              Give Once
            </button>
            <button
              onClick={() => { setFrequency("monthly"); setShowPayPal(false); setDonationResult(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                frequency === "monthly"
                  ? "bg-spur-black text-white"
                  : "bg-white text-spur-black hover:bg-spur-tan-light"
              }`}
            >
              Give Monthly
            </button>
          </div>

          {frequency === "monthly" ? (
            <div className="bg-spur-tan-light border border-spur-tan rounded p-6 text-center mb-8">
              <p className="text-spur-black font-semibold mb-2">Monthly giving is coming soon.</p>
              <p className="text-sm text-gray-600">
                We&apos;re still setting up recurring donations. In the meantime, a one-time gift makes an immediate difference —
                or <Link href="/contact" className="text-spur-orange font-semibold hover:underline">get in touch</Link> and we can help set up recurring support directly.
              </p>
            </div>
          ) : (
            <>
              {/* Preset amounts */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {PRESET_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => { setSelected(amount); setCustom(""); setShowPayPal(false); setDonationResult(null); }}
                    className={`py-4 rounded text-sm font-bold transition-colors border ${
                      selected === amount && !custom
                        ? "bg-spur-orange text-white border-spur-orange"
                        : "bg-white text-spur-black border-spur-tan hover:border-spur-orange"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="relative mb-8">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Custom amount"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setSelected(null); setShowPayPal(false); setDonationResult(null); }}
                  className="w-full pl-8 pr-4 py-4 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black placeholder-gray-400"
                />
              </div>

              {/* Impact line */}
              {selected && !custom && (
                <p className="text-sm text-gray-500 mb-6 text-center">
                  <span className="text-spur-orange font-semibold">${selected}</span>{" "}
                  — {IMPACT.find((i) => i.amount === selected)?.label}
                </p>
              )}

              {donationResult === "success" && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm mb-4 text-center">
                  Thank you! Your donation was successful. A receipt has been emailed to you, and it&apos;s in your{" "}
                  <Link href="/account" className="font-semibold underline">account history</Link> too.
                </div>
              )}
              {donationResult === "error" && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4 text-center">
                  {errorMessage || "Something went wrong. Please try again."}
                </div>
              )}

              {!showPayPal ? (
                <button
                  onClick={handleDonate}
                  disabled={!activeAmount || activeAmount <= 0 || checkingAuth}
                  className="w-full bg-spur-orange text-white font-bold py-4 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-widest"
                >
                  {checkingAuth
                    ? "One moment..."
                    : activeAmount && activeAmount > 0
                    ? `Donate $${activeAmount.toFixed(2)}`
                    : "Select an Amount"}
                </button>
              ) : (
                <div ref={paypalContainerRef} />
              )}

              <p className="text-center text-xs text-gray-400 mt-4">
                You&apos;ll need to log in or create a free account to complete your donation — this lets us send your tax receipt and keep your giving history in one place.
              </p>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            Six Spur Ranch and Rescue is a registered 501(c)(3). Donations are tax-deductible to the extent permitted by law.
          </p>

        </div>
      </section>

      {/* Other ways to help */}
      <section className="bg-spur-tan-light py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="eyebrow mb-3">Other Ways to Help</p>
          <h2 className="text-2xl font-bold text-spur-black mb-10">Not ready to donate? There are other ways to make a difference.</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="orange-divider mb-4" />
              <h3 className="font-bold text-spur-black mb-2">Adopt</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Give one of our rescue dogs a forever home. Browse our adoptable animals and start the process today.
              </p>
              <Link href="/adopt" className="text-spur-orange text-sm font-semibold hover:underline">
                See adoptable animals →
              </Link>
            </div>

            <div>
              <div className="orange-divider mb-4" />
              <h3 className="font-bold text-spur-black mb-2">Spread the Word</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Follow us on social media and share our mission. Awareness is one of the most powerful tools we have.
              </p>
              <Link href="/contact" className="text-spur-orange text-sm font-semibold hover:underline">
                Get in touch →
              </Link>
            </div>

            <div>
              <div className="orange-divider mb-4" />
              <h3 className="font-bold text-spur-black mb-2">Sign Up for Updates</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Join our newsletter to stay connected with the ranch, meet new animals, and hear about upcoming needs.
              </p>
              <Link href="/contact" className="text-spur-orange text-sm font-semibold hover:underline">
                Subscribe →
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
