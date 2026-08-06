export const metadata = {
  title: "Terms of Service | Six Spur Ranch and Rescue",
  description: "Terms of Service for Six Spur Ranch and Rescue, a 501(c)(3) nonprofit animal rescue and sanctuary.",
};
export default function TermsOfServicePage() {
  const lastUpdated = "August 6, 2026";
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-white/60 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </section>
      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-700 leading-relaxed mb-6">
            Six Spur Ranch Company ("Six Spur Ranch and Rescue," "we," "us," or "our") operates the
            website sixspurranch.org. These Terms of Service ("Terms") govern your access to and use
            of our website, including browsing our site, submitting forms, applying to adopt an
            animal, making a donation, or purchasing merchandise from our shop.
          </p>
          <p className="text-gray-700 leading-relaxed mb-10">
            By using our website, you agree to these Terms. If you do not agree, please do not use
            our website.
          </p>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">1. Use of Our Website</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to use our website only for lawful purposes and in a way that does not
              infringe the rights of, or restrict or inhibit the use and enjoyment of, this site by
              anyone else. You may not use our website to submit false, misleading, or fraudulent
              information, including in adoption applications or contact forms.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">2. Adoption Applications</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Submitting an adoption application does not guarantee or reserve any specific animal.
              All applications are reviewed at our discretion, and we may request additional
              information, a site visit, or references before approving an adoption. We reserve the
              right to decline any application for any lawful reason.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Information you provide in an adoption application must be accurate and truthful.
              Providing false information may result in denial of your application or, if discovered
              after adoption, return of the animal.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">3. Donations and Shop Purchases</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Donations made through our website are processed via PayPal and/or Stripe and are, to
              the extent permitted by law, tax-deductible. We are a registered 501(c)(3) nonprofit
              organization (EIN: 41-4123317).
            </p>
            <p className="text-gray-700 leading-relaxed">
              Merchandise purchased through our shop is subject to availability. We reserve the right
              to limit quantities, cancel orders, or correct pricing errors. Proceeds from shop
              purchases support the animals in our care.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">4. Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              All content on this website — including text, images, logos, and design — is the
              property of Six Spur Ranch and Rescue unless otherwise noted, and is protected by
              copyright and other intellectual property laws. You may not reproduce, distribute, or
              use our content for commercial purposes without our prior written permission.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">5. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed">
              Our website integrates with third-party services including PayPal, Stripe, Amazon Web
              Services, Meta (Facebook/Instagram), and YouTube. Your use of those services is
              governed by their own terms of service, separate from these Terms. We are not
              responsible for the content, policies, or practices of any third-party service.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">6. No Warranty</h2>
            <p className="text-gray-700 leading-relaxed">
              Our website and its content are provided "as is" without warranties of any kind, either
              express or implied. We make reasonable efforts to keep information about our animals,
              adoption process, and organization accurate and up to date, but we do not guarantee
              that all information is complete, current, or error-free.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">7. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              To the fullest extent permitted by law, Six Spur Ranch and Rescue shall not be liable
              for any indirect, incidental, or consequential damages arising from your use of our
              website or any animal adopted through us. Nothing in these Terms limits any liability
              that cannot legally be limited.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">8. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of the State of Texas, without regard to its
              conflict of law principles.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">9. Changes to These Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these Terms from time to time. When we do, we will update the "Last
              updated" date at the top of this page. Continued use of our website after any changes
              constitutes acceptance of the updated Terms.
            </p>
          </div>
          <hr className="border-spur-tan mb-10" />

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-spur-black mb-4">10. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms, please{" "}
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
