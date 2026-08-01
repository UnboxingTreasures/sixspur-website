export const metadata = {
  title: "Data Deletion Request | Six Spur Ranch and Rescue",
  description: "Request deletion of your personal data from Six Spur Ranch and Rescue.",
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Data Deletion Request</h1>
          <p className="text-white/60 text-sm max-w-xl">
            You have the right to request that we delete your personal information. Here's how.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-10">

          {/* What we can delete */}
          <div>
            <h2 className="text-2xl font-bold text-spur-black mb-4">What we can delete</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Upon request, we will delete the following personal data we hold about you:
            </p>
            <ul className="space-y-3">
              {[
                "Contact form messages and correspondence",
                "Adoption inquiry information",
                "Mailing list subscriptions and email preferences",
                "Donation records, subject to legal retention requirements (see below)",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-spur-tan" />

          {/* What we must retain */}
          <div>
            <h2 className="text-2xl font-bold text-spur-black mb-4">What we may be required to retain</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Certain records cannot be deleted due to legal obligations:
            </p>
            <ul className="space-y-3">
              {[
                "Donation records required for nonprofit accounting and IRS compliance (minimum 7 years)",
                "Records required by applicable federal, state, or local law",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-spur-tan" />

          {/* How to request */}
          <div>
            <h2 className="text-2xl font-bold text-spur-black mb-4">How to submit a request</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              To request deletion of your data, use our contact form and include the following
              information so we can locate and remove your records:
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Your full name",
                "The email address associated with your account or submissions",
                "A brief description of what you'd like deleted",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 w-2 h-2 rounded-full bg-spur-orange flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <a
              href="/contact"
              className="inline-block bg-spur-orange text-white font-semibold px-8 py-3 rounded hover:bg-spur-orange-dark transition-colors"
            >
              Submit a Deletion Request
            </a>
          </div>

          <hr className="border-spur-tan" />

          {/* Timeline */}
          <div>
            <h2 className="text-2xl font-bold text-spur-black mb-4">What to expect</h2>
            <p className="text-gray-700 leading-relaxed">
              We will respond to your request within <strong className="text-spur-black">30 days</strong>.
              Once verified, eligible data will be permanently deleted from our systems. You will
              receive a confirmation when the deletion is complete.
            </p>
          </div>

          <hr className="border-spur-tan" />

          {/* Privacy policy link */}
          <div>
            <h2 className="text-2xl font-bold text-spur-black mb-4">More about your privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              For a full overview of how we collect, use, and protect your data, please review our{" "}
              <a href="/privacy" className="text-spur-orange hover:underline">
                Privacy Policy
              </a>.
            </p>
          </div>

          <p className="text-sm text-gray-400 pt-2">
            Six Spur Ranch Company is a registered 501(c)(3) nonprofit organization.
            EIN: 41-4123317.
          </p>

        </div>
      </section>
    </main>
  );
}
