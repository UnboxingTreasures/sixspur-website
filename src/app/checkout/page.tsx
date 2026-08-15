'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getIdToken } from '@/lib/cognito';
import { useCart } from '@/context/CartContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const SHIPPING_FALLBACK = 7.5; // shown ONLY until the real rate loads, matches the Lambda's own fallback default

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => void };
    };
  }
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

const EMPTY_ADDRESS: ShippingAddress = { name: '', line1: '', line2: '', city: '', state: '', zip: '' };

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [email, setEmail] = useState('');
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [shippingRate, setShippingRate] = useState(SHIPPING_FALLBACK);
  const [showPayPal, setShowPayPal] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | 'out_of_stock' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedItemIds, setFailedItemIds] = useState<string[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState<number | null>(null);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  // create-order returns BOTH a paypalOrderId (for the PayPal buttons)
  // and our own orderId (needed separately for capture-order). PayPal's
  // API only gives onApprove the paypalOrderId, so this ref bridges the
  // two across the create -> approve round trip.
  const ourOrderIdRef = useRef<string | null>(null);

  const isFormValid = email.trim() && address.line1.trim() && address.city.trim() && address.state.trim() && address.zip.trim();

  // Live shipping rate, fetched from the same admin-editable setting
  // the server uses to compute the real total at create-order time.
  useEffect(() => {
    fetch(`${API_URL}/shop-settings`)
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.flatRate === 'number') setShippingRate(data.flatRate);
      })
      .catch(() => {
        // Silently keep the fallback -- checkout still works fine off
        // the server's own authoritative total either way.
      });
  }, []);

  const loadPayPalScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.paypal) {
        scriptLoadedRef.current = true;
        return resolve();
      }
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PayPal'));
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    if (!showPayPal || !paypalContainerRef.current || !window.paypal) return;

    paypalContainerRef.current.innerHTML = '';

    window.paypal.Buttons({
      createOrder: async () => {
        // Optional -- unlike /donate, checkout never forces a login
        // redirect. If a token exists it's sent along so the order ties
        // to the donor's account; if not, it's a normal guest order.
        const token = await getIdToken();

        const res = await fetch(`${API_URL}/orders/create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            cartItems: items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              comboIndex: line.comboIndex,
            })),
            shippingAddress: address,
            email,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409 && data.failedItemIds) {
            setFailedItemIds(data.failedItemIds);
            setResult('out_of_stock');
          } else {
            setErrorMessage(data.error || 'Could not start checkout.');
            setResult('error');
          }
          setShowPayPal(false);
          throw new Error(data.error || 'Checkout failed');
        }

        ourOrderIdRef.current = data.orderId;
        setConfirmedTotal(data.total);
        return data.paypalOrderId;
      },
      onApprove: async () => {
        const token = await getIdToken();
        try {
          const res = await fetch(`${API_URL}/orders/capture-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ orderId: ourOrderIdRef.current }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to confirm your order');

          clearCart();
          setResult('success');
          setShowPayPal(false);
        } catch (err: unknown) {
          setErrorMessage(err instanceof Error ? err.message : 'Something went wrong confirming your order.');
          setResult('error');
        }
      },
      onError: () => {
        setErrorMessage('PayPal encountered an error. Please try again.');
        setResult('error');
      },
      onCancel: () => {
        setShowPayPal(false);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).render(paypalContainerRef.current);
  }, [showPayPal]);

  const handleProceedToPayment = async () => {
    if (!isFormValid) return;
    setResult(null);
    setErrorMessage('');
    setFailedItemIds([]);
    setPreparing(true);
    try {
      await loadPayPalScript();
      setShowPayPal(true);
    } catch {
      setErrorMessage('Could not load PayPal. Please refresh and try again.');
      setResult('error');
    } finally {
      setPreparing(false);
    }
  };

  if (items.length === 0 && result !== 'success') {
    return (
      <main className="min-h-screen bg-white">
        <section className="py-24 px-6 text-center">
          <h1 className="text-3xl font-bold text-spur-black mb-4">Checkout</h1>
          <p className="text-gray-500 mb-8">Your cart is empty.</p>
          <Link href="/shop" className="inline-block bg-spur-orange text-white font-bold py-3 px-8 rounded">
            Browse the Shop
          </Link>
        </section>
      </main>
    );
  }

  if (result === 'success') {
    return (
      <main className="min-h-screen bg-white">
        <section className="py-24 px-6 text-center max-w-lg mx-auto">
          <h1 className="text-3xl font-bold text-spur-black mb-4">Thank you!</h1>
          <p className="text-gray-600 mb-2">
            Your order{confirmedTotal ? ` (total $${confirmedTotal.toFixed(2)})` : ''} was placed successfully.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            A confirmation has been sent to {email}. Every purchase supports the animals at Six Spur Ranch and Rescue.
          </p>
          <Link href="/shop" className="inline-block bg-spur-orange text-white font-bold py-3 px-8 rounded">
            Continue Shopping
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">

          {/* Shipping + payment */}
          <div className="md:col-span-3">
            <h1 className="text-3xl font-bold text-spur-black mb-8">Checkout</h1>

            {result === 'out_of_stock' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-6">
                Sorry, some items sold out while you were checking out{failedItemIds.length > 0 ? `: ${failedItemIds.join(', ')}` : ''}.{' '}
                <Link href="/cart" className="font-semibold underline">Return to your cart</Link> to update it.
              </div>
            )}
            {result === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-6">
                {errorMessage || 'Something went wrong. Please try again.'}
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-sm font-semibold text-spur-black mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-spur-black mb-1">Full Name</label>
                <input
                  type="text"
                  value={address.name}
                  onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-spur-black mb-1">Address</label>
                <input
                  type="text"
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  placeholder="Street address"
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange mb-2"
                />
                <input
                  type="text"
                  value={address.line2}
                  onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                  placeholder="Apt, suite, etc. (optional)"
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                  placeholder="City"
                  className="col-span-1 px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange"
                />
                <input
                  type="text"
                  value={address.state}
                  onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                  placeholder="State"
                  className="px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange"
                />
                <input
                  type="text"
                  value={address.zip}
                  onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                  placeholder="ZIP"
                  className="px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange"
                />
              </div>
            </div>

            {!showPayPal ? (
              <button
                onClick={handleProceedToPayment}
                disabled={!isFormValid || preparing}
                className="w-full bg-spur-orange text-white font-bold py-4 rounded disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-widest"
              >
                {preparing ? 'One moment...' : 'Proceed to Payment'}
              </button>
            ) : (
              <div ref={paypalContainerRef} />
            )}

            <p className="text-center text-xs text-gray-400 mt-4">
              No account needed to check out. Logging in first ties this order to your account history.
            </p>
          </div>

          {/* Order summary */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-bold text-spur-black mb-4">Order Summary</h2>
            <div className="divide-y divide-spur-tan-light border-t border-b border-spur-tan-light mb-4">
              {items.map((line) => (
                <div key={`${line.itemId}-${line.comboIndex ?? 'none'}`} className="flex items-center gap-3 py-3">
                  <div className="w-14 h-14 flex-shrink-0 bg-spur-tan-light rounded overflow-hidden">
                    <img src={line.thumbnailUrl} alt={line.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-spur-black text-sm truncate">{line.name}</p>
                    {line.variantLabel && <p className="text-xs text-gray-500">{line.variantLabel}</p>}
                    <p className="text-xs text-gray-500">Qty {line.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-spur-black">${(line.price * line.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span>${shippingRate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-spur-black pt-2 border-t border-spur-tan-light">
                <span>Total</span>
                <span>${(subtotal + shippingRate).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
