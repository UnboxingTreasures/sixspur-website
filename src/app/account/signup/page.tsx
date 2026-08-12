"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/cognito";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password);
      router.push(`/account/verify?email=${encodeURIComponent(email)}`);
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
          <h1 className="text-3xl md:text-4xl font-bold">Create Your Account</h1>
          <p className="text-white/60 mt-3 text-sm">
            An account keeps track of your donation history and tax receipts in one place.
          </p>
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

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
              <p className="text-xs text-gray-400 mt-1">At least 8 characters, with uppercase, lowercase, and a number.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-spur-orange text-white font-semibold py-3 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/account/login" className="text-spur-orange font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
