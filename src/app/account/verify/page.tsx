"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignUp, resendConfirmationCode } from "@/lib/cognito";

const RESEND_COOLDOWN_SECONDS = 30;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await confirmSignUp(email, code);
      router.push("/account/login?verified=true");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await resendConfirmationCode(email);
      setResent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    }
  };

  return (
    <>
      <p className="text-white/60 mt-3 text-sm text-center mb-8">
        Check your email for a verification code sent to {email || "your email"}.
      </p>
      <form onSubmit={handleSubmit} className="bg-white border border-spur-tan-light rounded p-8 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
        {resent && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">A new code has been sent.</div>}

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Verification Code</label>
          <input
            type="text"
            required
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black text-center text-2xl tracking-widest font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-spur-orange text-white font-semibold py-3 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
        >
          {submitting ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="w-full text-spur-orange text-sm font-semibold hover:underline disabled:text-gray-400 disabled:hover:no-underline disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `You may request another code in ${cooldown}s` : "Resend code"}
        </button>
      </form>
    </>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="eyebrow mb-3">Donor Account</p>
          <h1 className="text-3xl md:text-4xl font-bold">Verify Your Email</h1>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-md mx-auto">
          <Suspense fallback={<p className="text-center text-gray-500 text-sm">Loading...</p>}>
            <VerifyForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
