export function Logo({ light = false, id = "mlogo" }: { light?: boolean; id?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${light ? "text-white" : "text-ink"}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d93d74" />
            <stop offset="1" stopColor="#6d4fe0" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill={`url(#${id})`} />
        <path d="M7 21.5V11l5.2 6.2L16 11l3.8 6.2L25 11v10.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-[1.4rem] font-medium leading-none tracking-tight">momento</span>
    </span>
  );
}
