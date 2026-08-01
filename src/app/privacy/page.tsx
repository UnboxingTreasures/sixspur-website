export const metadata = {
  title: "Privacy Policy | Six Spur Ranch and Rescue",
  description: "Privacy Policy for Six Spur Ranch and Rescue, a 501(c)(3) nonprofit animal rescue and sanctuary.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "July 1, 2026";

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-white/60 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">

          <p className="text-gray-700 leading-relaxed mb-6">
            Six Spur Ranch Company ("Six Spur Ranch and Rescue," "we," "us," or "our") operates the
            website sixspurranch.org. This Privacy Policy explains how we collect, use, and protect
            your personal information when you visit our site, submit a contact form, make a donation,
            or interact with us in any way.
          </p>

          <p className="text-gray-700 leading-relaxed mb-10">
            By using our website, you agree to the practices described in this policy.
          </p>

          <hr className="border-spur-tan mb-10" />

          {/* Section */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-6">1. Information We Collect</h2>

            <h3 className="text-base font-semibold text-spur-black uppercase tracking-wide mb-3">
              Information you provide directly
            </h3>
            <ul className="space-y-3 mb-8">
              {[
                { label: "Contact forms", desc: "your name, email address, and the content of your message when you reach out to us." },
                { label: "Donation and payment information", desc: "your name, email address, and payment details when you make a donation. Payment processing is handled by PayPal and Stripe; we do not store your full payment card details on our servers." },
                { label: "Adoption inquiries", desc: "information you provide when expressing interest in adopting an animal, including contact details and any background information you choose to share." },
                { label: "Newsletter sign-ups", desc: "your email address if you subscribe to our mailing list." },
              ].map((item) => (
                <li key={item.label} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">
                    <strong className="text-spur-black">{item.label}</strong> — {item.desc}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="text-base font-semibold text-spur-black uppercase tracking-wide mb-3">
              Information collected automatically
            </h3>
            <ul className="space-y-3">
              {[
                { label: "Usage data", desc: "standard web server logs including your IP address, browser type, pages visited, and referring URLs. This data is used solely for site maintenance and security." },
                { label: "Cookies", desc: "we use minimal session cookies necessary for the site to function. We do not use advertising or tracking cookies." },
              ].map((item) => (
                <li key={item.label} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">
                    <strong className="text-spur-black">{item.label}</strong> — {item.desc}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">We use your information only for the following purposes:</p>
            <ul className="space-y-3 mb-6">
              {[
                "To respond to your inquiries and support requests",
                "To process donations and issue tax receipts",
                "To send newsletters and updates you have opted into",
                "To process and follow up on adoption applications",
                "To maintain and improve our website",
                "To comply with legal obligations",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-700 leading-relaxed">
              We do not sell, rent, or trade your personal information to any third party for marketing purposes.
            </p>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">3. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the following third-party services, each governed by their own privacy policies:
            </p>
            <ul className="space-y-3">
              {[
                { label: "PayPal", desc: "for donation and payment processing.", link: "https://www.paypal.com/us/legalhub/privacy-full", linkText: "PayPal Privacy Policy" },
                { label: "Stripe", desc: "for donation and payment processing.", link: "https://stripe.com/privacy", linkText: "Stripe Privacy Policy" },
                { label: "Amazon Web Services (AWS)", desc: "for website hosting, email delivery via SES, and data storage.", link: "https://aws.amazon.com/privacy/", linkText: "AWS Privacy Policy" },
                { label: "Meta (Facebook)", desc: "we maintain a Facebook page. If you interact with our Facebook presence, Meta's privacy policy applies.", link: "https://www.facebook.com/privacy/policy/", linkText: "Meta Privacy Policy" },
                { label: "YouTube", desc: "we may embed YouTube videos on our site. YouTube may collect data per Google's privacy policy.", link: "https://policies.google.com/privacy", linkText: "Google Privacy Policy" },
              ].map((item) => (
                <li key={item.label} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">
                    <strong className="text-spur-black">{item.label}</strong> — {item.desc}{" "}
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-spur-orange hover:underline">
                      {item.linkText}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">4. Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain contact messages and adoption inquiry records for as long as necessary to
              fulfill the purpose for which they were collected, or as required by law. Donation
              records are retained for a minimum of seven years in accordance with nonprofit
              accounting requirements. You may request deletion of your data at any time (see Section 6).
            </p>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">5. Data Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We implement industry-standard security measures to protect your personal information,
              including encrypted data transmission (HTTPS), access controls, and secure cloud
              infrastructure. However, no method of transmission over the internet is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">6. Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">You have the right to:</p>
            <ul className="space-y-3 mb-6">
              {[
                "Request access to the personal information we hold about you",
                "Request correction of inaccurate information",
                "Request deletion of your personal information",
                "Opt out of our mailing list at any time using the unsubscribe link in any email",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-700 leading-relaxed">
              To exercise any of these rights, please{" "}
              <a href="/contact" className="text-spur-orange hover:underline">contact us through our contact form</a>.
            </p>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">7. Children&apos;s Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Our website is not directed at children under the age of 13. We do not knowingly
              collect personal information from children under 13. If you believe a child has
              provided us with personal information, please{" "}
              <a href="/contact" className="text-spur-orange hover:underline">contact us</a> and we will delete it promptly.
            </p>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">8. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. When we do, we will update the
              "Last updated" date at the top of this page. Continued use of our website after any
              changes constitutes acceptance of the updated policy.
            </p>
          </div>

          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">9. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about this Privacy Policy or how we handle your data, please{" "}
              <a href="/contact" className="text-spur-orange hover:underline">reach out through our contact form</a>.
            </p>
          </div>

          <hr className="border-spur-tan mb-8" />

          <p className="text-sm text-gray-400">
            Six Spur Ranch Company is a registered 501(c)(3) nonprofit organization.
            EIN: 41-4123317. Donations are tax-deductible to the extent permitted by law.
          </p>

        </div>
      </section>
    </main>
  );
}
