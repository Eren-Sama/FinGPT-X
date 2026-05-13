import { useMemo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  className?: string;
}

export function Sparkline({ data, width = 100, height = 30, positive = true, className = "" }: SparklineProps) {
  const pts = useMemo(() => {
    if (data.length === 0) return "";
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // add padding so stroke doesn't get cut off
    const padX = 2;
    const padY = 2;
    const w = width - padX * 2;
    const h = height - padY * 2;

    return data.map((d, i) => {
      const x = padX + (i / (data.length - 1)) * w;
      const y = padY + h - ((d - min) / range) * h;
      return `${x},${y}`;
    }).join(" ");
  }, [data, width, height]);

  if (data.length < 2) return null;

  const color = positive ? "#34d399" : "#f87171"; // Tailwind emerald-400 : red-400

  return (
    <svg 
      width="100%" 
      height="100%" 
      className={className} 
      viewBox={`0 0 ${width} ${height}`} 
      preserveAspectRatio="none"
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
