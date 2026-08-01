"use client";

import { useState } from "react";

const SUBJECTS = [
  "Adoptions",
  "Donations",
  "General Inquiries",
];

// Set NEXT_PUBLIC_API_URL in Amplify env vars.
// Falls back to the live endpoint directly if the env var isn't set.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";
const CONTACT_API_URL = `${API_BASE_URL}/contact`;

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(CONTACT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          subject: form.subject || "General Inquiries",
          message: form.message.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again or email us directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-white">
        <section className="bg-spur-black text-white py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <p className="eyebrow mb-3">Contact</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
          </div>
        </section>
        <section className="py-24 px-6">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-14 h-14 rounded-full bg-spur-orange-light flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-spur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-spur-black mb-3">Message Sent</h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              Thanks for reaching out. We'll get back to you as soon as we can.
            </p>
            <button
              onClick={() => {
                setForm({ name: "", email: "", phone: "", subject: "", message: "" });
                setSubmitted(false);
              }}
              className="text-spur-orange hover:underline text-sm font-medium"
            >
              Send another message
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Contact</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Have a question about adoptions, donations, or anything else? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">

            {/* Name + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-spur-black mb-2">
                  Name <span className="text-spur-orange">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-spur-black mb-2">
                  Email <span className="text-spur-orange">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black placeholder-gray-400"
                />
              </div>
            </div>

            {/* Phone + Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-spur-black mb-2">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(555) 000-0000"
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-spur-black mb-2">
                  Subject
                </label>
                <select
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black bg-white appearance-none"
                >
                  <option value="">Select a subject</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold text-spur-black mb-2">
                Message <span className="text-spur-orange">*</span>
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={6}
                placeholder="Tell us how we can help..."
                className="w-full px-4 py-3 border border-spur-tan rounded focus:outline-none focus:border-spur-orange transition-colors text-spur-black placeholder-gray-400 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-spur-orange text-white font-semibold px-10 py-3 rounded hover:bg-spur-orange-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
