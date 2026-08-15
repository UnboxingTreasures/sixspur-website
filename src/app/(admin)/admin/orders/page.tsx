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
interface Order {
  orderId: string;
  email: string;
  donorId: string | null;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: "paid" | "shipped" | "refunded";
  shippingAddress: ShippingAddress;
  paypalTransactionId?: string;
  trackingNumber?: string;
  notes?: string;
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
  refunded: { bg: "#FEF9E7", text: "#B5900F" },
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
  // Archive filter, same pattern as the Donations page -- Month is only
  // meaningful once a specific year is chosen, and switching years or
  // back to "All Years" always resets Month to "all" so the two
  // controls never land in a contradictory state.
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
  const markRefunded = (orderId: string) => {
    if (!confirm("Mark this order as refunded? This doesn't process a real refund through PayPal -- do that there first, this just updates Six Spur's own record.")) return;
    saveOrder(orderId, { status: "refunded" });
  };
  const availableYears = useMemo(() => {
    const years = new Set(orders.map((o) => new Date(o.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (selectedYear === "all") return orders;
    const year = Number(selectedYear);
    return orders.filter((o) => {
      const date = new Date(o.createdAt);
      if (date.getFullYear() !== year) return false;
      if (selectedMonth !== "all" && date.getMonth() !== Number(selectedMonth)) return false;
      return true;
    });
  }, [orders, selectedYear, selectedMonth]);

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
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                  {o.status}
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
                  {o.status === "paid" && (
                    <div style={{ paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Tracking Number (optional)</label>
                      <input
                        type="text"
                        value={trackingDraft[o.orderId] ?? ""}
                        onChange={(e) => setTrackingDraft((prev) => ({ ...prev, [o.orderId]: e.target.value }))}
                        placeholder="e.g. 1Z999AA10123456784"
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", marginBottom: 10 }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => markShipped(o.orderId)}
                          disabled={savingId === o.orderId}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1D5FB5", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Mark as Shipped
                        </button>
                        <button
                          onClick={() => markRefunded(o.orderId)}
                          disabled={savingId === o.orderId}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #B5900F", background: "#fff", color: "#B5900F", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Mark as Refunded
                        </button>
                      </div>
                    </div>
                  )}
                  {o.status === "shipped" && o.trackingNumber && (
                    <p style={{ fontSize: 13, color: "#111111", paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      Tracking: <strong>{o.trackingNumber}</strong>
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
