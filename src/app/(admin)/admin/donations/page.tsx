"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Donation {
  donationId: string;
  donorId: string;
  donorEmail: string;
  amount: number;
  currency: string;
  type: "one-time" | "recurring";
  status: "completed" | "refunded" | "failed";
  paymentMethod: "paypal" | "manual";
  paypalTransactionId?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "#EAF7EE", text: "#1E8A4C" },
  refunded: { bg: "#FEF9E7", text: "#B5900F" },
  failed: { bg: "#FEF2F2", text: "#DC2626" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addType, setAddType] = useState<"one-time" | "recurring">("one-time");
  const [addNotes, setAddNotes] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchDonations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/donations`);
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

  const submitAdd = async () => {
    if (!addEmail.trim()) return setAddError("Donor email is required");
    const amount = parseFloat(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setAddError("Enter a valid amount");

    setAddSubmitting(true);
    setAddError("");
    try {
      const res = await fetch(`${API_URL}/admin/donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorEmail: addEmail.trim(), amount, type: addType, notes: addNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add donation");

      setDonations((prev) => [data, ...prev]);
      setShowAddModal(false);
      setAddEmail("");
      setAddAmount("");
      setAddType("one-time");
      setAddNotes("");
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add donation");
    } finally {
      setAddSubmitting(false);
    }
  };

  const saveNotes = async (donationId: string) => {
    const notes = notesDraft[donationId];
    if (notes === undefined) return;
    setSavingId(donationId);
    try {
      const res = await fetch(`${API_URL}/admin/donations/${donationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API_URL}/admin/donations/${donationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

  const totalThisMonth = donations
    .filter((d) => {
      const d1 = new Date(d.createdAt);
      const now = new Date();
      return d.status === "completed" && d1.getMonth() === now.getMonth() && d1.getFullYear() === now.getFullYear();
    })
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>Donations</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Record Donation
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.5rem" }}>
        This month: <strong style={{ color: "#111111" }}>${totalThisMonth.toFixed(2)}</strong>
      </p>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {!loading && !error && donations.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No donations recorded yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {donations.map((d) => {
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
                    {d.donorEmail} · {formatDate(d.createdAt)} · {d.type === "recurring" ? "Monthly" : "One-time"} · {d.paymentMethod === "manual" ? "Manual entry" : "PayPal"}
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

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 4 }}>Record a Donation</div>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>For checks, cash, or anything that didn&apos;t come through PayPal checkout.</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Donor Email</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="donor@example.com"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>They need an existing donor account -- this looks them up, it doesn&apos;t create one.</p>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Amount ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Type</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as "one-time" | "recurring")}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
                >
                  <option value="one-time">One-time</option>
                  <option value="recurring">Recurring (this cycle)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Notes</label>
              <input
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="e.g. Check #1234"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>

            {addError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{addError}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowAddModal(false); setAddError(""); }}
                disabled={addSubmitting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={submitAdd}
                disabled={addSubmitting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: addSubmitting ? "default" : "pointer", fontFamily: "inherit", opacity: addSubmitting ? 0.6 : 1 }}
              >
                {addSubmitting ? "Recording…" : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
