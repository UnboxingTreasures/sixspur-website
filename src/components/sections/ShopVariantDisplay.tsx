'use client';

import { useState } from 'react';
import ProductGallery from './ProductGallery';
import MultiVariantPicker from './MultiVariantPicker';
import { useCart } from '@/context/CartContext';

interface VariantDimension {
  label: string;
  values: string[];
}

interface Combination {
  values: Record<string, string>;
  stock: number;
}

interface ShopVariantDisplayProps {
  itemId: string; // NEW -- needed to add this product to the cart
  photos: string[]; // the product's default/general photo set
  name: string;
  category: string;
  price: number;
  description: string;
  hasVariants: boolean;
  variantDimensions?: VariantDimension[];
  combinations?: Combination[];
  variantPhotos?: Record<string, string[]>; // keyed by dimensions[0]'s values
  stock?: number; // NEW -- only present/relevant for non-variant products
  soldOut: boolean;
}

// Holds the FULL two-column product layout (gallery on the left, details
// + picker on the right) as one client component. Selecting the FIRST
// dimension's value (e.g. Color) swaps the entire gallery to that
// value's own photos -- matches how most real stores work, where color
// changes the photo but size usually doesn't. Falls back to the
// product's default photos when nothing's selected yet, or the selected
// value has no dedicated photos.
export default function ShopVariantDisplay({ itemId, photos, name, category, price, description, hasVariants, variantDimensions, combinations, variantPhotos, stock, soldOut }: ShopVariantDisplayProps) {
  const { addItem } = useCart();
  const [firstDimPhotos, setFirstDimPhotos] = useState<string[] | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<Combination | null>(null);
  const [selectedComboIndex, setSelectedComboIndex] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const activePhotos = firstDimPhotos && firstDimPhotos.length > 0 ? firstDimPhotos : photos;

  const handleFirstDimensionSelect = (value: string) => {
    const assigned = variantPhotos?.[value];
    setFirstDimPhotos(assigned && assigned.length > 0 ? assigned : null);
  };

  const handleSelectionChange = (combo: Combination | null, comboIndex: number | null) => {
    setSelectedCombo(combo);
    setSelectedComboIndex(comboIndex);
    setQuantity(1); // reset quantity whenever the variant selection changes, avoids carrying a quantity that exceeds the new selection's stock
  };

  // For a variant product: needs a fully-resolved, in-stock combination.
  // For a simple product: just needs stock > 0.
  const availableStock = hasVariants ? (selectedCombo?.stock ?? 0) : (stock ?? 0);
  const canAddToCart = hasVariants
    ? Boolean(selectedCombo && selectedCombo.stock > 0)
    : availableStock > 0;

  const handleAddToCart = () => {
    if (!canAddToCart) return;

    const thumbnailUrl = activePhotos[0] || photos[0];
    const variantLabel = hasVariants && selectedCombo
      ? Object.values(selectedCombo.values).join(' / ')
      : undefined;

    addItem(
      {
        itemId,
        comboIndex: hasVariants ? selectedComboIndex ?? undefined : undefined,
        name,
        price,
        thumbnailUrl,
        variantLabel,
        maxStock: availableStock,
      },
      quantity,
    );

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
      <ProductGallery photos={activePhotos} name={name} />

      <div>
        <p className="eyebrow mb-2">{category}</p>
        <h1 className="text-3xl font-bold text-spur-black mb-3">{name}</h1>
        <p className="text-2xl font-bold text-spur-orange mb-6">${price.toFixed(2)}</p>

        {description && (
          <p className="text-gray-600 leading-relaxed mb-6">{description}</p>
        )}

        {hasVariants && variantDimensions && variantDimensions.length > 0 && combinations && (
          <div className="mb-6">
            <MultiVariantPicker
              dimensions={variantDimensions}
              combinations={combinations}
              onFirstDimensionSelect={handleFirstDimensionSelect}
              onSelectionChange={handleSelectionChange}
            />
          </div>
        )}

        {soldOut ? (
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Currently sold out
          </p>
        ) : (
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center border border-spur-tan-light rounded">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={!canAddToCart}
                className="px-3 py-2 text-lg font-bold text-spur-black disabled:opacity-30"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="px-4 py-2 min-w-[2.5rem] text-center font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                disabled={!canAddToCart || quantity >= availableStock}
                className="px-3 py-2 text-lg font-bold text-spur-black disabled:opacity-30"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="flex-1 bg-spur-orange text-white font-bold py-3 px-6 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {justAdded ? 'Added!' : hasVariants && !selectedCombo ? 'Select options' : 'Add to Cart'}
            </button>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-8">
          Every purchase supports the animals at Six Spur Ranch and Rescue.
        </p>
      </div>
    </div>
  );
}
