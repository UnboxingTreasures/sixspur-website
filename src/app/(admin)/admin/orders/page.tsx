"use client";
import { useState, useEffect, useMemo } from "react";
import { getIdToken } from "@/lib/cognito";
const API_URL = process.env.NEXT_PUBLIC_API_URL;
interface OrderItem {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  variantValues?: Record<string, string> | null;
}
interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}
interface RefundEntry {
  refundId: string;
  amount: number;
  currency: string;
  refundedAt: string;
}
interface Order {
  orderId: string;
  email: string;
  donorId: string | null;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: "paid" | "shipped" | "partially_refunded" | "refunded";
  shippingAddress: ShippingAddress;
  paypalTransactionId?: string;
  trackingNumber?: string;
  notes?: string;
  refundedAmount?: number;
  refundHistory?: RefundEntry[];
  createdAt: string;
  paidAt?: string;
}
function getItemsSummary(o: Order): string {
  return o.items
    .map((item) => {
      const variant = item.variantValues ? ` (${Object.values(item.variantValues).join(" / ")})` : "";
      return `${item.quantity}x ${item.name}${variant}`;
    })
    .join(", ");
}
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid: { bg: "#EAF7EE", text: "#1E8A4C" },
  shipped: { bg: "#EAF2FE", text: "#1D5FB5" },
  partially_refunded: { bg: "#FEF9E7", text: "#B5900F" },
  refunded: { bg: "#F3F4F6", text: "#6B7280" },
};
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Refund UI state -- per-order, same pattern as the Donations page,
  // so the amount input/loading/error for one order's refund never
  // bleeds into another's.
  const [refundAmountDraft, setRefundAmountDraft] = useState<Record<string, string>>({});
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<Record<string, string>>({});

  // Archive filter, same pattern as the Donations page -- Month is only
  // meaningful once a specific year is chosen, and switching years or
  // back to "All Years" always resets Month to "all" so the two
  // controls never land in a contradictory state.
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  // "Unshipped" means paid-but-not-yet-shipped -- refunded orders only
  // show under "All", since shipped/unshipped isn't a meaningful
  // distinction for something that was refunded either way.
  const [shipmentFilter, setShipmentFilter] = useState<"all" | "unshipped" | "shipped">("all");
  const authedFetch = async (path: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) throw new Error("Not logged in");
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };
  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/admin/orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load orders");
      setOrders(data.orders || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchOrders();
  }, []);
  const saveOrder = async (orderId: string, fields: Record<string, string>) => {
    setSavingId(orderId);
    try {
      const res = await authedFetch(`/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? data : o)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };
  const saveNotes = (orderId: string) => {
    const notes = notesDraft[orderId];
    if (notes === undefined) return;
    saveOrder(orderId, { notes });
  };
  const markShipped = (orderId: string) => {
    const trackingNumber = trackingDraft[orderId] || "";
    saveOrder(orderId, { status: "shipped", trackingNumber });
  };

  /**
   * Real PayPal refund, full or partial. Available from paid OR shipped
   * status -- a shipped item can still need a refund (wrong size,
   * defective, etc.), so this is deliberately not limited to
   * unshipped orders the way the shipping action itself is. Same
   * pattern as the Donations page's processRefund.
   */
  const processRefund = async (orderId: string) => {
    const order = orders.find((o) => o.orderId === orderId);
    if (!order) return;

    const remaining = Math.round((order.total - (order.refundedAmount || 0)) * 100) / 100;
    const draft = refundAmountDraft[orderId];
    const amount = draft !== undefined && draft !== "" ? Number(draft) : remaining;

    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError((prev) => ({ ...prev, [orderId]: "Enter a valid refund amount." }));
      return;
    }
    if (amount > remaining + 0.005) {
      setRefundError((prev) => ({ ...prev, [orderId]: `Cannot exceed the $${remaining.toFixed(2)} remaining on this order.` }));
      return;
    }

    const isFullRefund = Math.abs(amount - remaining) < 0.005;
    const confirmMessage = isFullRefund
      ? `Refund $${amount.toFixed(2)} to ${order.email} via PayPal? This processes a REAL refund and cannot be undone.`
      : `Refund $${amount.toFixed(2)} (partial) to ${order.email} via PayPal, leaving $${(remaining - amount).toFixed(2)} still refundable? This processes a REAL refund and cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setRefundingId(orderId);
    setRefundError((prev) => ({ ...prev, [orderId]: "" }));
    try {
      const res = await authedFetch(`/admin/orders/${orderId}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? data : o)));
      setRefundAmountDraft((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } catch (err: unknown) {
      setRefundError((prev) => ({ ...prev, [orderId]: err instanceof Error ? err.message : "Refund failed" }));
    } finally {
      setRefundingId(null);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set(orders.map((o) => new Date(o.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (selectedYear !== "all") {
      const year = Number(selectedYear);
      result = result.filter((o) => {
        const date = new Date(o.createdAt);
        if (date.getFullYear() !== year) return false;
        if (selectedMonth !== "all" && date.getMonth() !== Number(selectedMonth)) return false;
        return true;
      });
    }
    if (shipmentFilter === "unshipped") result = result.filter((o) => o.status === "paid");
    if (shipmentFilter === "shipped") result = result.filter((o) => o.status === "shipped");
    return result;
  }, [orders, selectedYear, selectedMonth, shipmentFilter]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth("all");
  };

  // Shipped orders are NOT excluded here -- only refunded orders don't
  // count toward the total, same as the original "This month" figure
  // did. Every status (paid, shipped) still shows up in the list below
  // regardless of the period filter -- the filter is purely date-based.
  const totalForPeriod = filteredOrders
    .filter((o) => o.status !== "refunded")
    .reduce((sum, o) => sum + o.total, 0);

  const periodLabel = selectedYear === "all"
    ? "All time"
    : selectedMonth === "all"
    ? `${selectedYear}`
    : `${MONTH_NAMES[Number(selectedMonth)]} ${selectedYear}`;
  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "0.5rem" }}>Orders</h1>
      <div style={{ width: 40, height: 3, background: "#E77A2D", borderRadius: 2, marginBottom: "0.75rem" }} />
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.25rem" }}>
        {periodLabel}: <strong style={{ color: "#111111" }}>${totalForPeriod.toFixed(2)}</strong>
      </p>

      {/* Archive filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
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

        <div style={{ display: "flex", gap: 4, background: "#F7F4F0", borderRadius: 8, padding: 3 }}>
          {(["all", "unshipped", "shipped"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setShipmentFilter(option)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                textTransform: "capitalize",
                background: shipmentFilter === option ? "#111111" : "transparent",
                color: shipmentFilter === option ? "#fff" : "#6B7280",
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {!loading && !error && orders.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No orders yet.</p>
      )}
      {!loading && !error && orders.length > 0 && filteredOrders.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No orders in {periodLabel.toLowerCase()}.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredOrders.map((o) => {
          const isExpanded = expandedId === o.orderId;
          const colors = STATUS_COLORS[o.status];
          const alreadyRefunded = o.refundedAmount || 0;
          const remaining = Math.round((o.total - alreadyRefunded) * 100) / 100;
          const canRefund = o.status !== "refunded" && remaining > 0 && !!o.paypalTransactionId;

          return (
            <div key={o.orderId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : o.orderId);
                  setNotesDraft((prev) => ({ ...prev, [o.orderId]: o.notes || "" }));
                  setTrackingDraft((prev) => ({ ...prev, [o.orderId]: o.trackingNumber || "" }));
                }}
                style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>${o.total.toFixed(2)}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    {o.email} · {formatDate(o.createdAt)} · {getItemsSummary(o)}
                    {alreadyRefunded > 0 && ` · $${alreadyRefunded.toFixed(2)} refunded`}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                  {o.status.replace("_", " ")}
                </span>
              </div>
              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Items</label>
                    {o.items.map((item, i) => (
                      <div key={i} style={{ fontSize: 13, color: "#111111", marginBottom: 2 }}>
                        {item.quantity} &times; {item.name}
                        {item.variantValues && (
                          <span style={{ color: "#9CA3AF" }}> ({Object.values(item.variantValues).join(" / ")})</span>
                        )}
                        <span style={{ color: "#9CA3AF" }}> — ${(item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
                      Subtotal ${o.subtotal.toFixed(2)} + Shipping ${o.shippingCost.toFixed(2)} = <strong>${o.total.toFixed(2)}</strong>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Shipping Address</label>
                    <div style={{ fontSize: 13, color: "#111111", lineHeight: 1.5 }}>
                      {o.shippingAddress.name}<br />
                      {o.shippingAddress.line1}<br />
                      {o.shippingAddress.line2 && <>{o.shippingAddress.line2}<br /></>}
                      {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.zip}
                    </div>
                  </div>
                  {o.paypalTransactionId && (
                    <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>PayPal transaction: {o.paypalTransactionId}</p>
                  )}
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
                    {o.donorId ? "Placed by logged-in donor" : "Guest checkout"}
                  </p>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Notes</label>
                    <textarea
                      value={notesDraft[o.orderId] ?? o.notes ?? ""}
                      onChange={(e) => setNotesDraft((prev) => ({ ...prev, [o.orderId]: e.target.value }))}
                      rows={2}
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                    />
                    <button
                      onClick={() => saveNotes(o.orderId)}
                      disabled={savingId === o.orderId}
                      style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, border: "none", background: "#111111", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingId === o.orderId ? 0.6 : 1 }}
                    >
                      {savingId === o.orderId ? "Saving…" : "Save Notes"}
                    </button>
                  </div>

                  {/* Refund history -- audit trail of every refund
                      actually processed against this order, oldest
                      first. */}
                  {o.refundHistory && o.refundHistory.length > 0 && (
                    <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F7F4F0", borderRadius: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Refund History</p>
                      {o.refundHistory.map((r) => (
                        <p key={r.refundId} style={{ fontSize: 12, color: "#111111", margin: "2px 0" }}>
                          ${r.amount.toFixed(2)} refunded on {formatDate(r.refundedAt)}
                        </p>
                      ))}
                    </div>
                  )}

                  {o.status === "paid" && (
                    <div style={{ paddingTop: 16, borderTop: "1px solid #F0EBE5", marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Tracking Number (optional)</label>
                      <input
                        type="text"
                        value={trackingDraft[o.orderId] ?? ""}
                        onChange={(e) => setTrackingDraft((prev) => ({ ...prev, [o.orderId]: e.target.value }))}
                        placeholder="e.g. 1Z999AA10123456784"
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", marginBottom: 10 }}
                      />
                      <button
                        onClick={() => markShipped(o.orderId)}
                        disabled={savingId === o.orderId}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1D5FB5", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Mark as Shipped
                      </button>
                    </div>
                  )}

                  {o.status === "shipped" && o.trackingNumber && (
                    <p style={{ fontSize: 13, color: "#111111", marginBottom: 16 }}>
                      Tracking: <strong>{o.trackingNumber}</strong>
                    </p>
                  )}

                  {/* Refund UI -- available from paid OR shipped, unlike
                      the shipping action above which only makes sense
                      for a still-unshipped order. A shipped item can
                      still need a refund. */}
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
                          value={refundAmountDraft[o.orderId] ?? ""}
                          onChange={(e) => setRefundAmountDraft((prev) => ({ ...prev, [o.orderId]: e.target.value }))}
                          style={{ width: 110, padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                        />
                        <button
                          onClick={() => processRefund(o.orderId)}
                          disabled={refundingId === o.orderId}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #B5900F", background: "#fff", color: "#B5900F", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: refundingId === o.orderId ? 0.6 : 1 }}
                        >
                          {refundingId === o.orderId ? "Processing…" : "Process Refund"}
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                        Leave blank to refund the full ${remaining.toFixed(2)} remaining. This calls PayPal directly and cannot be undone.
                      </p>
                      {refundError[o.orderId] && (
                        <p style={{ fontSize: 12, color: "#DC2626", marginTop: 6 }}>{refundError[o.orderId]}</p>
                      )}
                    </div>
                  )}

                  {!canRefund && o.status !== "refunded" && !o.paypalTransactionId && (
                    <p style={{ fontSize: 12, color: "#9CA3AF", paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      No PayPal transaction on record -- can&apos;t process an automatic refund for this order.
                    </p>
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
