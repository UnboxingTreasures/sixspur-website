"use client";

import { useState, useEffect, useMemo } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface RefundEntry {
  refundId: string;
  amount: number;
  currency: string;
  refundedAt: string;
}

interface Donation {
  donationId: string;
  donorId: string;
  donorEmail: string;
  amount: number;
  currency: string;
  type: "one-time" | "recurring";
  status: "completed" | "partially_refunded" | "refunded" | "failed";
  paymentMethod: "paypal";
  paypalTransactionId?: string;
  receiptUrl?: string;
  notes?: string;
  campaignId?: string;
  campaignTitle?: string;
  refundedAmount?: number;
  refundHistory?: RefundEntry[];
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

// NEW -- recurring subscriptions, from the separate adminRecurringDonations
// Lambda / recurring_donations table. Kept as its own section rather
// than merged into the donations list below: a subscription is a
// standing record (tier, status), not an individual charge -- the
// actual monthly charges still appear in Donations below as type:
// "recurring" rows once the webhook records them.
interface RecurringDonation {
  subscriptionId: string;
  donorId: string;
  donorEmail: string;
  tier: number;
  isCustom?: boolean;
  status: "pending" | "active" | "suspended" | "cancelled";
  failedPaymentCount?: number;
  activatedAt?: string;
  cancelledAt?: string;
  nextBillingAt?: string;
  lastPaymentAt?: string;
  createdAt: string;
}

const RECURRING_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#EAF7EE", text: "#1E8A4C" },
  pending: { bg: "#FEF9E7", text: "#B5900F" },
  suspended: { bg: "#FEF9E7", text: "#B5900F" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "#EAF7EE", text: "#1E8A4C" },
  partially_refunded: { bg: "#FEF9E7", text: "#B5900F" },
  refunded: { bg: "#F3F4F6", text: "#6B7280" },
  failed: { bg: "#FEF2F2", text: "#DC2626" },
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [recurring, setRecurring] = useState<RecurringDonation[]>([]);
  const [recurringFilter, setRecurringFilter] = useState<"active" | "cancelled" | "all">("active");
  const [donationsOpen, setDonationsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Refund UI state -- per-donation so the amount input, loading state,
  // and any error message for one donation's refund never bleed into
  // another's, even with several cards expanded/interacted with in
  // quick succession.
  const [refundAmountDraft, setRefundAmountDraft] = useState<Record<string, string>>({});
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<Record<string, string>>({});

  // NEW -- archive filter. Year defaults to "all" (full history); Month
  // is only meaningful once a specific year is chosen, since "January"
  // across every year at once isn't a well-defined filter -- picking a
  // year resets month back to "all" for that year, and switching back
  // to "All years" resets month to "all" too, so the two controls can
  // never land in a contradictory state.
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const authedFetch = async (path: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) throw new Error("Not logged in");
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };

  const fetchDonations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/admin/donations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load donations");
      setDonations(data.donations || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load donations");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurring = async () => {
    setRecurringLoading(true);
    try {
      const res = await authedFetch("/admin/recurring-donations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load recurring donations");
      setRecurring(data.subscriptions || []);
    } catch (err) {
      // Non-fatal for the page as a whole -- one-time donations still
      // load and display normally if this call fails.
      console.error("Failed to load recurring donations:", err);
    } finally {
      setRecurringLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
    fetchRecurring();
  }, []);

  // Years that actually have donations in them, newest first -- avoids
  // showing empty years in the dropdown that would just filter to
  // nothing.
  // "Active" bucket intentionally includes pending and suspended too --
  // not just status:"active" -- since those are all subscriptions still
  // in play that an admin would want visible by default. Only fully
  // cancelled ones get tucked away, since those are done and just
  // clutter once there's real volume.
  const filteredRecurring = useMemo(() => {
    if (recurringFilter === "all") return recurring;
    if (recurringFilter === "cancelled") return recurring.filter((r) => r.status === "cancelled");
    return recurring.filter((r) => r.status !== "cancelled");
  }, [recurring, recurringFilter]);

  const availableYears = useMemo(() => {
    const years = new Set(donations.map((d) => new Date(d.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [donations]);

  const filteredDonations = useMemo(() => {
    if (selectedYear === "all") return donations;
    const year = Number(selectedYear);
    return donations.filter((d) => {
      const date = new Date(d.createdAt);
      if (date.getFullYear() !== year) return false;
      if (selectedMonth !== "all" && date.getMonth() !== Number(selectedMonth)) return false;
      return true;
    });
  }, [donations, selectedYear, selectedMonth]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth("all"); // avoids a stale month filter surviving a year change
  };

  const saveNotes = async (donationId: string) => {
    const notes = notesDraft[donationId];
    if (notes === undefined) return;
    setSavingId(donationId);
    try {
      const res = await authedFetch(`/admin/donations/${donationId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setDonations((prev) => prev.map((d) => (d.donationId === donationId ? data : d)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Real PayPal refund, full or partial. Defaults the input to
   * whatever's remaining on the donation (usually the full amount, or
   * whatever's left after an earlier partial refund) -- an admin only
   * needs to change the number for a deliberate partial refund.
   */
  const processRefund = async (donationId: string) => {
    const donation = donations.find((d) => d.donationId === donationId);
    if (!donation) return;

    const remaining = Math.round((donation.amount - (donation.refundedAmount || 0)) * 100) / 100;
    const draft = refundAmountDraft[donationId];
    const amount = draft !== undefined && draft !== "" ? Number(draft) : remaining;

    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError((prev) => ({ ...prev, [donationId]: "Enter a valid refund amount." }));
      return;
    }
    if (amount > remaining + 0.005) {
      setRefundError((prev) => ({ ...prev, [donationId]: `Cannot exceed the $${remaining.toFixed(2)} remaining on this donation.` }));
      return;
    }

    const isFullRefund = Math.abs(amount - remaining) < 0.005;
    const confirmMessage = isFullRefund
      ? `Refund $${amount.toFixed(2)} to ${donation.donorEmail} via PayPal? This processes a REAL refund and cannot be undone.`
      : `Refund $${amount.toFixed(2)} (partial) to ${donation.donorEmail} via PayPal, leaving $${(remaining - amount).toFixed(2)} still refundable? This processes a REAL refund and cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setRefundingId(donationId);
    setRefundError((prev) => ({ ...prev, [donationId]: "" }));
    try {
      const res = await authedFetch(`/admin/donations/${donationId}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      setDonations((prev) => prev.map((d) => (d.donationId === donationId ? data : d)));
      setRefundAmountDraft((prev) => {
        const next = { ...prev };
        delete next[donationId];
        return next;
      });
    } catch (err: unknown) {
      setRefundError((prev) => ({ ...prev, [donationId]: err instanceof Error ? err.message : "Refund failed" }));
    } finally {
      setRefundingId(null);
    }
  };

  const totalForPeriod = filteredDonations
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + d.amount, 0);

  const periodLabel = selectedYear === "all"
    ? "All time"
    : selectedMonth === "all"
    ? `${selectedYear}`
    : `${MONTH_NAMES[Number(selectedMonth)]} ${selectedYear}`;

  // Sum of active monthly subscriptions -- projected recurring revenue,
  // distinct from totalForPeriod above which only reflects money
  // already collected.
  const monthlyRecurringTotal = recurring
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + r.tier, 0);

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "0.5rem" }}>Donations</h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.25rem" }}>
        {periodLabel}: <strong style={{ color: "#111111" }}>${totalForPeriod.toFixed(2)}</strong>
        {!recurringLoading && recurring.some((r) => r.status === "active") && (
          <> · <strong style={{ color: "#111111" }}>${monthlyRecurringTotal.toFixed(2)}/mo</strong> in active recurring donations</>
        )}
      </p>

      {/* Recurring subscriptions */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111111" }}>Recurring Subscriptions</h2>
          <div style={{ display: "flex", gap: 4, background: "#F7F4F0", borderRadius: 8, padding: 3 }}>
            {(["active", "cancelled", "all"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setRecurringFilter(option)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  textTransform: "capitalize",
                  background: recurringFilter === option ? "#111111" : "transparent",
                  color: recurringFilter === option ? "#fff" : "#6B7280",
                }}
              >
                {option}
              </button>
            ))}
          </div>
          </div>
          <div style={{ width: 40, height: 3, background: "#E77A2D", borderRadius: 2, marginTop: 8 }} />
        </div>
        {recurringLoading ? (
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>
        ) : filteredRecurring.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>
            {recurring.length === 0 ? "No recurring donations yet." : `No ${recurringFilter === "all" ? "" : recurringFilter} subscriptions.`}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredRecurring.map((r) => {
              const colors = RECURRING_STATUS_COLORS[r.status] || RECURRING_STATUS_COLORS.pending;
              return (
                <div key={r.subscriptionId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>
                      ${r.tier}/month{r.isCustom && <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginLeft: 6 }}>CUSTOM</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                      {r.donorEmail} · {r.status === "cancelled" && r.cancelledAt
                        ? `Cancelled ${formatDate(r.cancelledAt)}`
                        : r.activatedAt
                        ? `Active since ${formatDate(r.activatedAt)}`
                        : `Started ${formatDate(r.createdAt)}`}
                      {r.status === "active" && r.nextBillingAt && ` · Next charge ${formatDate(r.nextBillingAt)}`}
                      {(r.failedPaymentCount ?? 0) > 0 && ` · ${r.failedPaymentCount} failed payment${r.failedPaymentCount === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDonationsOpen((open) => !open)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111111" }}>
          All Donations{donations.length > 0 ? ` (${donations.length})` : ""}
        </h2>
        <span style={{ color: "#9CA3AF", fontSize: 13 }}>{donationsOpen ? "▾" : "▸"}</span>
      </button>
      <div style={{ width: 40, height: 3, background: "#E77A2D", borderRadius: 2, marginTop: 8, marginBottom: "0.75rem" }} />

      {donationsOpen && (
        <>
      {/* Archive filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1.5rem" }}>
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", color: "#111111", background: "#fff" }}
        >
          <option value="all">All Years</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          disabled={selectedYear === "all"}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", color: selectedYear === "all" ? "#C4C4C4" : "#111111", background: selectedYear === "all" ? "#F7F4F0" : "#fff", cursor: selectedYear === "all" ? "not-allowed" : "pointer" }}
        >
          <option value="all">All Months</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i}>{name}</option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {!loading && !error && donations.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No donations recorded yet.</p>
      )}
      {!loading && !error && donations.length > 0 && filteredDonations.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No donations in {periodLabel.toLowerCase()}.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredDonations.map((d) => {
          const isExpanded = expandedId === d.donationId;
          const colors = STATUS_COLORS[d.status];
          const alreadyRefunded = d.refundedAmount || 0;
          const remaining = Math.round((d.amount - alreadyRefunded) * 100) / 100;
          const canRefund = d.status !== "refunded" && d.status !== "failed" && remaining > 0 && !!d.paypalTransactionId;

          return (
            <div key={d.donationId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : d.donationId);
                  setNotesDraft((prev) => ({ ...prev, [d.donationId]: d.notes || "" }));
                }}
                style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>${d.amount.toFixed(2)} {d.currency}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    {d.donorEmail} · {formatDate(d.createdAt)} · {getDonationDescriptor(d)} · PayPal
                    {alreadyRefunded > 0 && ` · $${alreadyRefunded.toFixed(2)} refunded`}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                  {d.status.replace("_", " ")}
                </span>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Notes</label>
                    <textarea
                      value={notesDraft[d.donationId] ?? d.notes ?? ""}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [d.donationId]: e.target.value }))}
                      rows={2}
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                    />
                    <button
                      onClick={() => saveNotes(d.donationId)}
                      disabled={savingId === d.donationId}
                      style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, border: "none", background: "#111111", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingId === d.donationId ? 0.6 : 1 }}
                    >
                      {savingId === d.donationId ? "Saving…" : "Save Notes"}
                    </button>
                  </div>

                  {d.paypalTransactionId && (
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>PayPal transaction: {d.paypalTransactionId}</p>
                  )}

                  {d.receiptUrl ? (
                    <a href={d.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginBottom: 16, color: "#E77A2D", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                      📄 View receipt →
                    </a>
                  ) : (
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>No receipt on file yet.</p>
                  )}

                  {/* Refund history -- audit trail of every refund
                      actually processed against this donation, oldest
                      first. */}
                  {d.refundHistory && d.refundHistory.length > 0 && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F7F4F0", borderRadius: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Refund History</p>
                      {d.refundHistory.map((r) => (
                        <p key={r.refundId} style={{ fontSize: 12, color: "#111111", margin: "2px 0" }}>
                          ${r.amount.toFixed(2)} refunded on {formatDate(r.refundedAt)}
                        </p>
                      ))}
                    </div>
                  )}

                  {canRefund && (
                    <div style={{ paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
                        Refund amount (up to ${remaining.toFixed(2)} remaining)
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={remaining}
                          placeholder={remaining.toFixed(2)}
                          value={refundAmountDraft[d.donationId] ?? ""}
                          onChange={(e) => setRefundAmountDraft((prev) => ({ ...prev, [d.donationId]: e.target.value }))}
                          style={{ width: 110, padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                        />
                        <button
                          onClick={() => processRefund(d.donationId)}
                          disabled={refundingId === d.donationId}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #B5900F", background: "#fff", color: "#B5900F", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: refundingId === d.donationId ? 0.6 : 1 }}
                        >
                          {refundingId === d.donationId ? "Processing…" : "Process Refund"}
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                        Leave blank to refund the full ${remaining.toFixed(2)} remaining. This calls PayPal directly and cannot be undone.
                      </p>
                      {refundError[d.donationId] && (
                        <p style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>{refundError[d.donationId]}</p>
                      )}
                    </div>
                  )}

                  {!canRefund && d.status !== "refunded" && !d.paypalTransactionId && (
                    <p style={{ fontSize: 12, color: "#9CA3AF", paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      No PayPal transaction on record -- can&apos;t process an automatic refund for this donation.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
        </>
      )}
    </main>
  );
}
