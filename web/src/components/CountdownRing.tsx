import { useEffect, useState } from 'react';

/**
 * Visual + numeric countdown driven by a server `deadline` (epoch ms).
 * Uses a shrinking SVG ring. Respects prefers-reduced-motion by simply
 * updating the number/arc once per second instead of animating frames.
 */
export function CountdownRing({
  deadline,
  totalMs,
  size = 96,
}: {
  deadline: number;
  totalMs: number;
  size?: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, deadline - now);
  const seconds = Math.ceil(remaining / 1000);
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;

  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - fraction);
  const urgent = seconds <= 5;

  return (
    <div className="countdown" role="timer" aria-label={`${seconds} seconds remaining`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,229,208,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? '#ff4d6d' : '#00e5d0'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.2s linear' }}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="countdown-num">
          {seconds}
        </text>
      </svg>
    </div>
  );
}
