"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface StaffMember {
  staffId: string;
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uploadPhoto(staffId: string, file: File): Promise<string> {
  const presignRes = await fetch(`${API_URL}/admin/staff/${staffId}/photo/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || "Failed to get upload URL");

  const uploadRes = await fetch(presignData.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!uploadRes.ok) throw new Error("Upload to S3 failed");

  return presignData.cdnUrl;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addBio, setAddBio] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [editDrafts, setEditDrafts] = useState<Record<string, { name: string; title: string; bio: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/staff`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load staff");
      setStaff(data.staff || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const resetAddForm = () => {
    setAddName("");
    setAddTitle("");
    setAddBio("");
    setAddFile(null);
    setAddError("");
  };

  const submitAdd = async () => {
    if (!addName.trim()) return setAddError("Name is required");
    if (!addFile) return setAddError("A photo is required");

    setAddSubmitting(true);
    setAddError("");
    try {
      const predictedId = slugify(addName);
      const imageUrl = await uploadPhoto(predictedId, addFile);

      const res = await fetch(`${API_URL}/admin/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, title: addTitle, bio: addBio, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add staff member");

      setStaff((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddModal(false);
      resetAddForm();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add staff member");
    } finally {
      setAddSubmitting(false);
    }
  };

  const saveEdit = async (staffId: string) => {
    const draft = editDrafts[staffId];
    if (!draft) return;

    setSavingId(staffId);
    try {
      const res = await fetch(`${API_URL}/admin/staff/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, title: draft.title, bio: draft.bio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStaff((prev) => prev.map((s) => (s.staffId === staffId ? data : s)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleReplacePhoto = async (staffId: string, file: File) => {
    setUploadingPhotoFor(staffId);
    try {
      const imageUrl = await uploadPhoto(staffId, file);
      const res = await fetch(`${API_URL}/admin/staff/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update photo");
      setStaff((prev) => prev.map((s) => (s.staffId === staffId ? data : s)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update photo");
    } finally {
      setUploadingPhotoFor(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/admin/staff/${pendingDelete.staffId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setStaff((prev) => prev.filter((s) => s.staffId !== pendingDelete.staffId));
      setExpandedId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>Staff</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "none",
            background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          + Add Staff Member
        </button>
      </div>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {staff.map((member) => {
          const isExpanded = expandedId === member.staffId;
          const draft = editDrafts[member.staffId] ?? { name: member.name, title: member.title, bio: member.bio };

          return (
            <div key={member.staffId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : member.staffId);
                  setEditDrafts((prev) => ({ ...prev, [member.staffId]: { name: member.name, title: member.title, bio: member.bio } }));
                }}
                style={{ padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.imageUrl}
                  alt={member.name}
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1.5px solid #E8E2DC", flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>{member.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{member.title || "—"}</div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Name</label>
                      <input
                        value={draft.name}
                        onChange={(e) => setEditDrafts((prev) => ({ ...prev, [member.staffId]: { ...draft, name: e.target.value } }))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Title</label>
                      <input
                        value={draft.title}
                        onChange={(e) => setEditDrafts((prev) => ({ ...prev, [member.staffId]: { ...draft, title: e.target.value } }))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Bio</label>
                      <textarea
                        value={draft.bio}
                        onChange={(e) => setEditDrafts((prev) => ({ ...prev, [member.staffId]: { ...draft, bio: e.target.value } }))}
                        rows={3}
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                      />
                    </div>
                    <button
                      onClick={() => saveEdit(member.staffId)}
                      disabled={savingId === member.staffId}
                      style={{
                        alignSelf: "flex-start", padding: "8px 16px", borderRadius: 8, border: "none",
                        background: "#111111", color: "#fff", fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", opacity: savingId === member.staffId ? 0.6 : 1,
                      }}
                    >
                      {savingId === member.staffId ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Photo
                    </div>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E8D5C4",
                      cursor: uploadingPhotoFor === member.staffId ? "default" : "pointer",
                      background: "#FAFAF8", fontSize: 13, color: "#E77A2D", fontWeight: 700,
                    }}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        disabled={uploadingPhotoFor === member.staffId}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleReplacePhoto(member.staffId, file);
                          e.target.value = "";
                        }}
                      />
                      {uploadingPhotoFor === member.staffId ? "Uploading…" : "Replace Photo"}
                    </label>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                    <button
                      onClick={() => setPendingDelete(member)}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "1.5px solid #DC2626",
                        background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Remove this staff member
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 16 }}>Add Staff Member</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Name</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Title</label>
              <input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="e.g. Ranch Caretaker"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Bio</label>
              <textarea
                value={addBio}
                onChange={(e) => setAddBio(e.target.value)}
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>
                Photo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                border: "2px dashed #E8D5C4", borderRadius: 10, padding: "16px", cursor: "pointer",
                background: addFile ? "#FEF3EB" : "#FAFAF8", fontSize: 13, color: "#E77A2D", fontWeight: 700,
              }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                />
                {addFile ? `✓ ${addFile.name}` : "Click to choose a photo"}
              </label>
            </div>

            {addError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{addError}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                disabled={addSubmitting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={submitAdd}
                disabled={addSubmitting}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: addSubmitting ? "default" : "pointer", fontFamily: "inherit", opacity: addSubmitting ? 0.6 : 1,
                }}
              >
                {addSubmitting ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 380, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 8 }}>
              Remove {pendingDelete.name}?
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              This removes them from the homepage and About page, and permanently deletes their photo. This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: deleting ? "default" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
