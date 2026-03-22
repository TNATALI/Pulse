import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface LineChartProps {
  data: { date: string; count: number }[];
  color?: string;
  xLabel?: string;
  yLabel?: string;
  /** Force the x-axis to span this full range (ISO date strings) */
  dateRange?: { start: string; end: string };
}

const MARGIN = { top: 20, right: 20, bottom: 80, left: 55 };
const WIDTH = 500;
const HEIGHT = 300;

export function LineChart({ data, color = '#4f46e5', xLabel, yLabel, dateRange }: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const parsed = data.map((d) => ({ date: new Date(d.date), count: d.count }));

    // X domain: use dateRange if provided, otherwise data extent
    let xDomain: [Date, Date];
    if (dateRange) {
      xDomain = [new Date(dateRange.start), new Date(dateRange.end)];
    } else {
      xDomain = d3.extent(parsed, (d) => d.date) as [Date, Date];
    }

    const x = d3.scaleTime().domain(xDomain).range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.count) ?? 0])
      .nice()
      .range([innerHeight, 0]);

    // Choose tick interval and format based on date span to avoid cramming
    const daySpan = Math.max(1, Math.round((xDomain[1].getTime() - xDomain[0].getTime()) / 86400000));

    let tickInterval: d3.TimeInterval;
    let tickFormat: (d: Date) => string;

    if (daySpan <= 10) {
      // <=10 days: tick every 2 days, show "Jan 15"
      tickInterval = d3.timeDay.every(2) ?? d3.timeDay;
      tickFormat = d3.timeFormat('%b %d');
    } else if (daySpan <= 21) {
      // ~2-3 weeks: tick every 4 days
      tickInterval = d3.timeDay.every(4) ?? d3.timeDay;
      tickFormat = d3.timeFormat('%b %d');
    } else if (daySpan <= 45) {
      // ~1 month: tick weekly, show "Jan 15"
      tickInterval = d3.timeWeek.every(1) ?? d3.timeWeek;
      tickFormat = d3.timeFormat('%b %d');
    } else if (daySpan <= 120) {
      // 1.5-4 months: tick every 2 weeks, show "Jan 15"
      tickInterval = d3.timeWeek.every(2) ?? d3.timeWeek;
      tickFormat = d3.timeFormat('%b %d');
    } else {
      // >4 months: tick monthly, show just month name "Jan"
      tickInterval = d3.timeMonth.every(1) ?? d3.timeMonth;
      tickFormat = d3.timeFormat('%b %Y');
    }

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(x)
          .ticks(tickInterval)
          .tickFormat(tickFormat as any),
      )
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.6em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(-90)');

    g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('font-size', '11px');

    // Area fill
    const area = d3.area<{ date: Date; count: number }>()
      .x((d) => x(d.date))
      .y0(innerHeight)
      .y1((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(parsed)
      .attr('fill', color)
      .attr('fill-opacity', 0.1)
      .attr('d', area);

    // Line
    const line = d3.line<{ date: Date; count: number }>()
      .x((d) => x(d.date))
      .y((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(parsed)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    // Tooltip setup
    const tooltip = tooltipRef.current ? d3.select(tooltipRef.current) : null;

    // Dots with tooltips
    g.selectAll('circle')
      .data(parsed)
      .join('circle')
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.count))
      .attr('r', 3)
      .attr('fill', color)
      .style('cursor', 'default')
      .on('mousemove', function (event, d) {
        d3.select(this).attr('r', 5);
        if (tooltip) {
          const dateStr = d3.timeFormat('%b %d, %Y')(d.date);
          tooltip
            .style('opacity', '1')
            .style('left', `${event.offsetX + 12}px`)
            .style('top', `${event.offsetY - 28}px`)
            .html(`<strong>${dateStr}</strong>: ${d.count.toLocaleString()} messages`);
        }
      })
      .on('mouseleave', function () {
        d3.select(this).attr('r', 3);
        if (tooltip) tooltip.style('opacity', '0');
      });

    // X axis label
    if (xLabel) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#6b7280')
        .text(xLabel);
    }

    // Y axis label
    if (yLabel) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -42)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#6b7280')
        .text(yLabel);
    }
  }, [data, color, xLabel, yLabel, dateRange]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400">No data</div>;
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
        className="absolute pointer-events-none bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 transition-opacity whitespace-nowrap"
        style={{ zIndex: 10 }}
      />
    </div>
  );
}
