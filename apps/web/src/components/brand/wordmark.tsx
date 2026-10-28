import Link from 'next/link';

/** The mark is a folded statement corner over a settlement line: a document that closes a period. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 2.5h9.5L19 7v14.5H5z" fill="currentColor" />
      <path d="M14.5 2.5V7H19" fill="none" stroke="var(--color-canvas)" strokeWidth="1.4" />
      <path d="M8 13.5h8M8 17h5" stroke="var(--color-canvas)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="18.5" r="2.4" fill="var(--color-zec)" stroke="var(--color-canvas)" strokeWidth="1.2" />
    </svg>
  );
}

export function Wordmark({ href = '/', className }: { href?: string | null; className?: string }) {
  const inner = (
    <span className={`inline-flex items-center gap-2 text-ink ${className ?? ''}`}>
      <Mark />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">Setrya</span>
    </span>
  );
  return href === null ? inner : <Link prefetch={false} href={href} aria-label="Setrya home">{inner}</Link>;
}
