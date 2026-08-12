"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmForgotPassword } from "@/lib/cognito";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmForgotPassword(email, code, newPassword);
      router.push("/account/login?reset=true");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please check your code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-md mx-auto text-center">
          <p className="eyebrow mb-3">Donor Account</p>
          <h1 className="text-3xl md:text-4xl font-bold">Set a New Password</h1>
          <p className="text-white/60 mt-3 text-sm">Enter the code sent to {email || "your email"} and your new password.</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="bg-white border border-spur-tan-light rounded p-8 space-y-5">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Reset Code</label>
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

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Confirm New Password</label>
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
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
