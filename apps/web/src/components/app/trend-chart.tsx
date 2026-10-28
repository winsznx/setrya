import { parseDec, formatGrouped } from '@setrya/domain';

/**
 * Daily eligible fees as an SVG area chart. Plot coordinates are display-only floats; the table below the chart
 * holds the exact values.
 */
export function TrendChart({ points, currency }: { points: { day: string; total: string }[]; currency: string }) {
  if (points.length === 0) return <p className="py-8 text-center text-body-s text-ink-muted">No eligible fees in the last 120 days.</p>;
  const W = 640;
  const Hh = 160;
  const values = points.map((p) => Number(p.total));
  const max = Math.max(...values, 0) || 1;
  const minV = Math.min(...values, 0);
  const span = max - minV || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => Hh - ((v - minV) / span) * (Hh - 16) - 8;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(values[i]!).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${Hh} L${x(0).toFixed(1)},${Hh} Z`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="h-40 w-full" role="img" aria-label={`Eligible fees per day in ${currency}, ${points.length} days with fees`} preserveAspectRatio="none">
        <path d={area} fill="var(--color-accent-soft)" />
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={p.day} cx={x(i)} cy={y(values[i]!)} r="2.5" fill="var(--color-accent)">
            <title>{`${p.day}: ${formatGrouped(parseDec(p.total, 36), 2, 8)} ${currency}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-label text-ink-muted">
        <span>{points[0]!.day}</span>
        <span>{points[points.length - 1]!.day}</span>
      </figcaption>
      <details className="mt-2 text-body-s">
        <summary className="cursor-pointer text-ink-secondary">Show values</summary>
        <table className="mt-2 w-full">
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-border"><td className="py-1">{p.day}</td><td className="py-1 text-right tnum">{formatGrouped(parseDec(p.total, 36), 2, 8)} {currency}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
