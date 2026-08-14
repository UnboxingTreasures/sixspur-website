'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';

// Flat shipping rate, matching lambda/orders/dynamo.js's SHIPPING_FLAT_RATE
// default. This is a client-side DISPLAY estimate only -- the real,
// authoritative total is always computed server-side at checkout
// (POST /orders/create-order), which is also where PayPal actually
// gets a total to quote. If the admin-editable shipping setting is ever
// built, this constant should be replaced with a live fetch of it so
// the displayed estimate can't drift from the real charge.
const DISPLAY_SHIPPING_ESTIMATE = 7.5;

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  const estimatedTotal = Math.round((subtotal + (items.length > 0 ? DISPLAY_SHIPPING_ESTIMATE : 0)) * 100) / 100;

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-white">
        <section className="py-24 px-6 text-center">
          <h1 className="text-3xl font-bold text-spur-black mb-4">Your Cart</h1>
          <p className="text-gray-500 mb-8">Your cart is empty.</p>
          <Link
            href="/shop"
            className="inline-block bg-spur-orange text-white font-bold py-3 px-8 rounded"
          >
            Browse the Shop
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-spur-black mb-8">Your Cart</h1>

          <div className="divide-y divide-spur-tan-light border-t border-b border-spur-tan-light mb-8">
            {items.map((line) => (
              <div key={`${line.itemId}-${line.comboIndex ?? 'none'}`} className="flex items-center gap-4 py-6">
                <div className="w-20 h-20 flex-shrink-0 bg-spur-tan-light rounded overflow-hidden">
                  {/* Plain img, not next/image -- these are small cart
                      thumbnails, no need for the optimization pipeline
                      here and it avoids needing this dynamic list of
                      variant photo URLs registered in next.config.ts's
                      remotePatterns (already covers the CloudFront
                      domain broadly, but keeping this simple). */}
                  <img src={line.thumbnailUrl} alt={line.name} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-spur-black truncate">{line.name}</p>
                  {line.variantLabel && (
                    <p className="text-sm text-gray-500">{line.variantLabel}</p>
                  )}
                  <p className="text-spur-orange font-semibold mt-1">${line.price.toFixed(2)}</p>
                </div>

                <div className="flex items-center border border-spur-tan-light rounded">
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.itemId, line.comboIndex, line.quantity - 1)}
                    disabled={line.quantity <= 1}
                    className="px-2.5 py-1.5 text-base font-bold text-spur-black disabled:opacity-30"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="px-3 py-1.5 min-w-[2rem] text-center font-semibold text-sm">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.itemId, line.comboIndex, line.quantity + 1)}
                    disabled={line.quantity >= line.maxStock}
                    className="px-2.5 py-1.5 text-base font-bold text-spur-black disabled:opacity-30"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <p className="w-20 text-right font-semibold text-spur-black">
                  ${(line.price * line.quantity).toFixed(2)}
                </p>

                <button
                  type="button"
                  onClick={() => removeItem(line.itemId, line.comboIndex)}
                  className="text-gray-600 hover:text-red-600 underline text-sm font-semibold"
                  aria-label={`Remove ${line.name} from cart`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="max-w-sm ml-auto space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping (estimated)</span>
              <span>${DISPLAY_SHIPPING_ESTIMATE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-spur-black pt-2 border-t border-spur-tan-light">
              <span>Total</span>
              <span>${estimatedTotal.toFixed(2)}</span>
            </div>

            <Link
              href="/checkout"
              className="block w-full bg-spur-orange text-white font-bold py-3 rounded mt-4 text-center"
            >
              Checkout
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
