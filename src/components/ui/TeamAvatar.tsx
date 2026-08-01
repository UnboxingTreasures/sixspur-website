"use client";

export default function TeamAvatar({ image, name }: { image: string; name: string }) {
  return (
    <div className="relative w-full aspect-square bg-spur-tan-light rounded overflow-hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Silhouette always visible underneath */}
      <svg style={{ width: '50%', height: '50%', opacity: 0.35, position: 'absolute' }} fill="#7A6A5A" viewBox="0 0 24 24">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
      {/* Image on top, hidden on error */}
      <img
        src={image}
        alt={name}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
    </div>
  );
}
