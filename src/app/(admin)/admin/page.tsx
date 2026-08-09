import SixSpurLogo from '@/components/admin/SixSpurLogo';

export default function AdminHomePage() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '12px' }}>
          <SixSpurLogo size={64} color="#111111" />
        </div>
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#111111' }}>
          Six Spur Ranch Admin Panel
        </div>
      </div>
    </div>
  );
}
