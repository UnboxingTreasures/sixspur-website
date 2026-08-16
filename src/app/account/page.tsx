"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getIdToken, signOut, changePassword } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Donation {
  donationId: string;
  amount: number;
  currency: string;
  type: "one-time" | "recurring";
  status: string;
  receiptUrl?: string;
  campaignId?: string;
  campaignTitle?: string;
  createdAt: string;
}

function getDonationDescriptor(d: Donation): string {
  if (d.campaignTitle) return `Fundraiser: ${d.campaignTitle}`;
  // Fallback for donations tagged with a campaign before campaignTitle
  // existed as a field (or if a title lookup ever silently fails) --
  // still correctly shows this as a fundraiser donation rather than
  // misleadingly falling through to "One-time".
  if (d.campaignId) return "Fundraiser";
  return d.type === "recurring" ? "Monthly" : "One-time";
}

// NEW -- recurring subscriptions, separate from the one-time/recurring
// CHARGE history above. A subscription is a standing record (tier,
// status, next billing date) that outlives any single payment -- the
// individual monthly charges still show up in Donation History above
// as type: "recurring" rows, same as before. This section is about
// managing the subscription itself, not viewing past charges.
interface RecurringDonation {
  subscriptionId: string;
  tier: number;
  isCustom?: boolean;
  status: "pending" | "active" | "suspended" | "cancelled" | "cancelling";
  activatedAt?: string;
  cancelledAt?: string;
  nextBillingAt?: string;
  lastPaymentAt?: string;
  createdAt: string;
}

const RECURRING_STATUS_LABEL: Record<string, string> = {
  pending: "Pending approval",
  active: "Active",
  suspended: "Payment issue — paused by PayPal",
  cancelled: "Cancelled",
  cancelling: "Cancelling…",
};

// NEW -- shop order history, mirrors the Donation History section below.
// Comes from GET /orders/mine (the sixspur-orders Lambda, queried via
// the donorId-index GSI), added alongside donations rather than merged
// into one list: orders and donations are different record shapes with
// different meanings (a purchase vs. a gift), so keeping them as two
// clearly-labeled sections avoids conflating "money in" with "money for
// something you got back".
interface OrderItem {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  variantValues?: Record<string, string> | null;
}

interface Order {
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: "pending" | "paid" | "expired";
  createdAt: string;
}

function getOrderItemsSummary(order: Order): string {
  return order.items
    .map((item) => {
      const variant = item.variantValues ? ` (${Object.values(item.variantValues).join(" / ")})` : "";
      return `${item.quantity}x ${item.name}${variant}`;
    })
    .join(", ");
}

interface Profile {
  email: string;
  mailingListOptIn: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Split out from the default export so useSearchParams() -- which
// requires a Suspense boundary in Next.js's static export -- is
// isolated inside one. This is purely a build-requirement wrapper, not
// a UI change; the fallback below should essentially never be visible
// since the whole page is client-rendered post-auth-check anyway.
function AccountDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recurring, setRecurring] = useState<RecurringDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingOptIn, setSavingOptIn] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // NEW -- collapsible history sections, default open so nothing looks
  // missing on first load; collapsing is purely a decluttering option
  // once someone has enough history to want it.
  const [donationsOpen, setDonationsOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(true);
  const [recurringOpen, setRecurringOpen] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Shows a one-time confirmation banner if we just landed back here
  // from PayPal's subscription approval redirect (?recurring=confirmed,
  // set by the donate-recurring Lambda's return_url). This is NOT proof
  // the subscription is active -- that only happens once the webhook
  // fires -- so it's phrased as "approved" rather than "active", and the
  // real status still comes from the subscriptions list below.
  const justApprovedRecurring = searchParams.get("recurring") === "confirmed";

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
        const [profileRes, donationsRes, ordersRes, recurringRes] = await Promise.all([
          authedFetch("/donor/profile"),
          authedFetch("/donor/donations"),
          authedFetch("/orders/mine"),
          authedFetch("/donate/recurring/mine"),
        ]);
        const profileData = await profileRes.json();
        const donationsData = await donationsRes.json();
        const ordersData = await ordersRes.json();
        const recurringData = await recurringRes.json();
        setProfile(profileData);
        setDonations(donationsData.donations || []);
        setOrders(ordersData.orders || []);
        setRecurring(recurringData.subscriptions || []);
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

  // NEW -- cancels a subscription. Calls the site's cancel endpoint,
  // which itself calls PayPal but deliberately does NOT flip the DB
  // status (see donate-recurring/index.js) -- the webhook does that, so
  // this optimistically shows "Cancelling…" via the API's returned
  // status rather than assuming success and marking it "Cancelled"
  // outright.
  const cancelSubscription = async (subscriptionId: string) => {
    if (!confirm("Cancel this monthly donation? This can't be undone from here -- you'd need to start a new one to resume.")) return;
    setCancellingId(subscriptionId);
    try {
      const res = await authedFetch("/donate/recurring/cancel", {
        method: "POST",
        body: JSON.stringify({ subscriptionId }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Failed to cancel");
      setRecurring((prev) => prev.map((r) => (r.subscriptionId === subscriptionId ? { ...r, status: updated.status } : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel. Please try again or contact us.");
    } finally {
      setCancellingId(null);
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

          {justApprovedRecurring && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
              Thanks! Your monthly donation is approved and will show as Active below shortly.
            </div>
          )}

          {/* Recurring donations */}
          <div className="border-4 border-spur-tan-light rounded-lg p-6">
            <button
              type="button"
              onClick={() => setRecurringOpen((open) => !open)}
              className="w-full flex items-center justify-between mb-4"
            >
              <div>
                <h2 className="text-xl font-bold text-spur-black">
                  Recurring Donations{recurring.length > 0 ? ` (${recurring.length})` : ""}
                </h2>
                <div className="w-10 h-[3px] bg-spur-orange rounded mt-1" />
              </div>
              <span className="text-gray-400 text-sm">{recurringOpen ? "▾" : "▸"}</span>
            </button>
            {recurringOpen && (
              loading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : recurring.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  You don&apos;t have any monthly donations set up. You can start one from{" "}
                  <a href="/ways-to-give" className="text-spur-orange font-semibold hover:underline">Ways to Give</a>.
                </p>
              ) : (
                <div className="border border-spur-tan-light rounded overflow-hidden">
                  {recurring.map((r) => (
                    <div key={r.subscriptionId} className="flex items-center justify-between px-5 py-4 border-b border-spur-tan-light last:border-b-0">
                      <div>
                        <div className="font-semibold text-spur-black">${r.tier}/month</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {RECURRING_STATUS_LABEL[r.status] || r.status}
                          {r.status === "active" && r.activatedAt && ` since ${formatDate(r.activatedAt)}`}
                          {r.status === "active" && r.nextBillingAt && ` · Next charge ${formatDate(r.nextBillingAt)}`}
                          {r.status === "cancelled" && r.cancelledAt && ` on ${formatDate(r.cancelledAt)}`}
                        </div>
                      </div>
                      {(r.status === "active" || r.status === "suspended" || r.status === "pending") && (
                        <button
                          onClick={() => cancelSubscription(r.subscriptionId)}
                          disabled={cancellingId === r.subscriptionId}
                          className="text-red-600 text-sm font-semibold hover:underline whitespace-nowrap disabled:opacity-50"
                        >
                          {cancellingId === r.subscriptionId ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Donation history */}
          <div className="border-4 border-spur-tan-light rounded-lg p-6">
            <button
              type="button"
              onClick={() => setDonationsOpen((open) => !open)}
              className="w-full flex items-center justify-between mb-4"
            >
              <div>
                <h2 className="text-xl font-bold text-spur-black">
                  Donation History{donations.length > 0 ? ` (${donations.length})` : ""}
                </h2>
                <div className="w-10 h-[3px] bg-spur-orange rounded mt-1" />
              </div>
              <span className="text-gray-400 text-sm">{donationsOpen ? "▾" : "▸"}</span>
            </button>
            {donationsOpen && (
              loading ? (
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
                          {formatDate(d.createdAt)} · {getDonationDescriptor(d)} · {d.status}
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
              )
            )}
          </div>

          {/* Order history -- shop purchases, separate from donations
              above. Only 'paid' orders are meaningful to show here;
              'pending'/'expired' reservations that never completed
              checkout aren't real orders from the donor's perspective,
              so they're filtered out rather than shown as confusing
              incomplete entries. */}
          <div className="border-4 border-spur-tan-light rounded-lg p-6">
            <button
              type="button"
              onClick={() => setOrdersOpen((open) => !open)}
              className="w-full flex items-center justify-between mb-4"
            >
              <div>
                <h2 className="text-xl font-bold text-spur-black">
                  Order History{orders.filter((o) => o.status === "paid").length > 0 ? ` (${orders.filter((o) => o.status === "paid").length})` : ""}
                </h2>
                <div className="w-10 h-[3px] bg-spur-orange rounded mt-1" />
              </div>
              <span className="text-gray-400 text-sm">{ordersOpen ? "▾" : "▸"}</span>
            </button>
            {ordersOpen && (
              loading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : orders.filter((o) => o.status === "paid").length === 0 ? (
                <p className="text-gray-500 text-sm">You haven&apos;t placed any shop orders yet.</p>
              ) : (
                <div className="border border-spur-tan-light rounded overflow-hidden">
                  {orders.filter((o) => o.status === "paid").map((o) => (
                    <div key={o.orderId} className="flex items-center justify-between px-5 py-4 border-b border-spur-tan-light last:border-b-0">
                      <div>
                        <div className="font-semibold text-spur-black">${o.total.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(o.createdAt)} · {getOrderItemsSummary(o)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Mailing list */}
          {profile && (
            <div className="border-4 border-spur-tan-light rounded-lg p-6">
              <h2 className="text-xl font-bold text-spur-black mb-1">Preferences</h2>
              <div className="w-10 h-[3px] bg-spur-orange rounded mb-4" />
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
          <div className="border-4 border-spur-tan-light rounded-lg p-6">
            <h2 className="text-xl font-bold text-spur-black mb-1">Change Password</h2>
            <div className="w-10 h-[3px] bg-spur-orange rounded mb-4" />
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

export default function AccountDashboardPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </main>
    }>
      <AccountDashboardContent />
    </Suspense>
  );
}
