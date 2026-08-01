"use client";

import { useState } from "react";
import Link from "next/link";

interface FAQItem {
  q: string;
  a: React.ReactNode;
}

interface FAQSection {
  title: string;
  items: FAQItem[];
}

const SECTIONS: FAQSection[] = [
  {
    title: "Our Organization",
    items: [
      {
        q: "What is Six Spur Ranch and Rescue?",
        a: "Six Spur Ranch and Rescue is a registered 501(c)(3) nonprofit animal rescue and sanctuary located in Maud, Texas. We rescue and rehabilitate animals that have been abused, abandoned, or discarded, and provide them with a safe and loving home. Many of our animals are permanent residents who live out their lives on the ranch, while others are available for adoption into loving homes. We care for dogs, cattle, horses, goats, donkeys, mini donkeys, chickens, ducks, geese, and more.",
      },
      {
        q: "What are your official social media accounts?",
        a: (
          <>
            <p className="mb-3">Our official accounts are listed below. Any other pages or profiles are not affiliated with Six Spur Ranch and Rescue. Please do not send money or personal information to any unofficial accounts.</p>
            <ul className="space-y-1">
              {[
                { label: "Website", href: "https://sixspurranch.org" },
                { label: "Facebook", href: "https://facebook.com" },
                { label: "Instagram", href: "https://instagram.com" },
                { label: "TikTok", href: "https://tiktok.com" },
                { label: "YouTube", href: "https://youtube.com" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-spur-orange hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ),
      },
      {
        q: "How do I contact Six Spur Ranch and Rescue?",
        a: (
          <>
            All inquiries can be submitted through our{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">contact form</Link>.
            {" "}We respond to all messages as quickly as we can. If you receive a message claiming to be from Six Spur through any other channel asking for money or personal information, please disregard it — it is not from us.
          </>
        ),
      },
      {
        q: "Is Six Spur Ranch and Rescue a legitimate nonprofit?",
        a: "Yes. Six Spur Ranch and Rescue operates under Six Spur Ranch Company, a registered 501(c)(3) nonprofit organization. Our EIN is 41-4123317. All donations are tax-deductible to the extent permitted by law.",
      },
    ],
  },
  {
    title: "Visiting & Volunteering",
    items: [
      {
        q: "Can I visit the ranch?",
        a: "We are not currently open to the public in order to protect the privacy and wellbeing of our animals and staff. We are exploring ways to include our community in the future and will share updates through our newsletter. Sign up through our contact page to stay informed.",
      },
      {
        q: "Can I volunteer at Six Spur?",
        a: "We do not currently have a formal volunteer program, but we are actively working on expanding the ranch and looking at ways for the public to get involved. Stay connected by signing up for our newsletter — we'll announce opportunities there first.",
      },
      {
        q: "Can I work at Six Spur Ranch and Rescue?",
        a: (
          <>
            We appreciate your interest! When positions become available, we will post them publicly.
            In the meantime, feel free to{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">reach out through our contact form</Link>
            {" "}to express your interest.
          </>
        ),
      },
    ],
  },
  {
    title: "Adoption",
    items: [
      {
        q: "Do you adopt out animals?",
        a: (
          <>
            Yes. While some of our animals are permanent ranch residents, we actively adopt out dogs and other animals that would thrive in a loving home. Visit our{" "}
            <Link href="/adopt" className="text-spur-orange hover:underline">adoption page</Link>
            {" "}to see who is currently available.
          </>
        ),
      },
      {
        q: "What animals are available for adoption?",
        a: (
          <>
            All of our adoptable animals are listed on our{" "}
            <Link href="/adopt" className="text-spur-orange hover:underline">adopt page</Link>.
            {" "}If you don&apos;t see a specific animal listed, they may still be going through health and behavioral assessments before becoming available. Feel free to{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">contact us</Link>
            {" "}with questions about a specific animal.
          </>
        ),
      },
      {
        q: "I need to rehome my pet. Can Six Spur help?",
        a: (
          <>
            <p className="mb-3">We take in animals based on our current capacity. Please{" "}
              <Link href="/contact" className="text-spur-orange hover:underline">contact us</Link>
              {" "}to discuss your situation and we will do our best to help or point you toward resources in your area.
            </p>
            <p>You can also search for rescue organizations near you at{" "}
              <a href="https://www.petfinder.com/animal-shelters-and-rescues/search/" target="_blank" rel="noopener noreferrer" className="text-spur-orange hover:underline">petfinder.com</a>
              {" "}or explore private rehoming options at{" "}
              <a href="https://home-home.org" target="_blank" rel="noopener noreferrer" className="text-spur-orange hover:underline">home-home.org</a>.
            </p>
          </>
        ),
      },
      {
        q: "What is the difference between a rescue and a sanctuary?",
        a: "Animal rescue organizations focus on finding new homes for animals in need. Animal sanctuaries provide a permanent, safe environment for animals to live out their lives. Six Spur Ranch and Rescue does both — we rescue and rehabilitate animals and find them loving homes when possible, while also providing a lifelong sanctuary for those who need it.",
      },
    ],
  },
  {
    title: "Donations",
    items: [
      {
        q: "Where does my donation go?",
        a: "Every dollar goes directly to the animals — feed, veterinary care, shelter maintenance, and the daily operations of the ranch. We are a small team and keep overhead low so your gift has the greatest possible impact.",
      },
      {
        q: "Can I donate by check?",
        a: (
          <>
            Yes. Please{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">contact us</Link>
            {" "}for our current mailing address. Please make checks payable to <strong>Six Spur Ranch Company</strong>. All donations are tax-deductible and you will receive a receipt for your contribution. Our EIN is 41-4123317.
          </>
        ),
      },
      {
        q: "How do I manage or cancel a recurring donation?",
        a: (
          <>
            If you set up a recurring donation through PayPal, you can manage or cancel it by logging into your{" "}
            <a href="https://www.paypal.com" target="_blank" rel="noopener noreferrer" className="text-spur-orange hover:underline">PayPal account</a>
            {" "}and navigating to Payments → Subscriptions / Automatic Payments. If you need help, please{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">contact us</Link>
            {" "}and we will assist you.
          </>
        ),
      },
      {
        q: "Is my donation tax-deductible?",
        a: "Yes. Six Spur Ranch and Rescue operates under Six Spur Ranch Company, a registered 501(c)(3) nonprofit organization (EIN: 41-4123317). Donations are tax-deductible to the extent permitted by law. You will receive a receipt for your contribution.",
      },
    ],
  },
  {
    title: "Shop",
    items: [
      {
        q: "How does my purchase help Six Spur?",
        a: "Proceeds from our shop go directly toward the care of our animals — feed, vet bills, shelter, and daily ranch operations. Every purchase makes a real difference.",
      },
      {
        q: "Where can I buy Six Spur merchandise?",
        a: (
          <>
            Official Six Spur merchandise is only available through our{" "}
            <Link href="/shop" className="text-spur-orange hover:underline">shop page</Link>.
            {" "}Be cautious of any third-party sellers — we have no association with them and cannot guarantee the quality or destination of funds from unauthorized sellers.
          </>
        ),
      },
      {
        q: "I have a question about my order.",
        a: (
          <>
            Please{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">contact us</Link>
            {" "}with your order details and we will get back to you as quickly as possible.
          </>
        ),
      },
    ],
  },
  {
    title: "Contact",
    items: [
      {
        q: "How do I get in touch?",
        a: (
          <>
            All inquiries — adoptions, donations, volunteer interest, press, or general questions — can be submitted through our{" "}
            <Link href="/contact" className="text-spur-orange hover:underline">contact form</Link>.
            {" "}We read every message and respond as quickly as we can.
          </>
        ),
      },
    ],
  },
];

function AccordionItem({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-spur-tan-light">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className={`text-sm font-semibold leading-snug ${open ? "text-spur-orange" : "text-spur-black"}`}>
          {item.q}
        </span>
        <span className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${open ? "border-spur-orange text-spur-orange" : "border-spur-tan text-spur-black/40"}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d={open ? "M2 7l3-4 3 4" : "M2 3l3 4 3-4"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-5 text-sm text-gray-600 leading-relaxed pr-8">
          {item.a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="eyebrow mb-3">FAQ</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Quick answers about Six Spur Ranch and Rescue, our animals, adoptions, donations, and more.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">

          {/* Section nav */}
          <aside className="md:w-48 flex-shrink-0">
            <nav className="sticky top-8 flex flex-col gap-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.title}
                  onClick={() => {
                    setActiveSection(section.title === activeSection ? null : section.title);
                    document.getElementById(section.title)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`text-left text-xs font-semibold px-3 py-2 rounded transition-colors ${
                    activeSection === section.title
                      ? "text-spur-orange bg-spur-orange-light"
                      : "text-gray-500 hover:text-spur-orange"
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* FAQ content */}
          <div className="flex-1 space-y-12">
            {SECTIONS.map((section) => (
              <div key={section.title} id={section.title}>
                <h2 className="text-lg font-bold text-spur-black mb-1">{section.title}</h2>
                <div className="orange-divider mb-4" />
                {section.items.map((item) => (
                  <AccordionItem key={item.q} item={item} />
                ))}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Still have questions CTA */}
      <section className="bg-white py-14 px-6 border-t border-spur-tan">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-spur-black mb-3">Still have questions?</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            We're happy to help. Send us a message and we'll get back to you as soon as we can.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-spur-orange text-white font-semibold px-8 py-3 rounded hover:bg-spur-orange-dark transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>

    </main>
  );
}
