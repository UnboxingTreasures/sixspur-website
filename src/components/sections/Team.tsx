import TeamMemberCard from './TeamMemberCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface StaffMember {
  staffId: string;
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
}

async function getStaff(): Promise<StaffMember[]> {
  try {
    const res = await fetch(`${API_URL}/staff`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.staff || [];
  } catch {
    return [];
  }
}

export default async function Team() {
  const staff = await getStaff();

  return (
    <section style={{ background: '#FFFFFF', padding: '6rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem', maxWidth: '580px' }}>
          <p style={{ color: '#E77A2D', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            The People Behind the Ranch
          </p>
          <h2 style={{ color: '#111111', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            Meet the{' '}
            <span style={{ color: '#E77A2D' }}>team.</span>
          </h2>
          <p style={{ color: '#555555', fontSize: '1.05rem', lineHeight: 1.8, margin: 0 }}>
            Six Spur runs on passion and hard work. Every person here shows up every day
            because they believe in what we're building — a place where animals are safe,
            loved, and given a second chance.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
          {staff.map((member) => (
            <TeamMemberCard
              key={member.staffId}
              name={member.name}
              title={member.title}
              bio={member.bio}
              image={member.imageUrl}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
