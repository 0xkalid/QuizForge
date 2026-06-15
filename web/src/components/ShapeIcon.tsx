import type { AnswerStyle } from '../lib/shapes';

/** Renders the answer's shape as an inline SVG (paired with color + label). */
export function ShapeIcon({ shape, size = 28 }: { shape: AnswerStyle['shape']; size?: number }) {
  const s = size;
  const c = s / 2;
  switch (shape) {
    case 'triangle':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <polygon points={`${c},${s * 0.12} ${s * 0.92},${s * 0.88} ${s * 0.08},${s * 0.88}`} fill="#fff" />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <polygon points={`${c},${s * 0.08} ${s * 0.92},${c} ${c},${s * 0.92} ${s * 0.08},${c}`} fill="#fff" />
        </svg>
      );
    case 'circle':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <circle cx={c} cy={c} r={s * 0.4} fill="#fff" />
        </svg>
      );
    case 'square':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <rect x={s * 0.14} y={s * 0.14} width={s * 0.72} height={s * 0.72} rx={s * 0.08} fill="#fff" />
        </svg>
      );
  }
}
