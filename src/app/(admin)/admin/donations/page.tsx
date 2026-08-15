"use client";

import { useState, useEffect, useMemo } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Donation {
  donationId: string;
  donorId: string;
  donorEmail: string;
  amount: number;
  currency: string;
  type: "one-time" | "recurring";
  status: "completed" | "refunded" | "failed";
  paymentMethod: "paypal";
  paypalTransactionId?: string;
  receiptUrl?: string;
  notes?: string;
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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "#EAF7EE", text: "#1E8A4C" },
  refunded: { bg: "#FEF9E7", text: "#B5900F" },
  failed: { bg: "#FEF2F2", text: "#DC2626" },
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchDonations();
  }, []);

  // Years that actually have donations in them, newest first -- avoids
  // showing empty years in the dropdown that would just filter to
  // nothing.
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

  const markRefunded = async (donationId: string) => {
    if (!confirm("Mark this donation as refunded? This doesn't process a real refund through PayPal -- do that there first, this just updates Six Spur's own record.")) return;
    setSavingId(donationId);
    try {
      const res = await authedFetch(`/admin/donations/${donationId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "refunded" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      setDonations((prev) => prev.map((d) => (d.donationId === donationId ? data : d)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSavingId(null);
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

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "0.5rem" }}>Donations</h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.25rem" }}>
        {periodLabel}: <strong style={{ color: "#111111" }}>${totalForPeriod.toFixed(2)}</strong>
      </p>

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
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                  {d.status}
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

                  {d.status === "completed" && (
                    <div style={{ paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      <button
                        onClick={() => markRefunded(d.donationId)}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #B5900F", background: "#fff", color: "#B5900F", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Mark as Refunded
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
