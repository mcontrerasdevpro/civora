export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="logo-mark"
    >
      <path
        d="M31 10.5C28.3 7.4 24.4 5.5 20 5.5 11.9 5.5 5.5 12 5.5 20S11.9 34.5 20 34.5c4.4 0 8.3-1.9 11-5"
        stroke="url(#logo-gradiente)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.5 20.5l4 4 8-9"
        stroke="url(#logo-gradiente)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="logo-gradiente" x1="5.5" y1="5.5" x2="34.5" y2="34.5">
          <stop offset="0" stopColor="var(--acento)" />
          <stop offset="1" stopColor="var(--primario)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
