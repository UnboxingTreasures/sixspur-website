"use client";

import { useState, useEffect, useCallback } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const STATUSES = ["Open", "Under Review", "Approved", "Denied"] as const;
type Status = (typeof STATUSES)[number];

interface Application {
  applicationId: string;
  status: Status;
  submittedAt: string;
  statusUpdatedAt: string;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryPhone: string | null;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  interestedIn: string;
  pdfKey: string;
  pdfDownloadUrl?: string;
  fencePhotos?: { key: string; url: string }[];
}

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  "Open":          { bg: "#FEF3EB", text: "#E77A2D" },
  "Under Review":  { bg: "#FEF9E7", text: "#B5900F" },
  "Approved":      { bg: "#EAF7EE", text: "#1E8A4C" },
  "Denied":        { bg: "#FEF2F2", text: "#DC2626" },
};

export default function AdminAdoptionsPage() {
  const [activeTab, setActiveTab] = useState<Status>("Open");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: Status } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<string, Application>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  const authedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const token = await getIdToken();
    if (!token) throw new Error("Not logged in");
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  }, []);

  const toggleExpand = async (applicationId: string) => {
    if (expandedId === applicationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(applicationId);
    if (!detailCache[applicationId]) {
      setDetailLoading(true);
      try {
        const res = await authedFetch(`/admin/adoptions/${applicationId}`);
        const data = await res.json();
        if (res.ok) {
          setDetailCache((prev) => ({ ...prev, [applicationId]: data }));
        }
      } catch {
        // Non-fatal -- the card still shows without a download link
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const fetchApplications = useCallback(async (status: Status) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/admin/adoptions?status=${encodeURIComponent(status)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load applications");
      setApplications(data.applications || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    fetchApplications(activeTab);
    setExpandedId(null);
  }, [activeTab, fetchApplications]);

  const confirmStatusChange = async () => {
    if (!pendingStatus) return;
    setUpdating(true);
    try {
      const res = await authedFetch(`/admin/adoptions/${pendingStatus.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: pendingStatus.status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      setApplications((prev) => prev.filter((a) => a.applicationId !== pendingStatus.id));
      setExpandedId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
      setPendingStatus(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111111" }}>
        Adoptions
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", borderBottom: "1.5px solid #E8E2DC" }}>
        {STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            style={{
              padding: "10px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: activeTab === status ? 700 : 500,
              color: activeTab === status ? "#111111" : "#9CA3AF",
              borderBottom: activeTab === status ? "2.5px solid #E77A2D" : "2.5px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, background: "#FEF2F2",
          border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem",
        }}>
          {error}
        </div>
      )}

      {!loading && !error && applications.length === 0 && (
        <p style={{ color: "#9CA3AF", fontSize: 14 }}>No applications in {activeTab}.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {applications.map((app) => {
          const isExpanded = expandedId === app.applicationId;
          const colors = STATUS_COLORS[app.status];

          return (
            <div
              key={app.applicationId}
              style={{
                background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                onClick={() => toggleExpand(app.applicationId)}
                style={{
                  padding: "16px 20px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>
                    {app.firstName} {app.lastName}
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    Interested in: {app.interestedIn} · Submitted {formatDate(app.submittedAt)}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                  background: colors.bg, color: colors.text, whiteSpace: "nowrap",
                }}>
                  {app.status}
                </span>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, fontSize: 13 }}>
                    <div>
                      <div style={{ color: "#9CA3AF", marginBottom: 2 }}>Email</div>
                      <div style={{ color: "#111111" }}>{app.primaryEmail}</div>
                    </div>
                    <div>
                      <div style={{ color: "#9CA3AF", marginBottom: 2 }}>Phone</div>
                      <div style={{ color: "#111111" }}>{app.primaryPhone || "—"}</div>
                    </div>
                    {app.secondaryEmail && (
                      <div>
                        <div style={{ color: "#9CA3AF", marginBottom: 2 }}>Secondary Email</div>
                        <div style={{ color: "#111111" }}>{app.secondaryEmail}</div>
                      </div>
                    )}
                    {app.secondaryPhone && (
                      <div>
                        <div style={{ color: "#9CA3AF", marginBottom: 2 }}>Secondary Phone</div>
                        <div style={{ color: "#111111" }}>{app.secondaryPhone}</div>
                      </div>
                    )}
                  </div>

                  {detailLoading && !detailCache[app.applicationId] && (
                    <p style={{ marginTop: 16, fontSize: 13, color: "#9CA3AF" }}>Loading PDF link…</p>
                  )}
                  {detailCache[app.applicationId]?.pdfDownloadUrl && (
                    <a
                      href={detailCache[app.applicationId].pdfDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block", marginTop: 16,
                        color: "#E77A2D", fontWeight: 700, fontSize: 13, textDecoration: "none",
                      }}
                    >
                      📄 Download full application (PDF) →
                    </a>
                  )}

                  {detailCache[app.applicationId]?.fencePhotos && detailCache[app.applicationId].fencePhotos!.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Fence / Enclosure Photos ({detailCache[app.applicationId].fencePhotos!.length})
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {detailCache[app.applicationId].fencePhotos!.map((photo) => (
                          <a
                            key={photo.key}
                            href={photo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "block" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt="Fence or enclosure photo"
                              style={{
                                width: 90, height: 90, objectFit: "cover",
                                borderRadius: 8, border: "1.5px solid #E8E2DC",
                              }}
                            />
                          </a>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                        Links expire in 15 minutes — collapse and re-expand this card for new ones.
                      </div>
                    </div>
                  )}

                  {app.status !== "Approved" && app.status !== "Denied" && (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Move to
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {STATUSES.filter((s) => s !== app.status && s !== "Open").map((s) => (
                          <button
                            key={s}
                            onClick={() => setPendingStatus({ id: app.applicationId, status: s })}
                            style={{
                              padding: "8px 14px", borderRadius: 8,
                              border: `1.5px solid ${STATUS_COLORS[s].text}`,
                              background: "#fff", color: STATUS_COLORS[s].text,
                              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(app.status === "Approved" || app.status === "Denied") && (
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F0EBE5", fontSize: 12, color: "#9CA3AF" }}>
                      This is a final status and can&apos;t be changed.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingStatus && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 8 }}>
              Change status to &ldquo;{pendingStatus.status}&rdquo;?
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              {(pendingStatus.status === "Approved" || pendingStatus.status === "Denied" || pendingStatus.status === "Under Review")
                ? "The applicant will automatically receive an email about this update."
                : "This won't send the applicant an email."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPendingStatus(null)}
                disabled={updating}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC",
                  background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updating}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: updating ? "default" : "pointer", fontFamily: "inherit",
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
