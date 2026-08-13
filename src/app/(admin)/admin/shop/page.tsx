"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface VariantEntry {
  value: string;
  stock: number;
  photoUrls?: string[];
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
  variantLabel?: string;
  variants?: VariantEntry[];
  stock?: number;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uploadPhoto(itemId: string, file: File): Promise<string> {
  const presignRes = await fetch(`${API_URL}/admin/shop/${itemId}/photos/presign`, {
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

// Editable draft shape used for both the Add modal and inline edit forms.
interface Draft {
  name: string;
  description: string;
  price: string;
  category: string;
  hasVariants: boolean;
  variantLabel: string; // admin-defined, e.g. "Size" or "Style"
  variantStocks: Record<string, string>; // value -> stock string, admin adds/removes entries freely
  variantPhotoSets: Record<string, string[]>; // value -> photo URLs for that variant's own gallery, only settable once the product has a photo pool (edit view, not creation)
  stock: string; // used when !hasVariants
}

function emptyDraft(): Draft {
  return { name: "", description: "", price: "", category: "", hasVariants: false, variantLabel: "", variantStocks: {}, variantPhotoSets: {}, stock: "0" };
}

function draftFromItem(item: ShopItem): Draft {
  const variantStocks: Record<string, string> = {};
  const variantPhotoSets: Record<string, string[]> = {};
  if (item.hasVariants && item.variants) {
    for (const v of item.variants) {
      variantStocks[v.value] = String(v.stock);
      if (v.photoUrls && v.photoUrls.length > 0) variantPhotoSets[v.value] = v.photoUrls;
    }
  }
  return {
    name: item.name,
    description: item.description || "",
    price: String(item.price),
    category: item.category,
    hasVariants: item.hasVariants,
    variantLabel: item.variantLabel || "",
    variantStocks,
    variantPhotoSets,
    stock: String(item.stock ?? 0),
  };
}

// Fully custom now -- admin types a dimension label (e.g. "Size" or
// "Style") and adds whatever option values they want, each with its own
// stock. Replaces the old fixed S/M/L/XL/2XL/3XL checkbox list -- there's
// no longer a known set of values to check off, so this is an
// add-your-own-row editor instead.
function VariantEditor({ draft, setDraft, availablePhotos }: { draft: Draft; setDraft: (d: Draft) => void; availablePhotos?: string[] }) {
  const [newValue, setNewValue] = useState("");
  const [managingPhotosFor, setManagingPhotosFor] = useState<string | null>(null);

  const addValue = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (trimmed in draft.variantStocks) return; // already exists, no duplicate
    setDraft({ ...draft, variantStocks: { ...draft.variantStocks, [trimmed]: "0" } });
    setNewValue("");
  };

  const removeValue = (value: string) => {
    const nextStocks = { ...draft.variantStocks };
    delete nextStocks[value];
    const nextPhotoSets = { ...draft.variantPhotoSets };
    delete nextPhotoSets[value];
    setDraft({ ...draft, variantStocks: nextStocks, variantPhotoSets: nextPhotoSets });
  };

  const togglePhoto = (value: string, photoUrl: string) => {
    const current = draft.variantPhotoSets[value] || [];
    const next = current.includes(photoUrl) ? current.filter((p) => p !== photoUrl) : [...current, photoUrl];
    setDraft({ ...draft, variantPhotoSets: { ...draft.variantPhotoSets, [value]: next } });
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 4 }}>
          Variant Label
        </label>
        <input
          value={draft.variantLabel}
          onChange={(e) => setDraft({ ...draft, variantLabel: e.target.value })}
          placeholder='e.g. "Size" or "Style"'
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
        />
      </div>

      <label style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", display: "block", marginBottom: 6 }}>
        Options &amp; Stock
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {Object.entries(draft.variantStocks).map(([value, stock]) => {
          const photoCount = (draft.variantPhotoSets[value] || []).length;
          return (
            <div key={value}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ minWidth: 90, fontSize: 13, fontWeight: 700, color: "#111111" }}>{value}</span>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setDraft({ ...draft, variantStocks: { ...draft.variantStocks, [value]: e.target.value } })}
                  placeholder="Stock"
                  style={{ width: 90, padding: "6px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
                />
                <button
                  onClick={() => removeValue(value)}
                  style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                  title={`Remove ${value}`}
                >
                  ×
                </button>

                {/* Photo assignment -- only possible once a real photo
                    pool exists (edit view of an existing product), since
                    a brand-new product only has one seed photo. Each
                    variant can have its OWN gallery (multiple photos),
                    shown when that option is selected on the site --
                    falls back to the product's default photos when a
                    variant has none of its own. */}
                {availablePhotos && availablePhotos.length > 0 && (
                  <button
                    onClick={() => setManagingPhotosFor(managingPhotosFor === value ? null : value)}
                    style={{
                      padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      border: photoCount > 0 ? "1.5px solid #E77A2D" : "1.5px dashed #E8D5C4",
                      background: photoCount > 0 ? "#FEF3EB" : "#FAFAF8",
                      color: photoCount > 0 ? "#E77A2D" : "#9CA3AF",
                    }}
                  >
                    {photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? "s" : ""}` : "+ Photos"}
                  </button>
                )}
              </div>

              {managingPhotosFor === value && availablePhotos && (
                <div style={{ marginTop: 6, marginLeft: 100, padding: 10, background: "#FAFAF8", borderRadius: 8, border: "1px solid #E8E2DC" }}>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8 }}>
                    Click to toggle which photos show when a customer picks &quot;{value}&quot;. None selected = show the product&apos;s default photos.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {availablePhotos.map((photo) => {
                      const included = (draft.variantPhotoSets[value] || []).includes(photo);
                      return (
                        <div key={photo} style={{ position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo}
                            alt=""
                            onClick={() => togglePhoto(value, photo)}
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

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addValue(); } }}
          placeholder={draft.variantLabel ? `Add a ${draft.variantLabel.toLowerCase()}...` : "Add a value..."}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1.5px solid #E8E2DC", fontSize: 13, fontFamily: "inherit" }}
        />
        <button
          onClick={addValue}
          type="button"
          style={{ padding: "8px 14px", borderRadius: 6, border: "1.5px solid #E77A2D", background: "#fff", color: "#E77A2D", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Add
        </button>
      </div>
      {(!availablePhotos || availablePhotos.length === 0) && (
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
          Add more photos below, then come back here to assign a gallery to each option.
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
          This product comes in different options (size, style, etc.)
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
    payload.variantLabel = draft.variantLabel;
    payload.variants = Object.entries(draft.variantStocks).map(([value, stock]) => ({
      value,
      stock: parseInt(stock, 10) || 0,
      ...(draft.variantPhotoSets[value] && draft.variantPhotoSets[value].length > 0 ? { photoUrls: draft.variantPhotoSets[value] } : {}),
    }));
  } else {
    payload.stock = parseInt(draft.stock, 10) || 0;
  }
  return payload;
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
      const res = await fetch(`${API_URL}/admin/shop`);
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

  const submitAdd = async () => {
    if (!addDraft.name.trim()) return setAddError("Name is required");
    if (!addFile) return setAddError("At least one photo is required");
    if (addDraft.hasVariants && !addDraft.variantLabel.trim()) {
      return setAddError('Give your variant a label, like "Size" or "Style"');
    }
    if (addDraft.hasVariants && Object.keys(addDraft.variantStocks).length === 0) {
      return setAddError('Add at least one option, or turn off "comes in different options"');
    }

    setAddSubmitting(true);
    setAddError("");
    try {
      const predictedId = slugify(addDraft.name);
      const seedPhotoUrl = await uploadPhoto(predictedId, addFile);

      const res = await fetch(`${API_URL}/admin/shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    if (draft.hasVariants && !draft.variantLabel.trim()) {
      alert('Give your variant a label, like "Size" or "Style"');
      return;
    }
    if (draft.hasVariants && Object.keys(draft.variantStocks).length === 0) {
      alert('Add at least one option, or turn off "comes in different options"');
      return;
    }

    setSavingId(itemId);
    try {
      const res = await fetch(`${API_URL}/admin/shop/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API_URL}/admin/shop/${itemId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API_URL}/admin/shop/${itemId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API_URL}/admin/shop/${itemId}/thumbnail`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API_URL}/admin/shop/${pendingDelete.itemId}`, { method: "DELETE" });
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
                    {item.hasVariants && <span> · {(item.photos || []).length} photo{(item.photos || []).length !== 1 ? "s" : ""}, {item.variantLabel}</span>}
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
