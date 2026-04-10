const COUNTRIES = [
  { code: 'US', name: 'United States', color: '#3b82f6' },
  { code: 'CA', name: 'Canada', color: '#ef4444' },
  { code: 'GB', name: 'United Kingdom', color: '#1d4ed8' },
  { code: 'DE', name: 'Germany', color: '#eab308' },
  { code: 'TR', name: 'Turkey', color: '#ef4444' },
  { code: 'FR', name: 'France', color: '#2563eb' },
  { code: 'NL', name: 'Netherlands', color: '#f97316' },
  { code: 'SE', name: 'Sweden', color: '#3b82f6' },
  { code: 'FI', name: 'Finland', color: '#0ea5e9' },
];

export function CountryFlags({ className = '' }: { className?: string }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Serving teams in</span>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        {COUNTRIES.map((c) => (
          <span
            key={c.code}
            title={c.name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '20px',
              borderRadius: '3px',
              background: `linear-gradient(135deg, ${c.color}, ${c.color}dd)`,
              color: '#fff',
              fontSize: '.6rem',
              fontWeight: 700,
              letterSpacing: '.02em',
              lineHeight: 1,
              border: '1px solid rgba(255,255,255,.15)',
              cursor: 'default',
            }}
          >
            {c.code}
          </span>
        ))}
        <span style={{ fontSize: '.7rem', color: '#4b5563', marginLeft: '2px' }}>+21 more</span>
      </div>
    </div>
  );
}
