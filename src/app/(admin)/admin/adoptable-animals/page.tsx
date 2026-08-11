"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const AGE_UNITS = ["years", "months"];
const SEX_OPTIONS = ["Male", "Female", "Unknown"];

interface AgeValue {
  value: number;
  unit: string;
}

interface Descriptor {
  label: string;
  value: string;
}

interface AdoptableAnimal {
  animalId: string;
  name: string;
  type: string;
  age: AgeValue | null;
  sex: string;
  description: string;
  customDescriptors: Descriptor[];
  photos: string[];
  thumbnailUrl: string;
}

interface FarmAnimalType {
  animalId: string;
  name: string;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uploadPhoto(animalId: string, file: File): Promise<string> {
  const presignRes = await fetch(`${API_URL}/admin/adoptable-animals/${animalId}/photos/presign`, {
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

interface Draft {
  name: string;
  type: string;
  ageValue: string;
  ageUnit: string;
  sex: string;
  description: string;
  descriptors: Descriptor[];
}

function emptyDraft(defaultType: string): Draft {
  return { name: "", type: defaultType, ageValue: "", ageUnit: "years", sex: "Unknown", description: "", descriptors: [] };
}

function draftFromAnimal(animal: AdoptableAnimal): Draft {
  return {
    name: animal.name,
    type: animal.type,
    ageValue: animal.age ? String(animal.age.value) : "",
    ageUnit: animal.age ? animal.age.unit : "years",
    sex: animal.sex,
    description: animal.description || "",
    descriptors: animal.customDescriptors || [],
  };
}

function draftToPayload(draft: Draft) {
  const ageValue = parseFloat(draft.ageValue);
  return {
    name: draft.name,
    type: draft.type,
    age: Number.isFinite(ageValue) ? { value: ageValue, unit: draft.ageUnit } : null,
    sex: draft.sex,
    description: draft.description,
    customDescriptors: draft.descriptors.filter((d) => d.label.trim()),
  };
}

function AnimalFields({ draft, setDraft, types }: { draft: Draft; setDraft: (d: Draft) => void; types: string[] }) {
  const updateDescriptor = (idx: number, field: "label" | "value", value: string) => {
    const next = [...draft.descriptors];
    next[idx] = { ...next[idx], [field]: value };
    setDraft({ ...draft, descriptors: next });
  };

  const addDescriptor = () => setDraft({ ...draft, descriptors: [...draft.descriptors, { label: "", value: "" }] });
  const removeDescriptor = (idx: number) => setDraft({ ...draft, descriptors: draft.descriptors.filter((_, i) => i !== idx) });

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Name</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Type</label>
        <select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
        >
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Age</label>
          <input
            type="number"
            min={0}
            step="0.5"
            value={draft.ageValue}
            onChange={(e) => setDraft({ ...draft, ageValue: e.target.value })}
            placeholder="e.g. 2"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Unit</label>
          <select
            value={draft.ageUnit}
            onChange={(e) => setDraft({ ...draft, ageUnit: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
          >
            {AGE_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Sex</label>
          <select
            value={draft.sex}
            onChange={(e) => setDraft({ ...draft, sex: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", background: "#fff" }}
          >
            {SEX_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Description</label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
          Additional Details <span style={{ fontWeight: 400 }}>(breed, weight, anything else worth noting)</span>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {draft.descriptors.map((d, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={d.label}
                onChange={(e) => updateDescriptor(idx, "label", e.target.value)}
                placeholder="Breed"
                style={{ width: 130, boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
              <input
                value={d.value}
                onChange={(e) => updateDescriptor(idx, "value", e.target.value)}
                placeholder="Labrador"
                style={{ flex: 1, boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
              />
              <button
                onClick={() => removeDescriptor(idx)}
                style={{ width: 28, height: 28, borderRadius: 6, border: "1.5px solid #FECACA", background: "#fff", color: "#DC2626", fontSize: 14, cursor: "pointer", flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addDescriptor}
            style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 6, border: "1.5px dashed #E8D5C4", background: "#FAFAF8", color: "#E77A2D", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            + Add Detail
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminAdoptableAnimalsPage() {
  const [animals, setAnimals] = useState<AdoptableAnimal[]>([]);
  const [types, setTypes] = useState<string[]>(["Dog"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft("Dog"));
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [editDrafts, setEditDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState<string | null>(null);
  const [settingThumbnail, setSettingThumbnail] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<AdoptableAnimal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingRemovePhoto, setPendingRemovePhoto] = useState<{ animalId: string; photoUrl: string } | null>(null);

  const fetchAnimals = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/adoptable-animals`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load animals");
      setAnimals(data.animals || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load animals");
    } finally {
      setLoading(false);
    }
  };

  const fetchTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/farm-animals`);
      const data = await res.json();
      const farmTypeNames: string[] = (data.animals || [])
        .map((a: FarmAnimalType) => a.name)
        .filter((name: string) => name !== "Ranch Dogs"); // permanent residents, not adoptable
      // "Dog" is a fixed extra option, distinct from "Ranch Dogs" (the
      // permanent-resident farm type) -- adoptable dogs are a different
      // population entirely.
      setTypes([...farmTypeNames, "Dog"]);
    } catch (err) {
      console.error("Failed to load farm animal types:", err);
    }
  };

  useEffect(() => {
    fetchAnimals();
    fetchTypes();
  }, []);

  const submitAdd = async () => {
    if (!addDraft.name.trim()) return setAddError("Name is required");
    if (!addFile) return setAddError("At least one photo is required");

    setAddSubmitting(true);
    setAddError("");
    try {
      const predictedId = slugify(addDraft.name);
      const seedPhotoUrl = await uploadPhoto(predictedId, addFile);

      const res = await fetch(`${API_URL}/admin/adoptable-animals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draftToPayload(addDraft), seedPhotoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add animal");

      setAnimals((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddModal(false);
      setAddDraft(emptyDraft(types[0] || "Dog"));
      setAddFile(null);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add animal");
    } finally {
      setAddSubmitting(false);
    }
  };

  const saveEdit = async (animalId: string) => {
    const draft = editDrafts[animalId];
    if (!draft) return;

    setSavingId(animalId);
    try {
      const res = await fetch(`${API_URL}/admin/adoptable-animals/${animalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAnimals((prev) => prev.map((a) => (a.animalId === animalId ? data : a)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleAddPhoto = async (animalId: string, file: File) => {
    setUploadingPhotoFor(animalId);
    try {
      const cdnUrl = await uploadPhoto(animalId, file);
      const res = await fetch(`${API_URL}/admin/adoptable-animals/${animalId}/photos`, {
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

  const confirmRemovePhoto = async () => {
    if (!pendingRemovePhoto) return;
    const { animalId, photoUrl } = pendingRemovePhoto;
    setRemovingPhoto(photoUrl);
    try {
      const res = await fetch(`${API_URL}/admin/adoptable-animals/${animalId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove photo");
      setAnimals((prev) => prev.map((a) => (a.animalId === animalId ? data : a)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setRemovingPhoto(null);
      setPendingRemovePhoto(null);
    }
  };

  const handleSetThumbnail = async (animalId: string, photoUrl: string) => {
    setSettingThumbnail(photoUrl);
    try {
      const res = await fetch(`${API_URL}/admin/adoptable-animals/${animalId}/thumbnail`, {
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
      setSettingThumbnail(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/admin/adoptable-animals/${pendingDelete.animalId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setAnimals((prev) => prev.filter((a) => a.animalId !== pendingDelete.animalId));
      setExpandedId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>Adoptable Animals</h1>
        <button
          onClick={() => { setAddDraft(emptyDraft(types[0] || "Dog")); setShowAddModal(true); }}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Add Animal
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
          const draft = editDrafts[animal.animalId] ?? draftFromAnimal(animal);

          return (
            <div key={animal.animalId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : animal.animalId);
                  setEditDrafts((prev) => ({ ...prev, [animal.animalId]: draftFromAnimal(animal) }));
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
                    {animal.type} · {animal.sex}
                    {animal.age && ` · ${animal.age.value} ${animal.age.unit}`}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ marginTop: 16 }}>
                    <AnimalFields draft={draft} setDraft={(d) => setEditDrafts((prev) => ({ ...prev, [animal.animalId]: d }))} types={types} />
                    <button
                      onClick={() => saveEdit(animal.animalId)}
                      disabled={savingId === animal.animalId}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "none", background: "#111111", color: "#fff",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingId === animal.animalId ? 0.6 : 1,
                      }}
                    >
                      {savingId === animal.animalId ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Photos
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                      {(animal.photos || []).map((photo) => {
                        const isThumbnail = photo === animal.thumbnailUrl;
                        return (
                          <div key={photo} style={{ position: "relative", width: 80, height: 80 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo}
                              alt=""
                              onClick={() => !isThumbnail && handleSetThumbnail(animal.animalId, photo)}
                              style={{
                                width: "100%", height: "100%", objectFit: "cover", borderRadius: 8,
                                border: isThumbnail ? "2px solid #E77A2D" : "1.5px solid #E8E2DC",
                                cursor: isThumbnail ? "default" : "pointer",
                                opacity: settingThumbnail === photo ? 0.5 : 1,
                              }}
                              title={isThumbnail ? "Main photo" : "Click to set as main photo"}
                            />
                            {isThumbnail && (
                              <span style={{ position: "absolute", top: -6, left: -6, background: "#E77A2D", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>
                                ★
                              </span>
                            )}
                            <button
                              onClick={() => setPendingRemovePhoto({ animalId: animal.animalId, photoUrl: photo })}
                              disabled={removingPhoto === photo}
                              style={{
                                position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                                border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 700,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                              }}
                              title="Remove photo"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 8,
                      border: "1.5px solid #E8D5C4", cursor: uploadingPhotoFor === animal.animalId ? "default" : "pointer",
                      background: "#FAFAF8", fontSize: 13, color: "#E77A2D", fontWeight: 700,
                    }}>
                      <input
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
                      {uploadingPhotoFor === animal.animalId ? "Uploading…" : "Add Photo"}
                    </label>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                    <button
                      onClick={() => setPendingDelete(animal)}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Remove this animal
                    </button>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 16 }}>Add Adoptable Animal</div>

            <AnimalFields draft={addDraft} setDraft={setAddDraft} types={types} />

            <div style={{ marginBottom: 16, marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>
                Photo <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "2px dashed #E8D5C4",
                borderRadius: 10, padding: "16px", cursor: "pointer", background: addFile ? "#FEF3EB" : "#FAFAF8",
                fontSize: 13, color: "#E77A2D", fontWeight: 700,
              }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                />
                {addFile ? `✓ ${addFile.name}` : "Click to choose a photo"}
              </label>
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>More photos can be added after creating the listing.</p>
            </div>

            {addError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{addError}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowAddModal(false); setAddDraft(emptyDraft(types[0] || "Dog")); setAddFile(null); setAddError(""); }}
                disabled={addSubmitting}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={submitAdd}
                disabled={addSubmitting}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: addSubmitting ? "default" : "pointer", fontFamily: "inherit", opacity: addSubmitting ? 0.6 : 1,
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
              This removes them from the adoption listings and permanently deletes all {(pendingDelete.photos || []).length} of their photos. This can&apos;t be undone.
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
                  padding: "10px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: deleting ? "default" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRemovePhoto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 8 }}>Remove this photo?</div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              This permanently deletes the photo. If it&apos;s currently the main photo, another one will take its place automatically.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPendingRemovePhoto(null)}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1.5px solid #E8E2DC", background: "#fff", color: "#6B7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemovePhoto}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
