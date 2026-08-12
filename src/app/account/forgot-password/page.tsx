"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword } from "@/lib/cognito";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email);
      router.push(`/account/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="eyebrow mb-3">Donor Account</p>
          <h1 className="text-3xl md:text-4xl font-bold">Reset Password</h1>
          <p className="text-white/60 mt-3 text-sm">Enter your email and we&apos;ll send you a reset code.</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="bg-white border border-spur-tan-light rounded p-8 space-y-5">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-spur-orange text-white font-semibold py-3 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
