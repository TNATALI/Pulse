import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { ScorecardTrendPoint } from '@pulse/shared';

interface Props {
  points: ScorecardTrendPoint[];
  selectedDate: string | null;
  onSelect: (point: ScorecardTrendPoint) => void;
}

const MARGIN = { top: 20, right: 24, bottom: 90, left: 48 };
const WIDTH = 700;
const HEIGHT = 260;

/** Format a YYYY-MM-DD string as MM-DD-YYYY */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

function scoreColor(score: number): string {
  if (score >= 8) return '#16a34a'; // green
  if (score >= 5) return '#d97706'; // amber
  return '#dc2626';                 // red
}

export function ScorecardTrendChart({ points, selectedDate, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Render newest-last so the line reads left→right as oldest→newest
  const chronological = [...points].reverse();

  useEffect(() => {
    if (!svgRef.current || chronological.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerW = WIDTH - MARGIN.left - MARGIN.right;
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // ── Scales ───────────────────────────────────────────────────────────────
    const x = d3
      .scalePoint<string>()
      .domain(chronological.map((p) => p.runDate))
      .range([0, innerW])
      .padding(0.3);

    const y = d3.scaleLinear().domain([0, 10]).range([innerH, 0]);

    // ── Grid lines ───────────────────────────────────────────────────────────
    g.append('g')
      .attr('stroke', '#f3f4f6')
      .attr('stroke-width', 1)
      .selectAll('line')
      .data(y.ticks(5))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d));

    // ── X axis — thin labels so they fit vertically ───────────────────────
    const n = chronological.length;
    // Show at most ~10 labels; compute step so they're evenly spaced
    const step = Math.max(1, Math.ceil(n / 10));
    const labelDates = chronological
      .filter((_, i) => i % step === 0 || i === n - 1)
      .map((p) => p.runDate);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(labelDates)
          .tickFormat((d) => fmtDate(d as string)),
      )
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(-90)');

    // ── Y axis ────────────────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}`))
      .selectAll('text')
      .attr('font-size', '11px');

    // Y label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280')
      .text('Score (0–10)');

    // ── Area fill ─────────────────────────────────────────────────────────────
    const area = d3
      .area<ScorecardTrendPoint>()
      .x((d) => x(d.runDate)!)
      .y0(innerH)
      .y1((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chronological)
      .attr('fill', '#4f46e5')
      .attr('fill-opacity', 0.07)
      .attr('d', area);

    // ── Line ─────────────────────────────────────────────────────────────────
    const line = d3
      .line<ScorecardTrendPoint>()
      .x((d) => x(d.runDate)!)
      .y((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chronological)
      .attr('fill', 'none')
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 2)
      .attr('d', line);

    // ── Selection vertical line ───────────────────────────────────────────────
    if (selectedDate) {
      const sx = x(selectedDate);
      if (sx !== undefined) {
        g.append('line')
          .attr('x1', sx)
          .attr('x2', sx)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', '#4f46e5')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '4,3')
          .attr('opacity', 0.5);
      }
    }

    // ── Dots ─────────────────────────────────────────────────────────────────
    const tooltip = tooltipRef.current ? d3.select(tooltipRef.current) : null;

    g.selectAll('circle')
      .data(chronological)
      .join('circle')
      .attr('cx', (d) => x(d.runDate)!)
      .attr('cy', (d) => y(d.score))
      .attr('r', (d) => (d.runDate === selectedDate ? 6 : 4))
      .attr('fill', (d) => scoreColor(d.score))
      .attr('stroke', (d) => (d.runDate === selectedDate ? '#fff' : 'none'))
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mousemove', function (event, d) {
        d3.select(this).attr('r', 7);
        if (tooltip) {
          tooltip
            .style('opacity', '1')
            .style('left', `${event.offsetX + 12}px`)
            .style('top', `${event.offsetY - 32}px`)
            .html(
              `<strong>${fmtDate(d.runDate)}</strong><br/>Score: ${d.score}${d.isOfficial ? '' : ' (est.)'}`,
            );
        }
      })
      .on('mouseleave', function (_, d) {
        d3.select(this).attr('r', d.runDate === selectedDate ? 6 : 4);
        if (tooltip) tooltip.style('opacity', '0');
      })
      .on('click', (_, d) => onSelect(d));
  }, [chronological, selectedDate, onSelect]);

  if (chronological.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No Scorecard data found
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-gray-800 text-white text-xs rounded px-2 py-1.5 opacity-0 transition-opacity whitespace-nowrap leading-relaxed"
        style={{ zIndex: 10 }}
      />
    </div>
  );
}
