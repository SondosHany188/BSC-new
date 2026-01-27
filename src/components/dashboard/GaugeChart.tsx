import { cn } from "@/lib/utils";

interface GaugeChartProps {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function GaugeChart({ value, label, size = "md" }: GaugeChartProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  // Calculate rotation: -90deg (0%) to 90deg (100%)
  const rotation = -90 + (clampedValue / 100) * 180;

  const sizeClasses = {
    sm: "w-20 h-12",
    md: "w-28 h-16",
    lg: "w-36 h-20",
  };

  const needleSizes = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("relative overflow-hidden", sizeClasses[size])}>
        {/* Gauge background */}
        <svg
          viewBox="0 0 100 50"
          className="w-full h-full"
        >
          {/* Colored arc segments */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(0, 80%, 55%)" />
              <stop offset="25%" stopColor="hsl(25, 90%, 55%)" />
              <stop offset="50%" stopColor="hsl(45, 95%, 55%)" />
              <stop offset="75%" stopColor="hsl(90, 70%, 50%)" />
              <stop offset="100%" stopColor="hsl(142, 70%, 45%)" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Tick marks and labels at 0%, 30%, 50%, 70%, 100% */}
          {[0, 30, 50, 70, 100].map((tick) => {
            // Angle from 180deg (Left) to 0deg (Right)
            const angleRad = Math.PI - (tick / 100) * Math.PI;

            const x1 = 50 + 35 * Math.cos(angleRad);
            const y1 = 50 - 35 * Math.sin(angleRad);
            const x2 = 50 + 42 * Math.cos(angleRad);
            const y2 = 50 - 42 * Math.sin(angleRad);

            // Label positions
            const lx = 50 + 26 * Math.cos(angleRad);
            const ly = 50 - 26 * Math.sin(angleRad);

            return (
              <g key={tick}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--foreground))"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <text
                  x={lx}
                  y={ly}
                  fill="hsl(var(--foreground))"
                  fontSize="5"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  opacity="0.8"
                >
                  {tick}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className={cn("w-0.5 bg-foreground rounded-full", needleSizes[size])} />
          <div className="w-2 h-2 rounded-full bg-foreground -mt-1 -ml-[3px]" />
        </div>

        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background" />
      </div>

      {/* Value and label */}
      <div className="text-center">
        <span className="text-lg font-bold text-foreground">{clampedValue}%</span>
        {label && (
          <p className="text-xs text-muted-foreground">{label}</p>
        )}
      </div>
    </div>
  );
}
