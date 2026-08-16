import { useState } from "react";
import type { Bucket } from "../../utils/dateBuckets";
import {
  CHART_H,
  CHART_W,
  PAD_BOTTOM,
  PAD_LEFT,
  PAD_RIGHT,
  PAD_TOP,
  shouldShowXLabel,
} from "../../utils/chart";
import { ChartTooltip, type TooltipState } from "./ChartTooltip";

interface CleanRateChartProps {
  buckets: Bucket[];
}

interface Point {
  index: number;
  rate: number | null;
  label: string;
  shortLabel: string;
}

export function CleanRateChart({ buckets }: CleanRateChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baselineY = PAD_TOP + plotH;
  const slot = plotW / buckets.length;

  const points: Point[] = buckets.map((bucket, i) => ({
    index: i,
    rate: bucket.count > 0 ? (bucket.cleanCount / bucket.count) * 100 : null,
    label: bucket.label,
    shortLabel: bucket.shortLabel,
  }));

  const xFor = (i: number) => PAD_LEFT + slot * i + slot / 2;
  const yFor = (rate: number) => baselineY - (rate / 100) * plotH;

  const segments: Point[][] = [];
  let current: Point[] = [];
  points.forEach((point) => {
    if (point.rate === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  });
  if (current.length) segments.push(current);

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Clean sentence rate over time"
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
                {Math.round(fraction * 100)}%
              </text>
            </g>
          );
        })}

        {segments.map((segment, segIndex) => {
          const linePath = segment
            .map((point, idx) => `${idx === 0 ? "M" : "L"} ${xFor(point.index)} ${yFor(point.rate as number)}`)
            .join(" ");
          const areaPath =
            segment.length > 1
              ? `M ${xFor(segment[0].index)} ${baselineY} ` +
                segment.map((point) => `L ${xFor(point.index)} ${yFor(point.rate as number)}`).join(" ") +
                ` L ${xFor(segment[segment.length - 1].index)} ${baselineY} Z`
              : "";

          return (
            <g key={segIndex}>
              {segment.length > 1 ? (
                <>
                  <path d={areaPath} fill="var(--mantine-color-success-5)" opacity={0.12} stroke="none" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--mantine-color-success-6)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
              {segment.map((point, idx) => {
                const isEnd = idx === segment.length - 1;
                return (
                  <g key={point.index}>
                    <circle
                      cx={xFor(point.index)}
                      cy={yFor(point.rate as number)}
                      r={isEnd ? 5 : 3}
                      fill="var(--mantine-color-success-6)"
                      stroke="var(--mantine-color-white)"
                      strokeWidth={2}
                    />
                    {isEnd ? (
                      <text
                        x={xFor(point.index)}
                        y={yFor(point.rate as number) - 10}
                        fontSize={11}
                        fontWeight={700}
                        textAnchor="middle"
                        fill="var(--mantine-color-text)"
                      >
                        {Math.round(point.rate as number)}%
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}

        {hoverIndex !== null ? (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PAD_TOP}
            y2={baselineY}
            stroke="var(--mantine-color-gray-4)"
            strokeWidth={1}
          />
        ) : null}

        {points.map((point, i) => (
          <g key={point.index}>
            {shouldShowXLabel(i, points.length) ? (
              <text
                x={xFor(i)}
                y={CHART_H - 6}
                fontSize={10}
                textAnchor="middle"
                fill="var(--mantine-color-dimmed)"
              >
                {point.shortLabel}
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
                  value: point.rate === null ? "No practice" : `${Math.round(point.rate)}% clean`,
                  label: point.label,
                });
              }}
              onMouseMove={(event) =>
                setTooltip({
                  x: event.clientX,
                  y: event.clientY,
                  value: point.rate === null ? "No practice" : `${Math.round(point.rate)}% clean`,
                  label: point.label,
                })
              }
              onMouseLeave={() => {
                setHoverIndex(null);
                setTooltip(null);
              }}
            />
          </g>
        ))}
      </svg>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
