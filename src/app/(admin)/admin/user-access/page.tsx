"use client";

import { useState, useEffect } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Admin {
  donorId: string;
  email: string;
  updatedAt: string;
}

export default function AdminUserAccessPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState("");

  const [revokingId, setRevokingId] = useState<string | null>(null);

  const authedFetch = async (path: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) throw new Error("Not logged in");
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };

  const fetchAdmins = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/admin/user-access");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load admins");
      setAdmins(data.admins || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleGrant = async () => {
    if (!grantEmail.trim()) return setGrantError("Email is required");

    setGranting(true);
    setGrantError("");
    try {
      const res = await authedFetch("/admin/user-access", {
        method: "POST",
        body: JSON.stringify({ email: grantEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grant admin access");
      setGrantEmail("");
      await fetchAdmins();
    } catch (err: unknown) {
      setGrantError(err instanceof Error ? err.message : "Failed to grant admin access");
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (donorId: string, email: string) => {
    if (!confirm(`Revoke admin access for ${email}? They'll keep their donor account, just lose admin capability.`)) return;

    setRevokingId(donorId);
    try {
      const res = await authedFetch(`/admin/user-access/${donorId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke admin access");
      setAdmins((prev) => prev.filter((a) => a.donorId !== donorId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to revoke admin access");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111", marginBottom: "0.5rem" }}>User Access</h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.5rem" }}>
        Grant or revoke admin panel access. The person needs an existing donor account first -- this doesn&apos;t create new accounts, only elevates one.
      </p>

      {/* Grant form */}
      <div style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>Grant admin access by email</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="someone@example.com"
            style={{ flex: 1, boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
          <button
            onClick={handleGrant}
            disabled={granting}
            style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: granting ? "default" : "pointer", fontFamily: "inherit", opacity: granting ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {granting ? "Granting…" : "Grant Access"}
          </button>
        </div>
        {grantError && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{grantError}</p>}
      </div>

      {/* Current admins list */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111111", marginBottom: 8 }}>Current Admins</h2>
      <div style={{ width: 40, height: 3, background: "#E77A2D", borderRadius: 2, marginBottom: 12 }} />

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {!loading && !error && admins.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No admins found.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {admins.map((admin) => (
          <div key={admin.donorId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#111111", fontWeight: 600 }}>{admin.email}</span>
            <button
              onClick={() => handleRevoke(admin.donorId, admin.email)}
              disabled={revokingId === admin.donorId}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: revokingId === admin.donorId ? 0.6 : 1 }}
            >
              {revokingId === admin.donorId ? "Revoking…" : "Revoke"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
