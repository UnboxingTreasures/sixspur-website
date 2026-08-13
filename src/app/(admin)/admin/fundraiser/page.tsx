"use client";

import { useState, useEffect } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Fundraiser {
  fundraiserId: string;
  title: string;
  description: string;
  goalAmount: number;
  closingDate: string;
  status: "draft" | "active" | "stopped";
  raisedAmount: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#F0EBE5", text: "#6B7280" },
  active: { bg: "#EAF7EE", text: "#1E8A4C" },
  stopped: { bg: "#FEF2F2", text: "#DC2626" },
};

interface Draft {
  title: string;
  description: string;
  goalAmount: string;
  closingDate: string;
}

function emptyDraft(): Draft {
  return { title: "", description: "", goalAmount: "", closingDate: "" };
}

function draftFromFundraiser(f: Fundraiser): Draft {
  return {
    title: f.title,
    description: f.description || "",
    goalAmount: String(f.goalAmount),
    closingDate: f.closingDate,
  };
}

function FundraiserFields({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Title</label>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="e.g. Winter Barn Repair"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Goal Amount ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.goalAmount}
            onChange={(e) => setDraft({ ...draft, goalAmount: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Closing Date</label>
          <input
            type="date"
            value={draft.closingDate}
            onChange={(e) => setDraft({ ...draft, closingDate: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Description</label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          placeholder="Brief description shown to donors"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
        />
      </div>
    </>
  );
}

export default function AdminFundraiserPage() {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft());
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [editDrafts, setEditDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lifecycleActionId, setLifecycleActionId] = useState<string | null>(null);

  const activeFundraiser = fundraisers.find((f) => f.status === "active");

  const authedFetch = async (path: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) throw new Error("Not logged in");
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };

  const fetchFundraisers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/admin/fundraisers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load fundraisers");
      setFundraisers(data.fundraisers || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load fundraisers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFundraisers();
  }, []);

  const submitAdd = async () => {
    if (!addDraft.title.trim()) return setAddError("Title is required");
    const goal = parseFloat(addDraft.goalAmount);
    if (!Number.isFinite(goal) || goal <= 0) return setAddError("Enter a valid goal amount");
    if (!addDraft.closingDate) return setAddError("Closing date is required");

    setAddSubmitting(true);
    setAddError("");
    try {
      const res = await authedFetch("/admin/fundraisers", {
        method: "POST",
        body: JSON.stringify({ title: addDraft.title, description: addDraft.description, goalAmount: goal, closingDate: addDraft.closingDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create fundraiser");

      setFundraisers((prev) => [{ ...data, raisedAmount: 0 }, ...prev]);
      setShowAddModal(false);
      setAddDraft(emptyDraft());
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create fundraiser");
    } finally {
      setAddSubmitting(false);
    }
  };

  const saveEdit = async (fundraiserId: string) => {
    const draft = editDrafts[fundraiserId];
    if (!draft) return;
    const goal = parseFloat(draft.goalAmount);
    if (!Number.isFinite(goal) || goal <= 0) return alert("Enter a valid goal amount");

    setSavingId(fundraiserId);
    try {
      const res = await authedFetch(`/admin/fundraisers/${fundraiserId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: draft.title, description: draft.description, goalAmount: goal, closingDate: draft.closingDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setFundraisers((prev) => prev.map((f) => (f.fundraiserId === fundraiserId ? { ...f, ...data } : f)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleBegin = async (fundraiserId: string) => {
    const other = fundraisers.find((f) => f.status === "active" && f.fundraiserId !== fundraiserId);
    const confirmMsg = other
      ? `This will stop "${other.title}" (currently active) and start this one instead. Continue?`
      : "Start this fundraiser? It'll appear live on the Ways to Give page.";
    if (!confirm(confirmMsg)) return;

    setLifecycleActionId(fundraiserId);
    try {
      const res = await authedFetch(`/admin/fundraisers/${fundraiserId}/begin`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start fundraiser");
      await fetchFundraisers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start fundraiser");
    } finally {
      setLifecycleActionId(null);
    }
  };

  const handleStop = async (fundraiserId: string) => {
    if (!confirm("Stop this fundraiser? It'll be removed from the Ways to Give page immediately.")) return;
    setLifecycleActionId(fundraiserId);
    try {
      const res = await authedFetch(`/admin/fundraisers/${fundraiserId}/stop`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to stop fundraiser");
      setFundraisers((prev) => prev.map((f) => (f.fundraiserId === fundraiserId ? { ...f, ...data } : f)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to stop fundraiser");
    } finally {
      setLifecycleActionId(null);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>Fundraiser</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Create Fundraiser
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: "1.5rem" }}>
        {activeFundraiser
          ? <>Currently live: <strong style={{ color: "#111111" }}>{activeFundraiser.title}</strong> — ${activeFundraiser.raisedAmount.toFixed(2)} of ${activeFundraiser.goalAmount.toFixed(2)}</>
          : "No fundraiser is currently active."}
      </p>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {!loading && !error && fundraisers.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No fundraisers created yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fundraisers.map((f) => {
          const isExpanded = expandedId === f.fundraiserId;
          const draft = editDrafts[f.fundraiserId] ?? draftFromFundraiser(f);
          const colors = STATUS_COLORS[f.status];
          const percent = f.goalAmount > 0 ? Math.min(100, (f.raisedAmount / f.goalAmount) * 100) : 0;

          return (
            <div key={f.fundraiserId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : f.fundraiserId);
                  setEditDrafts((prev) => ({ ...prev, [f.fundraiserId]: draftFromFundraiser(f) }));
                }}
                style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    ${f.raisedAmount.toFixed(2)} of ${f.goalAmount.toFixed(2)} ({percent.toFixed(0)}%) · Closes {f.closingDate}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: colors.bg, color: colors.text, whiteSpace: "nowrap" }}>
                  {f.status}
                </span>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ marginTop: 16 }}>
                    <FundraiserFields draft={draft} setDraft={(d) => setEditDrafts((prev) => ({ ...prev, [f.fundraiserId]: d }))} />
                    <button
                      onClick={() => saveEdit(f.fundraiserId)}
                      disabled={savingId === f.fundraiserId}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#111111", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingId === f.fundraiserId ? 0.6 : 1 }}
                    >
                      {savingId === f.fundraiserId ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #F0EBE5", display: "flex", gap: 8 }}>
                    {f.status !== "active" && (
                      <button
                        onClick={() => handleBegin(f.fundraiserId)}
                        disabled={lifecycleActionId === f.fundraiserId}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #1E8A4C", background: "#fff", color: "#1E8A4C", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: lifecycleActionId === f.fundraiserId ? 0.6 : 1 }}
                      >
                        {lifecycleActionId === f.fundraiserId ? "Starting…" : "Begin"}
                      </button>
                    )}
                    {f.status === "active" && (
                      <button
                        onClick={() => handleStop(f.fundraiserId)}
                        disabled={lifecycleActionId === f.fundraiserId}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: lifecycleActionId === f.fundraiserId ? 0.6 : 1 }}
                      >
                        {lifecycleActionId === f.fundraiserId ? "Stopping…" : "Stop"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 4 }}>Create Fundraiser</div>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Starts as a draft -- use &quot;Begin&quot; from the list to make it live.</p>

            <FundraiserFields draft={addDraft} setDraft={setAddDraft} />

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
                {addSubmitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
