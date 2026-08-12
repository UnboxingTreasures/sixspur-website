"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getIdToken, signOut, changePassword } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Donation {
  donationId: string;
  amount: number;
  currency: string;
  type: "one-time" | "recurring";
  status: string;
  receiptUrl?: string;
  createdAt: string;
}

interface Profile {
  email: string;
  mailingListOptIn: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AccountDashboardPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingOptIn, setSavingOptIn] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const authedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) {
      router.push("/account/login");
      throw new Error("Not logged in");
    }
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  }, [router]);

  useEffect(() => {
    const load = async () => {
      const token = await getIdToken();
      if (!token) {
        router.push("/account/login");
        return;
      }
      setCheckingAuth(false);

      try {
        const [profileRes, donationsRes] = await Promise.all([
          authedFetch("/donor/profile"),
          authedFetch("/donor/donations"),
        ]);
        const profileData = await profileRes.json();
        const donationsData = await donationsRes.json();
        setProfile(profileData);
        setDonations(donationsData.donations || []);
      } catch (err) {
        console.error("Failed to load account data:", err);
        setError("Failed to load your account. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, authedFetch]);

  const toggleMailingList = async () => {
    if (!profile) return;
    setSavingOptIn(true);
    try {
      const res = await authedFetch("/donor/profile", {
        method: "PATCH",
        body: JSON.stringify({ mailingListOptIn: !profile.mailingListOptIn }),
      });
      const updated = await res.json();
      setProfile(updated);
    } catch (err) {
      console.error("Failed to update mailing list preference:", err);
    } finally {
      setSavingOptIn(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    setChangingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="eyebrow mb-3">Donor Account</p>
            <h1 className="text-3xl md:text-4xl font-bold">My Account</h1>
          </div>
          <button onClick={handleSignOut} className="text-white/60 text-sm hover:text-white transition-colors">
            Sign Out
          </button>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

          {/* Donation history */}
          <div>
            <h2 className="text-xl font-bold text-spur-black mb-4">Donation History</h2>
            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : donations.length === 0 ? (
              <p className="text-gray-500 text-sm">You haven&apos;t made any donations yet.</p>
            ) : (
              <div className="border border-spur-tan-light rounded overflow-hidden">
                {donations.map((d) => (
                  <div key={d.donationId} className="flex items-center justify-between px-5 py-4 border-b border-spur-tan-light last:border-b-0">
                    <div>
                      <div className="font-semibold text-spur-black">${d.amount.toFixed(2)} {d.currency}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(d.createdAt)} · {d.type === "recurring" ? "Monthly" : "One-time"} · {d.status}
                      </div>
                    </div>
                    {d.receiptUrl && (
                      <a
                        href={d.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-spur-orange text-sm font-semibold hover:underline whitespace-nowrap"
                      >
                        Download Receipt
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mailing list */}
          {profile && (
            <div>
              <h2 className="text-xl font-bold text-spur-black mb-4">Preferences</h2>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.mailingListOptIn}
                  onChange={toggleMailingList}
                  disabled={savingOptIn}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Receive email updates from Six Spur Ranch</span>
              </label>
            </div>
          )}

          {/* Change password */}
          <div>
            <h2 className="text-xl font-bold text-spur-black mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
              {passwordError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{passwordError}</div>}
              {passwordSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">Password updated.</div>}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black"
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

              <button
                type="submit"
                disabled={changingPassword}
                className="bg-spur-orange text-white font-semibold px-6 py-2 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-50"
              >
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
