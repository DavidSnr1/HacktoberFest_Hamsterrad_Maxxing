/** Neutral illustrated interviewer portrait (no real person). */
export function InterviewerAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Interviewerin">
      <defs>
        <linearGradient id="interviewer-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7e5e4" />
          <stop offset="1" stopColor="#a8a29e" />
        </linearGradient>
        <clipPath id="interviewer-clip">
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>
      <g clipPath="url(#interviewer-clip)">
        <rect width="120" height="120" fill="url(#interviewer-bg)" />
        {/* Shoulders and blazer */}
        <path d="M14 120c2-22 20-34 46-34s44 12 46 34z" fill="#292524" />
        <path d="M50 87l10 16 10-16" fill="#f5f5f4" />
        {/* Neck */}
        <rect x="52" y="70" width="16" height="18" rx="6" fill="#d6a98a" />
        {/* Hair back */}
        <path d="M33 54c0-20 12-32 27-32s27 12 27 32c0 12-3 22-6 28H39c-3-6-6-16-6-28z" fill="#57392a" />
        {/* Face */}
        <ellipse cx="60" cy="54" rx="19" ry="22" fill="#e8b996" />
        {/* Hair front */}
        <path d="M40 48c4-14 13-20 22-20 10 0 18 7 19 18-9-1-20-6-26-13-3 7-9 12-15 15z" fill="#57392a" />
        {/* Eyes and mouth */}
        <circle cx="52" cy="55" r="2" fill="#292524" />
        <circle cx="68" cy="55" r="2" fill="#292524" />
        <path d="M54 65c3 3 9 3 12 0" stroke="#9a5b45" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
