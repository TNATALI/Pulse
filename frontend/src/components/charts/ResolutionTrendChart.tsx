import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface Props {
  data: { week: string; avgDays: number }[];
}

const MARGIN = { top: 24, right: 20, bottom: 60, left: 48 };
const WIDTH = 500;
const HEIGHT = 220;

function fmtWeek(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${m}/${d}`;
}

export function ResolutionTrendChart({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const iW = WIDTH - MARGIN.left - MARGIN.right;
    const iH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const x = d3.scalePoint<string>().domain(data.map((d) => d.week)).range([0, iW]).padding(0.3);
    const yMax = d3.max(data, (d) => d.avgDays) ?? 10;
    const y = d3.scaleLinear().domain([0, yMax * 1.15]).nice().range([iH, 0]);

    // Grid lines
    g.append('g')
      .attr('stroke', '#f3f4f6')
      .selectAll('line')
      .data(y.ticks(4))
      .join('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d));

    // X axis
    const n = data.length;
    const step = Math.max(1, Math.ceil(n / 8));
    const labelWeeks = data.filter((_, i) => i % step === 0 || i === n - 1).map((d) => d.week);
    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickValues(labelWeeks).tickFormat((d) => fmtWeek(d as string)))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em').attr('dy', '0.15em')
      .attr('transform', 'rotate(-45)');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}d`))
      .selectAll('text').attr('font-size', '11px');

    // Y label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -iH / 2).attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px').attr('fill', '#6b7280')
      .text('Avg days to close');

    // Trend direction annotation
    if (data.length >= 2) {
      const first = data[0].avgDays;
      const last = data[data.length - 1].avgDays;
      const improving = last < first;
      g.append('text')
        .attr('x', iW)
        .attr('y', -8)
        .attr('text-anchor', 'end')
        .attr('font-size', '11px')
        .attr('fill', improving ? '#16a34a' : '#d97706')
        .text(improving ? '↘ Resolving faster' : '↗ Trending up');
    }

    // Area
    const area = d3.area<{ week: string; avgDays: number }>()
      .x((d) => x(d.week)!)
      .y0(iH).y1((d) => y(d.avgDays))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', '#4f46e5')
      .attr('fill-opacity', 0.07)
      .attr('d', area);

    // Line
    const line = d3.line<{ week: string; avgDays: number }>()
      .x((d) => x(d.week)!)
      .y((d) => y(d.avgDays))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Dots + tooltip
    const tooltip = tooltipRef.current ? d3.select(tooltipRef.current) : null;
    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(d.week)!)
      .attr('cy', (d) => y(d.avgDays))
      .attr('r', 4)
      .attr('fill', '#4f46e5')
      .style('cursor', 'default')
      .on('mousemove', function (event, d) {
        d3.select(this).attr('r', 6);
        if (tooltip) {
          tooltip.style('opacity', '1')
            .style('left', `${event.offsetX + 12}px`)
            .style('top', `${event.offsetY - 28}px`)
            .html(`<strong>Week of ${fmtWeek(d.week)}</strong><br/>Avg: ${d.avgDays}d`);
        }
      })
      .on('mouseleave', function () {
        d3.select(this).attr('r', 4);
        if (tooltip) tooltip.style('opacity', '0');
      });
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No closed issues in this period.
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
