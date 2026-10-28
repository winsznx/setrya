import { cx } from '@/components/ui/cx';

/**
 * The Zcash coin mark, from the official asset on z.cash: the gold disc with the white Z. It labels ZEC amounts and
 * the Zcash network, and nothing else, so gold on the page always means ZEC.
 */
export function ZecMark({ size = 14, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 65 65"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cx('inline-block shrink-0', className)}
    >
      <circle cx="32.5" cy="32.5" r="32.5" fill="#F3B724" />
      <path d="M29.591 13v5.146H21v6.2h13.33L21 41.974v4.667h8.591v5.113h5.279v-5.113h8.59v-6.2H30.131l13.329-17.628v-4.667h-8.59V13z" fill="#fff" />
    </svg>
  );
}
