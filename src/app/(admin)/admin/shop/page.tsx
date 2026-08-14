"use client";

import { useState, useEffect } from "react";
import { getIdToken } from "@/lib/cognito";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface VariantDimension {
  label: string;
  values: string[];
}

interface Combination {
  values: Record<string, string>; // dimension label -> value
  stock: number;
}

interface ShopItem {
  itemId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photos: string[];
  thumbnailUrl: string;
  hasVariants: boolean;
  variantDimensions?: VariantDimension[];
  combinations?: Combination[];
  variantPhotos?: Record<string, string[]>; // keyed by dimension[0]'s value
  stock?: number;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getIdToken();
  if (!token) throw new Error("Not logged in");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

async function uploadPhoto(itemId: string, file: File): Promise<string> {
  const presignRes = await authedFetch(`/admin/shop/${itemId}/photos/presign`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || "Failed to get upload URL");

  // The actual S3 PUT uses the presigned URL itself as authorization --
  // no bearer token here, and none needed; adding one would break the
  // presigned signature.
  const uploadRes = await fetch(presignData.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!uploadRes.ok) throw new Error("Upload to S3 failed");

  return presignData.cdnUrl;
}

// ── Cartesian product helpers ────────────────────────────────────────────

interface DimensionDraft {
  label: string;
  values: string[];
}

function cartesianKeys(dimensions: DimensionDraft[]): string[] {
  if (dimensions.length === 0 || dimensions.some((d) => d.values.length === 0)) return [];
  return dimensions.reduce<string[]>((acc, dim) => {
    if (acc.length === 0) return dim.values.map((v) => v);
    const next: string[] = [];
    for (const prefix of acc) {
      for (const v of dim.values) next.push(`${prefix}|${v}`);
    }
    return next;
  }, []);
}

// Regenerates the combo-stock map whenever dimensions/values change,
// preserving stock numbers for combinations that still exist and
// defaulting new ones to "0". This is what makes "add a new size" or
// "add a new color" automatically create the right new stock rows
// without the admin having to manually re-enter everything.
function syncComboStocks(dimensions: DimensionDraft[], oldStocks: Record<string, string>): Record<string, string> {
  const keys = cartesianKeys(dimensions);
  const next: Record<string, string> = {};
  for (const key of keys) next[key] = oldStocks[key] ?? "0";
  return next;
}

// Editable draft shape used for both the Add modal and inline edit forms.
interface Draft {
  name: string;
  description: string;
  price: string;
  category: string;
  hasVariants: boolean;
  dimensions: DimensionDraft[];
  comboStocks: Record<string, string>; // key = dimension values joined by "|" in dimension order
  variantPhotos: Record<string, string[]>; // keyed by dimensions[0]'s values only
  stock: string; // used when !hasVariants
}

function emptyDraft(): Draft {
  return { name: "", description: "", price: "", category: "", hasVariants: false, dimensions: [], comboStocks: {}, variantPhotos: {}, stock: "0" };
}

function draftFromItem(item: ShopItem): Draft {
  const dimensions: DimensionDraft[] = item.hasVariants && item.variantDimensions
    ? item.variantDimensions.map((d) => ({ label: d.label, values: [...d.values] }))
    : [];
  const comboStocks: Record<string, string> = {};
  if (item.hasVariants && item.combinations && dimensions.length > 0) {
    for (const combo of item.combinations) {
      const key = dimensions.map((d) => combo.values[d.label]).join("|");
      comboStocks[key] = String(combo.stock);
    }
  }
  return {
    name: item.name,
    description: item.description || "",
    price: String(item.price),
    category: item.category,
    hasVariants: item.hasVariants,
    dimensions,
    comboStocks,
    variantPhotos: item.hasVariants && item.variantPhotos ? item.variantPhotos : {},
    stock: String(item.stock ?? 0),
  };
}

function draftToPayload(draft: Draft) {
  const price = parseFloat(draft.price);
  const payload: Record<string, unknown> = {
    name: draft.name,
    description: draft.description,
    price: Number.isFinite(price) ? price : 0,
    category: draft.category,
    hasVariants: draft.hasVariants,
  };
  if (draft.hasVariants) {
    payload.variantDimensions = draft.dimensions.map((d) => ({ label: d.label, values: d.values }));
    payload.combinations = Object.entries(draft.comboStocks).map(([key, stock]) => {
      const parts = key.split("|");
      const values: Record<string, string> = {};
      draft.dimensions.forEach((d, i) => { values[d.label] = parts[i]; });
      return { values, stock: parseInt(stock, 10) || 0 };
    });
    payload.variantPhotos = draft.variantPhotos;
  } else {
    payload.stock = parseInt(draft.stock, 10) || 0;
  }
  return payload;
}

// Manages one or more variant dimensions (Size, Color, etc.) and the
// auto-generated stock grid for every combination across all of them.
// Photos are only assignable on the FIRST dimension's values -- matches
// how most real stores work (picking a color changes the photo, picking
// a size usually doesn't), and keeps the photo UI from getting
// unmanageable as more dimensions get added.
function VariantEditor({ draft, setDraft, availablePhotos }: { draft: Draft; setDraft: (d: Draft) => void; availablePhotos?: string[] }) {
  const [newDimLabel, setNewDimLabel] = useState("");
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>({});
  const [managingPhotosFor, setManagingPhotosFor] = useState<string | null>(null);

  const applyDimensions = (nextDimensions: DimensionDraft[]) => {
    setDraft({ ...draft, dimensions: nextDimensions, comboStocks: syncComboStocks(nextDimensions, draft.comboStocks) });
  };

  const addDimension = () => {
    const label = newDimLabel.trim();
    if (!label) return;
    if (draft.dimensions.some((d) => d.label === label)) return;
    applyDimensions([...draft.dimensions, { label, values: [] }]);
    setNewDimLabel("");
  };

  const removeDimension = (index: number) => {
    const nextDimensions = draft.dimensions.filter((_, i) => i !== index);
    const nextComboStocks = syncComboStocks(nextDimensions, draft.comboStocks);
    // If the FIRST dimension (the photo dimension) was removed, its
    // photo assignments no longer mean anything -- clear them.
    const nextVariantPhotos = index === 0 ? {} : draft.variantPhotos;
    setDraft({ ...draft, dimensions: nextDimensions, comboStocks: nextComboStocks, variantPhotos: nextVariantPhotos });
  };

  const addValue = (dimIndex: number) => {
    const value = (newValueInputs[dimIndex] || "").trim();
    if (!value) return;
    if (draft.dimensions[dimIndex].values.includes(value)) return;
    const nextDimensions = draft.dimensions.map((d, i) => i === dimIndex ? { ...d, values: [...d.values, value] } : d);
    applyDimensions(nextDimensions);
    setNewValueInputs({ ...newValueInputs, [dimIndex]: "" });
  };

  const removeValue = (dimIndex: number, value: string) => {
    const nextDimensions = draft.dimensions.map((d, i) => i === dimIndex ? { ...d, values: d.values.filter((v) => v !== value) } : d);
    const nextComboStocks = syncComboStocks(nextDimensions, draft.comboStocks);
    let nextVariantPhotos = draft.variantPhotos;
    if (dimIndex === 0) {
      nextVariantPhotos = { ...draft.variantPhotos };
      delete nextVariantPhotos[value];
    }
    setDraft({ ...draft, dimensions: nextDimensions, comboStocks: nextComboStocks, variantPhotos: nextVariantPhotos });
  };

  const togglePhoto = (value: string, photoUrl: string) => {
    const current = draft.variantPhotos[value] || [];
    const next = current.includes(photoUrl) ? current.filter((p) => p !== photoUrl) : [...current, photoUrl];
    setDraft({ ...draft, variantPhotos: { ...draft.variantPhotos, [value]: next } });
  };

  const comboKeys = Object.keys(draft.comboStocks);

  return (
    <div>
      {/* Dimensions */}
      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
        Variant Dimensions
      </label>
      {draft.dimensions.map((dim, dimIndex) => (
        <div key={dimIndex} style={{ marginBottom: 12, padding: 10, background: "#FAFAF8", borderRadius: 8, border: "1px solid #E8E2DC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>{dim.label}</span>
            {dimIndex === 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#E77A2D", background: "#FEF3EB", padding: "2px 6px", borderRadius: 4 }}>
                PHOTO DIMENSION
              </span>
            )}
            <button
              onClick={() => removeDimension(dimIndex)}
              style={{ marginLeft: "auto", fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
            >
              Remove dimension
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {dim.values.map((value) => (
              <span key={value} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#111111" }}>
                {value}
                <button onClick={() => removeValue(dimIndex, value)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontWeight: 700, padding: 0, fontSize: 12 }}>×</button>
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={newValueInputs[dimIndex] || ""}
              onChange={(e) => setNewValueInputs({ ...newValueInputs, [dimIndex]: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addValue(dimIndex); } }}
              placeholder={`Add a ${dim.label.toLowerCase()}...`}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 12, fontFamily: "inherit" }}
            />
            <button onClick={() => addValue(dimIndex)} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid #E77A2D", background: "#fff", color: "#E77A2D", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              + Add
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newDimLabel}
          onChange={(e) => setNewDimLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDimension(); } }}
          placeholder='New dimension, e.g. "Size" or "Color"'
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
        />
        <button onClick={addDimension} style={{ padding: "8px 14px", borderRadius: 6, border: "1.5px solid #111111", background: "#fff", color: "#111111", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + Add Dimension
        </button>
      </div>

      {/* Combination stock + photos */}
      {comboKeys.length > 0 && (
        <>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
            Stock per Combination
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {comboKeys.map((key) => {
              const parts = key.split("|");
              const displayLabel = parts.join(" / ");
              const photoDimValue = parts[0]; // first dimension's value for this combo
              const photoCount = (draft.variantPhotos[photoDimValue] || []).length;
              const showPhotoControl = draft.dimensions.length > 0 && availablePhotos && availablePhotos.length > 0;
              return (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ minWidth: 140, fontSize: 13, fontWeight: 700, color: "#111111" }}>{displayLabel}</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.comboStocks[key]}
                      onChange={(e) => setDraft({ ...draft, comboStocks: { ...draft.comboStocks, [key]: e.target.value } })}
                      placeholder="Stock"
                      style={{ width: 90, padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                    />
                    {showPhotoControl && (
                      <button
                        onClick={() => setManagingPhotosFor(managingPhotosFor === photoDimValue ? null : photoDimValue)}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          border: photoCount > 0 ? "1.5px solid #E77A2D" : "1.5px dashed #E8D5C4",
                          background: photoCount > 0 ? "#FEF3EB" : "#FAFAF8",
                          color: photoCount > 0 ? "#E77A2D" : "#9CA3AF",
                        }}
                      >
                        {photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? "s" : ""} (${photoDimValue})` : `+ Photos for ${photoDimValue}`}
                      </button>
                    )}
                  </div>

                  {managingPhotosFor === photoDimValue && availablePhotos && (
                    <div style={{ marginTop: 6, marginLeft: 150, padding: 10, background: "#FAFAF8", borderRadius: 8, border: "1px solid #E8E2DC" }}>
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>
                        Photos for &quot;{photoDimValue}&quot; -- shown regardless of which other option (like size) is also picked.
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {availablePhotos.map((photo) => {
                          const included = (draft.variantPhotos[photoDimValue] || []).includes(photo);
                          return (
                            <div key={photo} style={{ position: "relative" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo}
                                alt=""
                                onClick={() => togglePhoto(photoDimValue, photo)}
                                style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: included ? "2px solid #E77A2D" : "1.5px solid #E8E2DC", cursor: "pointer", opacity: included ? 1 : 0.6 }}
                              />
                              {included && (
                                <span style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "#E77A2D", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  ✓
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {(!availablePhotos || availablePhotos.length === 0) && draft.dimensions.length > 0 && (
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
          Add more photos below, then come back here to assign a gallery to the first dimension&apos;s options.
        </p>
      )}
    </div>
  );
}

function ProductFields({ draft, setDraft, availablePhotos }: { draft: Draft; setDraft: (d: Draft) => void; availablePhotos?: string[] }) {
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

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Price ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Category</label>
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="e.g. shirts, hats, tumblers"
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
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#111111", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.hasVariants}
            onChange={(e) => setDraft({ ...draft, hasVariants: e.target.checked })}
          />
          This product comes in different options (size, color, style, etc.)
        </label>
      </div>

      {draft.hasVariants ? (
        <div style={{ marginBottom: 12 }}>
          <VariantEditor draft={draft} setDraft={setDraft} availablePhotos={availablePhotos} />
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>Stock</label>
          <input
            type="number"
            min={0}
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            style={{ width: 120, boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
          />
        </div>
      )}
    </>
  );
}

export default function AdminShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft());
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  const [editDrafts, setEditDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState<string | null>(null);
  const [settingThumbnail, setSettingThumbnail] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<ShopItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingRemovePhoto, setPendingRemovePhoto] = useState<{ itemId: string; photoUrl: string } | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/admin/shop");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      setItems(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const validateDraftVariants = (draft: Draft): string | null => {
    if (!draft.hasVariants) return null;
    if (draft.dimensions.length === 0) return 'Add at least one variant dimension, or turn off "comes in different options"';
    for (const dim of draft.dimensions) {
      if (dim.values.length === 0) return `Dimension "${dim.label}" needs at least one value`;
    }
    return null;
  };

  const submitAdd = async () => {
    if (!addDraft.name.trim()) return setAddError("Name is required");
    if (!addFile) return setAddError("At least one photo is required");
    const variantError = validateDraftVariants(addDraft);
    if (variantError) return setAddError(variantError);

    setAddSubmitting(true);
    setAddError("");
    try {
      const predictedId = slugify(addDraft.name);
      const seedPhotoUrl = await uploadPhoto(predictedId, addFile);

      const res = await authedFetch("/admin/shop", {
        method: "POST",
        body: JSON.stringify({ ...draftToPayload(addDraft), seedPhotoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product");

      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddModal(false);
      setAddDraft(emptyDraft());
      setAddFile(null);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setAddSubmitting(false);
    }
  };

  const saveEdit = async (itemId: string) => {
    const draft = editDrafts[itemId];
    if (!draft) return;
    const variantError = validateDraftVariants(draft);
    if (variantError) { alert(variantError); return; }

    setSavingId(itemId);
    try {
      const res = await authedFetch(`/admin/shop/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(draftToPayload(draft)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setItems((prev) => prev.map((i) => (i.itemId === itemId ? data : i)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleAddPhoto = async (itemId: string, file: File) => {
    setUploadingPhotoFor(itemId);
    try {
      const cdnUrl = await uploadPhoto(itemId, file);
      const res = await authedFetch(`/admin/shop/${itemId}/photos`, {
        method: "POST",
        body: JSON.stringify({ photoUrls: [cdnUrl] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add photo");
      setItems((prev) => prev.map((i) => (i.itemId === itemId ? data : i)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add photo");
    } finally {
      setUploadingPhotoFor(null);
    }
  };

  const confirmRemovePhoto = async () => {
    if (!pendingRemovePhoto) return;
    const { itemId, photoUrl } = pendingRemovePhoto;
    setRemovingPhoto(photoUrl);
    try {
      const res = await authedFetch(`/admin/shop/${itemId}/photos`, {
        method: "DELETE",
        body: JSON.stringify({ photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove photo");
      setItems((prev) => prev.map((i) => (i.itemId === itemId ? data : i)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setRemovingPhoto(null);
      setPendingRemovePhoto(null);
    }
  };

  const handleSetThumbnail = async (itemId: string, photoUrl: string) => {
    setSettingThumbnail(photoUrl);
    try {
      const res = await authedFetch(`/admin/shop/${itemId}/thumbnail`, {
        method: "PATCH",
        body: JSON.stringify({ photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set thumbnail");
      setItems((prev) => prev.map((i) => (i.itemId === itemId ? data : i)));
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
      const res = await authedFetch(`/admin/shop/${pendingDelete.itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setItems((prev) => prev.filter((i) => i.itemId !== pendingDelete.itemId));
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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111111" }}>Shop</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#E77A2D", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Add Product
        </button>
      </div>

      {loading && <p style={{ color: "#9CA3AF", fontSize: 14 }}>Loading…</p>}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => {
          const isExpanded = expandedId === item.itemId;
          const draft = editDrafts[item.itemId] ?? draftFromItem(item);
          const dimLabels = item.hasVariants && item.variantDimensions ? item.variantDimensions.map((d) => d.label).join(" + ") : "";

          return (
            <div key={item.itemId} style={{ background: "#fff", border: "1.5px solid #E8E2DC", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  setExpandedId(isExpanded ? null : item.itemId);
                  setEditDrafts((prev) => ({ ...prev, [item.itemId]: draftFromItem(item) }));
                }}
                style={{ padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailUrl}
                  alt={item.name}
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1.5px solid #E8E2DC", flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    ${item.price.toFixed(2)} · {item.category}
                    {item.hasVariants && <span> · {(item.photos || []).length} photo{(item.photos || []).length !== 1 ? "s" : ""}, {dimLabels}</span>}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #F0EBE5" }}>
                  <div style={{ marginTop: 16 }}>
                    <ProductFields draft={draft} setDraft={(d) => setEditDrafts((prev) => ({ ...prev, [item.itemId]: d }))} availablePhotos={item.photos} />
                    <button
                      onClick={() => saveEdit(item.itemId)}
                      disabled={savingId === item.itemId}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "none", background: "#111111", color: "#fff",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingId === item.itemId ? 0.6 : 1,
                      }}
                    >
                      {savingId === item.itemId ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Photos
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                      {(item.photos || []).map((photo) => {
                        const isThumbnail = photo === item.thumbnailUrl;
                        return (
                          <div key={photo} style={{ position: "relative", width: 80, height: 80 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo}
                              alt=""
                              onClick={() => !isThumbnail && handleSetThumbnail(item.itemId, photo)}
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
                              onClick={() => setPendingRemovePhoto({ itemId: item.itemId, photoUrl: photo })}
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
                      border: "1.5px solid #E8D5C4", cursor: uploadingPhotoFor === item.itemId ? "default" : "pointer",
                      background: "#FAFAF8", fontSize: 13, color: "#E77A2D", fontWeight: 700,
                    }}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        disabled={uploadingPhotoFor === item.itemId}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAddPhoto(item.itemId, file);
                          e.target.value = "";
                        }}
                      />
                      {uploadingPhotoFor === item.itemId ? "Uploading…" : "Add Photo"}
                    </label>
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #F0EBE5" }}>
                    <button
                      onClick={() => setPendingDelete(item)}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Delete this product
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", marginBottom: 16 }}>Add Product</div>

            <ProductFields draft={addDraft} setDraft={setAddDraft} />

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
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>More photos can be added after creating the product.</p>
            </div>

            {addError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12 }}>{addError}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowAddModal(false); setAddDraft(emptyDraft()); setAddFile(null); setAddError(""); }}
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
              Delete {pendingDelete.name}?
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
              This removes it from the shop and permanently deletes all {(pendingDelete.photos || []).length} of its photos. This can&apos;t be undone.
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
                {deleting ? "Deleting…" : "Delete"}
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
              This permanently deletes the photo. If it's currently the main photo, another one will take its place automatically.
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
