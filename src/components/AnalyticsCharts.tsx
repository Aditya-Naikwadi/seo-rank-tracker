import React from "react";

// Accent colors aligned with premium dark theme
const COLORS = {
  primary: "var(--accent)", // Neon blue / purple accent
  success: "var(--success)", // Emerald green
  warning: "var(--warning)", // Amber
  danger: "var(--danger)",   // Red/Coral
  muted: "var(--muted-foreground)",
  border: "var(--border)",
  glass: "rgba(255, 255, 255, 0.03)"
};

interface DataPoint {
  x: string;
  y: number;
}

interface ScatterPoint {
  x: number; // Page Size (KB)
  y: number; // Load Time (ms)
  label: string;
}

/**
 * 1. LINE CHART - Continuous Temporal Trend
 */
export const TemporalTrendLineChart: React.FC<{ data: DataPoint[]; title: string; xLabel: string; yLabel: string }> = ({
  data,
  title,
  xLabel,
  yLabel
}) => {
  const width = 500;
  const height = 250;
  const padding = 40;

  const xCoords = data.map((_, i) => padding + ((width - 2 * padding) / (data.length - 1)) * i);
  const yMin = Math.min(...data.map(d => d.y));
  const yMax = Math.max(...data.map(d => d.y));
  const yRange = yMax - yMin || 1;

  const yCoords = data.map(
    d => height - padding - ((d.y - yMin) / yRange) * (height - 2 * padding)
  );

  const pointsString = data
    .map((_, i) => `${xCoords[i]},${yCoords[i]}`)
    .join(" ");

  return (
    <div className="glass p-5 rounded-2xl border border-border/40">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Draw Axises */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />

        {/* Line Path */}
        <polyline fill="none" stroke={COLORS.primary} strokeWidth="2.5" points={pointsString} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points markers */}
        {data.map((d, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={xCoords[i]} cy={yCoords[i]} r="4" fill={COLORS.primary} stroke="var(--background)" strokeWidth="1.5" />
            <circle cx={xCoords[i]} cy={yCoords[i]} r="8" fill={COLORS.primary} opacity="0" className="hover:opacity-20 transition-opacity" />
            {/* Tooltip */}
            <text x={xCoords[i]} y={yCoords[i] - 10} textAnchor="middle" className="text-[10px] fill-foreground font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-background">
              {d.y}
            </text>
          </g>
        ))}

        {/* Axis Labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" className="text-[10px] fill-muted-foreground">{xLabel}</text>
        <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`} className="text-[10px] fill-muted-foreground">{yLabel}</text>

        {/* Start / End values */}
        <text x={xCoords[0]} y={height - padding + 15} textAnchor="middle" className="text-[9px] fill-muted-foreground">{data[0].x}</text>
        <text x={xCoords[xCoords.length - 1]} y={height - padding + 15} textAnchor="middle" className="text-[9px] fill-muted-foreground">{data[data.length - 1].x}</text>
      </svg>
    </div>
  );
};

/**
 * 2. BAR CHART - Categorical Comparison
 */
export const CategoricalBarChart: React.FC<{ labels: string[]; values: number[]; title: string }> = ({
  labels,
  values,
  title
}) => {
  const width = 500;
  const height = 250;
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  const maxValue = Math.max(...values, 100);
  const barWidth = chartWidth / labels.length - 16;

  return (
    <div className="glass p-5 rounded-2xl border border-border/40">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Baseline grid */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />

        {values.map((val, i) => {
          const barHeight = (val / maxValue) * chartHeight;
          const x = padding + (chartWidth / labels.length) * i + 8;
          const y = height - padding - barHeight;

          return (
            <g key={i} className="group">
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={val >= 80 ? COLORS.success : val >= 50 ? COLORS.warning : COLORS.danger} rx="4" className="hover:opacity-90 transition-opacity" />
              {/* Value Label */}
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="text-[10px] font-bold fill-foreground">{val}</text>
              {/* Category Label */}
              <text x={x + barWidth / 2} y={height - padding + 15} textAnchor="middle" className="text-[9px] fill-muted-foreground">{labels[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 3. SCATTER PLOT - Dual-Variable Distributions (e.g., Size vs Load Time)
 */
export const DistributionScatterPlot: React.FC<{ data: ScatterPoint[]; title: string; xLabel: string; yLabel: string }> = ({
  data,
  title,
  xLabel,
  yLabel
}) => {
  const width = 500;
  const height = 250;
  const padding = 45;

  const xMin = Math.min(...data.map(d => d.x));
  const xMax = Math.max(...data.map(d => d.x));
  const xRange = xMax - xMin || 1;

  const yMin = Math.min(...data.map(d => d.y));
  const yMax = Math.max(...data.map(d => d.y));
  const yRange = yMax - yMin || 1;

  const getX = (xVal: number) => padding + ((xVal - xMin) / xRange) * (width - 2 * padding);
  const getY = (yVal: number) => height - padding - ((yVal - yMin) / yRange) * (height - 2 * padding);

  return (
    <div className="glass p-5 rounded-2xl border border-border/40">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Grid Boundaries */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />

        {/* Data points */}
        {data.map((d, i) => {
          const cx = getX(d.x);
          const cy = getY(d.y);

          return (
            <g key={i} className="group cursor-pointer">
              <circle cx={cx} cy={cy} r="6" fill={COLORS.primary} stroke="var(--background)" strokeWidth="1.5" opacity="0.8" />
              {/* Tooltip showing metadata */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                <rect x={cx - 50} y={cy - 35} width="100" height="25" rx="4" fill="var(--muted)" stroke={COLORS.border} strokeWidth="1" />
                <text x={cx} y={cy - 20} textAnchor="middle" className="text-[8px] fill-foreground font-semibold">
                  {d.label}: {d.x}KB, {d.y}ms
                </text>
              </g>
            </g>
          );
        })}

        {/* Labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" className="text-[10px] fill-muted-foreground">{xLabel}</text>
        <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`} className="text-[10px] fill-muted-foreground">{yLabel}</text>

        {/* Min/Max value indicator anchors */}
        <text x={padding} y={height - padding + 12} className="text-[8px] fill-muted-foreground">{xMin}KB</text>
        <text x={width - padding} y={height - padding + 12} textAnchor="end" className="text-[8px] fill-muted-foreground">{xMax}KB</text>
        <text x={padding - 5} y={padding + 5} textAnchor="end" className="text-[8px] fill-muted-foreground">{yMax}ms</text>
      </svg>
    </div>
  );
};

interface BoxPlotDataset {
  label: string;
  values: number[]; // Array of values to calculate box plot metrics (min, q1, median, q3, max)
}

/**
 * 4. BOX PLOT - Variance & Distribution Spreads (e.g. Latency Variance per Domain)
 */
export const VarianceBoxPlot: React.FC<{ data: BoxPlotDataset[]; title: string; yLabel: string }> = ({
  data,
  title,
  yLabel
}) => {
  const width = 500;
  const height = 250;
  const padding = 45;

  // Flatten all values to find global min/max for Y scaling
  const allValues = data.flatMap(d => d.values);
  const globalMin = Math.min(...allValues, 0);
  const globalMax = Math.max(...allValues, 100);
  const yRange = globalMax - globalMin || 1;

  const getY = (val: number) => height - padding - ((val - globalMin) / yRange) * (height - 2 * padding);

  return (
    <div className="glass p-5 rounded-2xl border border-border/40">
      <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Draw grid limits */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={COLORS.border} strokeWidth="1" />

        {data.map((dataset, idx) => {
          const sorted = [...dataset.values].sort((a, b) => a - b);
          if (sorted.length < 4) return null; // Require at least 4 points to compute quartiles

          const min = sorted[0];
          const max = sorted[sorted.length - 1];

          // Compute quartiles
          const getQuartile = (q: number) => {
            const pos = (sorted.length - 1) * q;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (sorted[base + 1] !== undefined) {
              return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
            }
            return sorted[base];
          };

          const q1 = getQuartile(0.25);
          const median = getQuartile(0.5);
          const q3 = getQuartile(0.75);

          const chartWidth = width - 2 * padding;
          const xCenter = padding + (chartWidth / data.length) * idx + (chartWidth / data.length) / 2;
          const boxWidth = Math.min(40, (chartWidth / data.length) * 0.5);

          const yMin = getY(min);
          const yQ1 = getY(q1);
          const yMedian = getY(median);
          const yQ3 = getY(q3);
          const yMax = getY(max);

          return (
            <g key={idx} className="group">
              {/* Whiskers (lines to min/max) */}
              <line x1={xCenter} y1={yMin} x2={xCenter} y2={yQ1} stroke={COLORS.primary} strokeWidth="1.5" strokeDasharray="3,3" />
              <line x1={xCenter} y1={yQ3} x2={xCenter} y2={yMax} stroke={COLORS.primary} strokeWidth="1.5" strokeDasharray="3,3" />
              
              {/* Cap lines for whiskers */}
              <line x1={xCenter - 8} y1={yMin} x2={xCenter + 8} y2={yMin} stroke={COLORS.primary} strokeWidth="1.5" />
              <line x1={xCenter - 8} y1={yMax} x2={xCenter + 8} y2={yMax} stroke={COLORS.primary} strokeWidth="1.5" />

              {/* Interquartile Range Box */}
              <rect x={xCenter - boxWidth / 2} y={yQ3} width={boxWidth} height={yQ1 - yQ3} fill="var(--muted)" stroke={COLORS.primary} strokeWidth="2" rx="2" className="hover:opacity-85 transition-opacity" />

              {/* Median Line */}
              <line x1={xCenter - boxWidth / 2} y1={yMedian} x2={xCenter + boxWidth / 2} y2={yMedian} stroke={COLORS.success} strokeWidth="2.5" />

              {/* Label */}
              <text x={xCenter} y={height - padding + 16} textAnchor="middle" className="text-[9px] fill-muted-foreground">{dataset.label}</text>

              {/* Box Plot Tooltip on Hover */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                <rect x={xCenter + boxWidth / 2 + 5} y={yMedian - 40} width="85" height="55" rx="4" fill="var(--background)" stroke={COLORS.border} strokeWidth="1" />
                <text x={xCenter + boxWidth / 2 + 10} y={yMedian - 28} className="text-[8px] fill-foreground font-semibold">Max: {max}</text>
                <text x={xCenter + boxWidth / 2 + 10} y={yMedian - 18} className="text-[8px] fill-success font-semibold">Med: {median}</text>
                <text x={xCenter + boxWidth / 2 + 10} y={yMedian - 8} className="text-[8px] fill-foreground font-semibold">Min: {min}</text>
              </g>
            </g>
          );
        })}

        {/* Labels */}
        <text x={10} y={height / 2} textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`} className="text-[10px] fill-muted-foreground">{yLabel}</text>
        <text x={padding - 5} y={padding + 5} textAnchor="end" className="text-[8px] fill-muted-foreground">{globalMax}</text>
        <text x={padding - 5} y={height - padding} textAnchor="end" className="text-[8px] fill-muted-foreground">{globalMin}</text>
      </svg>
    </div>
  );
};
