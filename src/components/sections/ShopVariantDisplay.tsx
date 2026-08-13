'use client';

import { useState } from 'react';
import ProductGallery from './ProductGallery';
import SizePicker from './SizePicker';

interface VariantEntry {
  value: string;
  stock: number;
  photoUrl?: string;
}

interface ShopVariantDisplayProps {
  photos: string[];
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
// with a photoUrl can jump the gallery even though the two pieces sit in
// different grid columns, not next to each other. Everything else about
// the layout is unchanged from before -- this just wraps what page.tsx
// used to render inline, so state can be shared between the two halves.
export default function ShopVariantDisplay({ photos, name, category, price, description, hasVariants, variantLabel, variants, soldOut }: ShopVariantDisplayProps) {
  const [forcePhoto, setForcePhoto] = useState<string | undefined>(undefined);

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
      <ProductGallery photos={photos} name={name} forcePhoto={forcePhoto} />

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
              onSelect={(variant) => {
                if (variant.photoUrl) setForcePhoto(variant.photoUrl);
              }}
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
