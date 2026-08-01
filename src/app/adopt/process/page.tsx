import Link from "next/link";

export const metadata = {
  title: "Adoption Process | Six Spur Ranch and Rescue",
  description: "What to expect when adopting an animal from Six Spur Ranch and Rescue, from application to bringing them home.",
};

const STEPS = [
  {
    number: "1",
    title: "Browse & Choose",
    description: "Take a look at our available animals and find the one that feels right for your home and lifestyle.",
  },
  {
    number: "2",
    title: "Submit Your Application",
    description: "Fill out our adoption application — contact information, details about your household, your experience with animals, and how you'll care for them.",
  },
  {
    number: "3",
    title: "Application Review",
    description: "Our team reviews every application carefully, including your references and veterinarian information. Please allow about a week for this process.",
  },
  {
    number: "4",
    title: "Meet & Greet",
    description: "We'll schedule a time for you to meet the animal in person before anything is finalized.",
  },
  {
    number: "5",
    title: "Site Visit",
    description: "A site visit to where the animal will be kept is a required part of our adoption process for every animal, to make sure the space is a safe, good fit.",
  },
  {
    number: "6",
    title: "Approval & Agreement",
    description: "Once approved, you'll sign our return policy agreement and pay the adoption fee, which varies by animal.",
  },
  {
    number: "7",
    title: "Bring Them Home",
    description: "Time to welcome your new family member!",
  },
  {
    number: "8",
    title: "We're Always Here",
    description: "If your circumstances ever change and you're no longer able to care for the animal, please contact us first — always. We're here to help find a solution, including taking the animal back if needed.",
  },
];

export default function AdoptionProcessPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Adopt</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Adoption Process</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Here's what to expect from the moment you find an animal you love to the day you bring them home.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          {STEPS.map((step) => (
            <div key={step.number} className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-spur-orange-light flex items-center justify-center">
                <span className="text-spur-orange font-bold text-lg">{step.number}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-spur-black mb-2">{step.title}</h2>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}

          <div className="pt-8 border-t border-spur-tan-light text-center">
            <p className="text-gray-600 mb-6">Ready to find your new family member?</p>
            <Link
              href="/adopt"
              className="inline-block bg-spur-orange text-white font-semibold px-10 py-3 rounded hover:bg-spur-orange-dark transition-colors"
            >
              Browse Adoptable Animals
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
