import { useState } from "react";
import type { Bucket } from "../../utils/dateBuckets";
import {
  CHART_H,
  CHART_W,
  PAD_BOTTOM,
  PAD_LEFT,
  PAD_RIGHT,
  PAD_TOP,
  niceMax,
  roundedTopPath,
  shouldShowXLabel,
} from "../../utils/chart";
import { ChartTooltip, type TooltipState } from "./ChartTooltip";

interface ActivityChartProps {
  buckets: Bucket[];
}

export function ActivityChart({ buckets }: ActivityChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + plotH;
  const maxCount = niceMax(Math.max(0, ...buckets.map((bucket) => bucket.count)));
  const slot = plotW / buckets.length;
  const barW = Math.min(24, slot * 0.6);

  let peakIndex = 0;
  buckets.forEach((bucket, i) => {
    if (bucket.count > buckets[peakIndex].count) peakIndex = i;
  });

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Turns practiced per period"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = baselineY - plotH * fraction;
          return (
            <g key={fraction}>
              <line
                x1={PAD_LEFT}
                x2={CHART_W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--mantine-color-gray-3)"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 8}
                y={y + 4}
                fontSize={10}
                textAnchor="end"
                fill="var(--mantine-color-dimmed)"
              >
                {Math.round(maxCount * fraction)}
              </text>
            </g>
          );
        })}

        {buckets.map((bucket, i) => {
          const cx = PAD_LEFT + slot * i + slot / 2;
          const barHeight = maxCount > 0 ? (bucket.count / maxCount) * plotH : 0;
          const x = cx - barW / 2;
          const yTop = baselineY - barHeight;

          return (
            <g key={bucket.label}>
              {bucket.count > 0 ? (
                <path
                  d={roundedTopPath(x, yTop, barW, barHeight, 4)}
                  fill={
                    hoverIndex === i
                      ? "var(--mantine-color-teal-7)"
                      : "var(--mantine-color-teal-5)"
                  }
                />
              ) : null}
              {i === peakIndex && bucket.count > 0 ? (
                <text
                  x={cx}
                  y={yTop - 6}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                  fill="var(--mantine-color-text)"
                >
                  {bucket.count}
                </text>
              ) : null}
              {shouldShowXLabel(i, buckets.length) ? (
                <text
                  x={cx}
                  y={CHART_H - 6}
                  fontSize={10}
                  textAnchor="middle"
                  fill="var(--mantine-color-dimmed)"
                >
                  {bucket.shortLabel}
                </text>
              ) : null}
              <rect
                x={PAD_LEFT + slot * i}
                y={PAD_TOP}
                width={slot}
                height={plotH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={(event) => {
                  setHoverIndex(i);
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    value: `${bucket.count} turn${bucket.count === 1 ? "" : "s"}`,
                    label: bucket.label,
                  });
                }}
                onMouseMove={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    value: `${bucket.count} turn${bucket.count === 1 ? "" : "s"}`,
                    label: bucket.label,
                  })
                }
                onMouseLeave={() => {
                  setHoverIndex(null);
                  setTooltip(null);
                }}
              />
            </g>
          );
        })}
      </svg>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
