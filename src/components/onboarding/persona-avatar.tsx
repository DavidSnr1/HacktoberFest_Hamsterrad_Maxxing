/** Illustrated onboarding persona: young consultant in a fleece vest (no real person). */
export function PersonaAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Maximilian">
      <defs>
        <linearGradient id="persona-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#93c5fd" />
        </linearGradient>
        <clipPath id="persona-clip">
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath="url(#persona-clip)">
        <rect width="120" height="120" fill="url(#persona-bg)" />
        {/* Light blue shirt */}
        <path d="M16 120c2-22 20-34 44-34s42 12 44 34z" fill="#bfdbfe" />
        {/* Fleece vest */}
        <path d="M18 120c2-18 12-28 26-31l8 31z" fill="#1e3a5f" />
        <path d="M102 120c-2-18-12-28-26-31l-8 31z" fill="#1e3a5f" />
        <rect x="74" y="98" width="9" height="5" rx="1" fill="#f8fafc" opacity="0.9" />
        {/* Collar */}
        <path d="M50 86l10 12 10-12" fill="#f8fafc" />
        {/* Neck */}
        <rect x="52" y="70" width="16" height="17" rx="6" fill="#e0ac88" />
        {/* Face */}
        <ellipse cx="60" cy="53" rx="18" ry="21" fill="#f1c4a1" />
        {/* Side-parted hair */}
        <path d="M41 49c0-17 9-26 21-26 11 0 19 8 19 21-7-6-17-9-28-8-5 1-9 6-12 13z" fill="#6b4226" />
        {/* Eyes, eyebrows and confident smile */}
        <path d="M48 47h7M65 47h7" stroke="#4b2e1c" strokeWidth="2" strokeLinecap="round" />
        <circle cx="52" cy="53" r="2" fill="#1f2937" />
        <circle cx="68" cy="53" r="2" fill="#1f2937" />
        <path d="M52 63c5 4 11 4 16 0" stroke="#9a5b45" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
