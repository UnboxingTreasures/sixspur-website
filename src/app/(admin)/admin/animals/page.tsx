"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface AnimalType {
  animalId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

// Mirrors the backend's slugify() exactly, so we can predict the animalId
// (and therefore the S3 upload path) before a brand-new type is created.
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uploadPhoto(animalId: string, file: File): Promise<string> {
  const presignRes = await fetch(`${API_URL}/admin/animals/${animalId}/photos/presign`, {
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

export default function AdminAnimalsPage() {
  const [animals, setAnimals] = useState<AnimalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [renameSaving, setRenameSaving] = useState<string | null>(null);

  const [pendingDeleteType, setPendingDeleteType] = useState<AnimalType | null>(null);
  const [deletingType, setDeletingType] = useState(false);

  const [pendingRemovePhoto, setPendingRemovePhoto] = useState<{ animalId: string; photoUrl: string } | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const [settingThumbnailFor, setSettingThumbnailFor] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const fetchAnimals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/animals`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load animal types");
      setAnimals(data.animals || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load animal types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnimals();
  }, [fetchAnimals]);

  // ── Add new type ─────────────────────────────────────────────────────────
  const resetAddForm = () => {
    setAddName("");
    setAddDescription("");
    setAddFile(null);
    setAddError("");
  };

  const submitAddType = async () => {
    if (!addName.trim()) return setAddError("Name is required");
    if (!addFile) return setAddError("A photo is required — every animal type needs at least one image");

    setAddSubmitting(true);
    setAddError("");
    try {
      const predictedId = slugify(addName);
      const seedPhotoUrl = await uploadPhoto(predictedId, addFile);

      const res = await fetch(`${API_URL}/admin/animals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, description: addDescription, seedPhotoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create animal type");

      setAnimals((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddModal(false);
      resetAddForm();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create animal type");
    } finally {
      setAddSubmitting(false);
    }
  };

  // ── Rename ───────────────────────────────────────────────────────────────
  const saveRename = async (animalId: string) => {
    const newName = renameDrafts[animalId]?.trim();
    if (!newName) return;

    setRenameSaving(animalId);
    try {
      const res = await fetch(`${API_URL}/admin/animals/${animalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed");
      setAnimals((prev) => prev.map((a) => (a.animalId === animalId ? { ...a, name: data.name } : a)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setRenameSaving(null);
    }
  };

  // ── Delete type ──────────────────────────────────────────────────────────
  const confirmDeleteType = async () => {
    if (!pendingDeleteType) return;
    setDeletingType(true);
    try {
      const res = await fetch(`${API_URL}/admin/animals/${pendingDeleteType.animalId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setAnimals((prev) => prev.filter((a) => a.animalId !== pendingDeleteType.animalId));
      setExpandedId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingType(false);
      setPendingDeleteType(null);
    }
  };

  // ── Add photo to existing type ──────────────────────────────────────────
  const handleAddPhoto = async (animalId: string, file: File) => {
    setUploadingPhotoFor(animalId);
    try {
      const cdnUrl = await uploadPhoto(animalId, file);
      const res = await fetch(`${API_URL}/admin/animals/${animalId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls: [cdnUrl] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add photo");
      setAnimals((prev) => prev.map((a) => (a.animalId === animalId ? data : a)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add photo");
    } finally {
      setUploadingPhotoFor(null);
    }
  };

  // ── Remove photo ─────────────────────────────────────────────────────────
  const confirmRemovePhoto = async () => {
    if (!pendingRemovePhoto) return;
    setRemovingPhoto(true);
    try {
      const res = await fetch(`${API_URL}/admin/animals/${pendingRemovePhoto.animalId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: pendingRemovePhoto.photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove photo");
      setAnimals((prev) => prev.map((a) => (a.animalId === pendingRemovePhoto.animalId ? data : a)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setRemovingPhoto(false);
      setPendingRemovePhoto(null);
    }
  };

  // ── Set thumbnail ────────────────────────────────────────────────────────
  const handleSetThumbnail = async (animalId: string, photoUrl: string) => {
    setSettingThumbnailFor(photoUrl);
    try {
      const res = await fetch(`${API_URL}/admin/animals/${animalId}/thumbnail`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set thumbnail");
      setAnimals((prev) => prev.map((a) => (a.animalId === animalId ? data : a)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to set thumbnail");
    } finally {
      setSettingThumbnailFor(null);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>Animals</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "none",
            background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          + Add Animal Type
        </button>
      </div>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {animals.map((animal) => {
          const isExpanded = expandedId === animal.animalId;
          return (
            <div key={animal.animalId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              {/* Header row */}
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : animal.animalId);
                  setRenameDrafts((prev) => ({ ...prev, [animal.animalId]: animal.name }));
                }}
                style={{ padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={animal.thumbnailUrl}
                  alt={animal.name}
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1.5px solid #E8E2DC", flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>{animal.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    {animal.photos?.length || 0} photo{animal.photos?.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  {/* Rename */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Name
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={renameDrafts[animal.animalId] ?? animal.name}
                        onChange={(e) => setRenameDrafts((prev) => ({ ...prev, [animal.animalId]: e.target.value }))}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 8,
                          border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={() => saveRename(animal.animalId)}
                        disabled={renameSaving === animal.animalId || (renameDrafts[animal.animalId] ?? animal.name) === animal.name}
                        style={{
                          padding: "8px 16px", borderRadius: 8, border: "none",
                          background: "#111111", color: "#fff", fontSize: 13, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit", opacity: renameSaving === animal.animalId ? 0.6 : 1,
                        }}
                      >
                        {renameSaving === animal.animalId ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>

                  {/* Photo grid */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Photos — click a photo to set it as the homepage thumbnail
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {(animal.photos || []).map((photoUrl) => {
                        const isThumbnail = animal.thumbnailUrl === photoUrl;
                        return (
                          <div key={photoUrl} style={{ position: "relative" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt=""
                              onClick={() => !isThumbnail && handleSetThumbnail(animal.animalId, photoUrl)}
                              style={{
                                width: 84, height: 84, objectFit: "cover", borderRadius: 8,
                                border: isThumbnail ? "3px solid #E77A2D" : "1.5px solid #E8E2DC",
                                cursor: isThumbnail ? "default" : "pointer",
                                opacity: settingThumbnailFor === photoUrl ? 0.5 : 1,
                              }}
                            />
                            {isThumbnail && (
                              <div style={{
                                position: "absolute", top: -8, left: -8,
                                background: "#E77A2D", color: "#fff", borderRadius: "50%",
                                width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700,
                              }}>
                                ★
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingRemovePhoto({ animalId: animal.animalId, photoUrl });
                              }}
                              style={{
                                position: "absolute", top: -8, right: -8,
                                width: 22, height: 22, borderRadius: "50%",
                                border: "1.5px solid #E8E2DC", background: "#fff", color: "#DC2626",
                                fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1,
                                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                              }}
                              title="Remove photo"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}

                      {/* Add photo tile */}
                      <label
                        style={{
                          width: 84, height: 84, borderRadius: 8, border: "2px dashed #E8D5C4",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: uploadingPhotoFor === animal.animalId ? "default" : "pointer",
                          color: "#E77A2D", fontSize: 24, background: "#FAFAF8",
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          style={{ display: "none" }}
                          disabled={uploadingPhotoFor === animal.animalId}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAddPhoto(animal.animalId, file);
                            e.target.value = "";
                          }}
                        />
                        {uploadingPhotoFor === animal.animalId ? "…" : "+"}
                      </label>
                    </div>
                  </div>

                  {/* Delete type */}
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                    <button
                      onClick={() => setPendingDeleteType(animal)}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "1.5px solid #DC2626",
                        background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Delete this animal type
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Type modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 16 }}>
              Add Animal Type
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Name</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Pigs"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Description (optional)</label>
              <textarea
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
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
                  ref={addFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                />
                {addFile ? `✓ ${addFile.name}` : "Click to choose a photo"}
              </label>
            </div>

            {addError && (
              <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{addError}</div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                disabled={addSubmitting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={submitAddType}
                disabled={addSubmitting}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: addSubmitting ? "default" : "pointer", fontFamily: "inherit", opacity: addSubmitting ? 0.6 : 1,
                }}
              >
                {addSubmitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete type confirm */}
      {pendingDeleteType && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 8 }}>
              Delete &ldquo;{pendingDeleteType.name}&rdquo;?
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              This permanently deletes all {pendingDeleteType.photos?.length || 0} photo(s) for this type,
              and removes it from the homepage and Farm Family page. Any photo also used by another
              animal type will be kept, not deleted. This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPendingDeleteType(null)}
                disabled={deletingType}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteType}
                disabled={deletingType}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: deletingType ? "default" : "pointer", fontFamily: "inherit", opacity: deletingType ? 0.6 : 1,
                }}
              >
                {deletingType ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove photo confirm */}
      {pendingRemovePhoto && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 380, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 8 }}>
              Remove this photo?
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              Are you sure you want to remove this photo? This can&apos;t be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPendingRemovePhoto(null)}
                disabled={removingPhoto}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemovePhoto}
                disabled={removingPhoto}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: removingPhoto ? "default" : "pointer", fontFamily: "inherit", opacity: removingPhoto ? 0.6 : 1,
                }}
              >
                {removingPhoto ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
