import TeamAvatar from "@/components/ui/TeamAvatar";

export const metadata = {
  title: "About Us | Six Spur Ranch and Rescue",
  description: "Meet the team behind Six Spur Ranch and Rescue, a 501(c)(3) nonprofit animal sanctuary in Maud, Texas.",
};

const FOUNDER = {
  name: "Richard McGuire",
  title: "Founder & Ranch Manager",
  bio: "Bio coming soon.",
  image: "/images/team/richard-mcguire.jpg",
};

const TEAM = [
  { name: "Krista Young",  title: "Animal Caretaker",         bio: "Bio coming soon.", image: "/images/team/krista-young.jpg" },
  { name: "Lisa Brian",    title: "Ranch Caretaker",           bio: "Bio coming soon.", image: "/images/team/lisa-brian.jpg" },
  { name: "Travis Young",  title: "Ranch Hand",                bio: "Bio coming soon.", image: "/images/team/travis-young.jpg" },
  { name: "Jay Lefler",    title: "Digital Marketing Manager", bio: "Bio coming soon.", image: "/images/team/jay-lefler.jpg" },
  { name: "Lillie Brian",  title: "Ranch Apprentice",          bio: "Bio coming soon.", image: "/images/team/lillie-brian.jpg" },
];

function TeamCard({ member }: { member: typeof TEAM[0] }) {
  return (
    <div className="flex flex-col">
      <TeamAvatar image={member.image} name={member.name} />
      <div className="pt-4">
        <p className="font-bold text-spur-black text-lg">{member.name}</p>
        <p className="text-spur-orange text-xs font-semibold uppercase tracking-wide mb-2">{member.title}</p>
        <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-spur-black text-white py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="eyebrow mb-3">About Us</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">The People Behind the Ranch</h1>
          <p className="text-white/60 max-w-xl leading-relaxed">
            Six Spur Ranch and Rescue is run by a dedicated team of animal lovers in Maud, Texas,
            committed to giving every animal a safe and loving home.
          </p>
        </div>
      </section>

      <section className="py-16 px-6 border-b border-spur-tan-light">
        <div className="max-w-3xl mx-auto text-center">
          <div className="orange-divider mx-auto mb-6" />
          <p className="text-gray-700 text-lg leading-relaxed">
            Founded by Richard McGuire, Six Spur Ranch and Rescue is a 501(c)(3) nonprofit sanctuary
            located in Maud, Texas. We rescue, rehabilitate, and rehome animals of all kinds — from
            dogs and horses to cattle, goats, and everything in between.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20 pb-20 border-b border-spur-tan-light">
            <div className="max-w-sm mx-auto md:mx-0 w-full">
              <TeamAvatar image={FOUNDER.image} name={FOUNDER.name} />
            </div>
            <div>
              <p className="eyebrow mb-2">{FOUNDER.title}</p>
              <h2 className="text-3xl font-bold text-spur-black mb-4">{FOUNDER.name}</h2>
              <div className="orange-divider mb-4" />
              <p className="text-gray-600 leading-relaxed">{FOUNDER.bio}</p>
            </div>
          </div>

          <h3 className="text-xl font-bold text-spur-black mb-10">Our Team</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {TEAM.map((member) => (
              <TeamCard key={member.name} member={member} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
