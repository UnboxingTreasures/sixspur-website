"use client";

import { useState, useEffect } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Mirrors the SUPER_ADMIN_EMAILS allowlist enforced server-side in
// lambda/adminUserAccess/index.js. This frontend copy is UI-only --
// hiding the Revoke button for everyone else is just good UX so people
// aren't shown a control that will fail for them. The actual security
// boundary is the backend check; if these two lists ever drift apart,
// the backend's list is what actually governs.
const SUPER_ADMIN_EMAILS = new Set(["sixspurrescue@gmail.com", "jaylefler1974@gmail.com"]);

interface Admin {
  donorId: string;
  email: string;
  updatedAt: string;
}

interface SmsRecipient {
  phoneNumber: string;
  label: string | null;
  addedBy: string | null;
  addedAt: string | null;
  status: "Pending" | "Verified" | "Unknown";
}

export default function AdminUserAccessPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState("");

  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Whether THIS logged-in admin is allowed to revoke anyone -- fetched
  // once on mount, same /donor/profile endpoint the nav bar already
  // uses to check isAdmin.
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const canRevoke = currentUserEmail !== null && SUPER_ADMIN_EMAILS.has(currentUserEmail.trim().toLowerCase());

  // --- Text Alert Recipients state ---
  const [recipients, setRecipients] = useState<SmsRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [recipientsError, setRecipientsError] = useState("");

  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Which number is currently showing an inline "enter code" input
  const [verifyingPhone, setVerifyingPhone] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [removingPhone, setRemovingPhone] = useState<string | null>(null);

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

  const fetchCurrentUser = async () => {
    try {
      const res = await authedFetch("/donor/profile");
      const data = await res.json();
      if (res.ok) setCurrentUserEmail(data.email || null);
    } catch (err) {
      // Non-fatal -- worst case, canRevoke just stays false and every
      // Revoke button stays hidden, which is the safe default anyway.
      console.error("Failed to load current user profile:", err);
    }
  };

  const fetchRecipients = async () => {
    setLoadingRecipients(true);
    setRecipientsError("");
    try {
      const res = await authedFetch("/admin/sms-recipients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load recipients");
      setRecipients(data.recipients || []);
    } catch (err: unknown) {
      setRecipientsError(err instanceof Error ? err.message : "Failed to load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchCurrentUser();
    fetchRecipients();
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

  const handleAddRecipient = async () => {
    if (!newPhone.trim() || !newLabel.trim()) {
      setAddError("Phone number and label are both required");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const res = await authedFetch("/admin/sms-recipients", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: newPhone.trim(), label: newLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add recipient");
      setVerifyingPhone(newPhone.trim());
      setNewPhone("");
      setNewLabel("");
      await fetchRecipients();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add recipient");
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (phoneNumber: string) => {
    if (!verifyCode.trim()) {
      setVerifyError("Enter the code sent by text");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await authedFetch("/admin/sms-recipients/verify", {
        method: "POST",
        body: JSON.stringify({ phoneNumber, code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify code");
      setVerifyingPhone(null);
      setVerifyCode("");
      await fetchRecipients();
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveRecipient = async (phoneNumber: string, label: string | null) => {
    if (!confirm(`Remove ${label || phoneNumber} from text alerts?`)) return;
    setRemovingPhone(phoneNumber);
    try {
      const res = await authedFetch("/admin/sms-recipients/remove", {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove recipient");
      setRecipients((prev) => prev.filter((r) => r.phoneNumber !== phoneNumber));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove recipient");
    } finally {
      setRemovingPhone(null);
    }
  };

  const statusColor = (status: SmsRecipient["status"]) =>
    status === "Verified" ? "#16A34A" : status === "Pending" ? "#D97706" : "#9CA3AF";

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

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {admins.map((admin) => (
          <div key={admin.donorId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#111111", fontWeight: 600 }}>{admin.email}</span>
            {canRevoke && (
              <button
                onClick={() => handleRevoke(admin.donorId, admin.email)}
                disabled={revokingId === admin.donorId}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: revokingId === admin.donorId ? 0.6 : 1 }}
              >
                {revokingId === admin.donorId ? "Revoking…" : "Revoke"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Text Alert Recipients */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111111", marginBottom: 8 }}>Text Alert Recipients</h2>
      <div style={{ width: 40, height: 3, background: "#E77A2D", borderRadius: 2, marginBottom: 12 }} />

      <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FFFBEB", border: "1.5px solid #FDE68A", color: "#92400E", fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
        Adding and verifying a number here does not make it start receiving alerts by itself -- the notification
        Lambdas need to be redeployed to pick up newly verified numbers. Ask Jay to redeploy after verifying a new number.
      </div>

      {/* Add form */}
      <div style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>Add a number for text alerts</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="+18135551234"
            style={{ flex: "1 1 160px", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Whose number is this?"
            style={{ flex: "1 1 160px", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
          <button
            onClick={handleAddRecipient}
            disabled={adding}
            style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: adding ? "default" : "pointer", fontFamily: "inherit", opacity: adding ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {adding ? "Adding…" : "Add & Send Code"}
          </button>
        </div>
        {addError && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{addError}</p>}
      </div>

      {loadingRecipients && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {recipientsError && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {recipientsError}
        </div>
      )}
      {!loadingRecipients && !recipientsError && recipients.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No recipients yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recipients.map((r) => (
          <div key={r.phoneNumber} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, color: "#111111", fontWeight: 600 }}>
                  {r.label || "(no label)"} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>— {r.phoneNumber}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: statusColor(r.status), marginTop: 2 }}>{r.status}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {r.status === "Pending" && verifyingPhone !== r.phoneNumber && (
                  <button
                    onClick={() => { setVerifyingPhone(r.phoneNumber); setVerifyCode(""); setVerifyError(""); }}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #E77A2D", background: "#fff", color: "#E77A2D", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Enter Code
                  </button>
                )}
                <button
                  onClick={() => handleRemoveRecipient(r.phoneNumber, r.label)}
                  disabled={removingPhone === r.phoneNumber}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: removingPhone === r.phoneNumber ? 0.6 : 1 }}
                >
                  {removingPhone === r.phoneNumber ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>

            {verifyingPhone === r.phoneNumber && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E8E2DC", display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="6-digit code"
                  style={{ flex: 1, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                />
                <button
                  onClick={() => handleVerify(r.phoneNumber)}
                  disabled={verifying}
                  style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 700, cursor: verifying ? "default" : "pointer", fontFamily: "inherit", opacity: verifying ? 0.6 : 1, whiteSpace: "nowrap" }}
                >
                  {verifying ? "Verifying…" : "Verify"}
                </button>
                <button
                  onClick={() => { setVerifyingPhone(null); setVerifyCode(""); setVerifyError(""); }}
                  style={{ padding: "8px 14px", borderRadius: 6, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
              </div>
            )}
            {verifyingPhone === r.phoneNumber && verifyError && (
              <p style={{ fontSize: 12, color: "#DC2626", marginTop: 8 }}>{verifyError}</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
