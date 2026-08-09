export default function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '14px', color: '#9CA3AF' }}>
          Coming soon
        </div>
      </div>
    </div>
  );
}
