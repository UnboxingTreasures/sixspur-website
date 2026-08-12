"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/cognito";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/account");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="eyebrow mb-3">Donor Account</p>
          <h1 className="text-3xl md:text-4xl font-bold">Log In</h1>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="bg-white border border-spur-tan-light rounded p-8 space-y-5">
            {justVerified && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                Your email is verified — you can log in now.
              </div>
            )}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-spur-orange text-white font-semibold py-3 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Logging in..." : "Log In"}
            </button>

            <div className="flex justify-between text-sm">
              <Link href="/account/forgot-password" className="text-spur-orange font-semibold hover:underline">
                Forgot password?
              </Link>
              <Link href="/account/signup" className="text-spur-orange font-semibold hover:underline">
                Create an account
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
