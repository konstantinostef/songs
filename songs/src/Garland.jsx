import React from "react";

export default function Garland() {
  const n = 14;
  const colors = ["#F0B429", "#E1563F", "#F0B429", "#D6A94A"];
  const bulbs = Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 10 + Math.sin((i / (n - 1)) * Math.PI) * 14;
    return { x, y, c: colors[i % colors.length], delay: (i % 5) * 0.3 };
  });
  const path = bulbs.map((b, i) => `${i === 0 ? "M" : "L"} ${b.x} ${b.y}`).join(" ");

  return (
    <svg viewBox="0 0 100 26" className="garland" preserveAspectRatio="none">
      <path d={path} stroke="#4A4468" strokeWidth="0.4" fill="none" opacity="0.6" />
      {bulbs.map((b, i) => (
        <circle
          key={i}
          cx={b.x}
          cy={b.y}
          r="1.6"
          fill={b.c}
          className="bulb"
          style={{ animationDelay: `${b.delay}s` }}
        />
      ))}
    </svg>
  );
}