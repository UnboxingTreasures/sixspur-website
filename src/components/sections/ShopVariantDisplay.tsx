'use client';

import { useState } from 'react';
import ProductGallery from './ProductGallery';
import SizePicker from './SizePicker';

interface VariantEntry {
  value: string;
  stock: number;
  photoUrls?: string[];
}

interface ShopVariantDisplayProps {
  photos: string[]; // the product's default/general photo set
  name: string;
  category: string;
  price: number;
  description: string;
  hasVariants: boolean;
  variantLabel?: string;
  variants?: VariantEntry[];
  soldOut: boolean;
}

// Holds the FULL two-column product layout (gallery on the left, details
// + picker on the right) as one client component, so selecting a variant
// can swap the ENTIRE gallery -- main image and thumbnail strip both --
// to that variant's own photos, similar to how Amazon switches the whole
// image set when you pick a color. Falls back to the product's default
// photos when no variant is selected, or when the selected one has no
// dedicated photos of its own.
export default function ShopVariantDisplay({ photos, name, category, price, description, hasVariants, variantLabel, variants, soldOut }: ShopVariantDisplayProps) {
  const [selectedVariant, setSelectedVariant] = useState<VariantEntry | null>(null);

  const activePhotos = selectedVariant?.photoUrls && selectedVariant.photoUrls.length > 0
    ? selectedVariant.photoUrls
    : photos;

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

        {hasVariants && variants && variants.length > 0 && (
          <div className="mb-6">
            <SizePicker
              label={variantLabel || 'Options'}
              variants={variants}
              onSelect={(variant) => setSelectedVariant(variant)}
            />
          </div>
        )}

        {soldOut && (
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Currently sold out
          </p>
        )}

        <p className="text-sm text-gray-500 mt-8">
          Every purchase supports the animals at Six Spur Ranch and Rescue.
        </p>
      </div>
    </div>
  );
}
