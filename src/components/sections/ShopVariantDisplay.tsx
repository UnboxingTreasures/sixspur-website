'use client';

import { useState } from 'react';
import ProductGallery from './ProductGallery';
import MultiVariantPicker from './MultiVariantPicker';

interface VariantDimension {
  label: string;
  values: string[];
}

interface Combination {
  values: Record<string, string>;
  stock: number;
}

interface ShopVariantDisplayProps {
  photos: string[]; // the product's default/general photo set
  name: string;
  category: string;
  price: number;
  description: string;
  hasVariants: boolean;
  variantDimensions?: VariantDimension[];
  combinations?: Combination[];
  variantPhotos?: Record<string, string[]>; // keyed by dimensions[0]'s values
  soldOut: boolean;
}

// Holds the FULL two-column product layout (gallery on the left, details
// + picker on the right) as one client component. Selecting the FIRST
// dimension's value (e.g. Color) swaps the entire gallery to that
// value's own photos -- matches how most real stores work, where color
// changes the photo but size usually doesn't. Falls back to the
// product's default photos when nothing's selected yet, or the selected
// value has no dedicated photos.
export default function ShopVariantDisplay({ photos, name, category, price, description, hasVariants, variantDimensions, combinations, variantPhotos, soldOut }: ShopVariantDisplayProps) {
  const [firstDimPhotos, setFirstDimPhotos] = useState<string[] | null>(null);

  const activePhotos = firstDimPhotos && firstDimPhotos.length > 0 ? firstDimPhotos : photos;

  const handleFirstDimensionSelect = (value: string) => {
    const assigned = variantPhotos?.[value];
    setFirstDimPhotos(assigned && assigned.length > 0 ? assigned : null);
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
