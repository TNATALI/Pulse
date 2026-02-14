import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface LineChartProps {
  data: { date: string; count: number }[];
  color?: string;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };
const WIDTH = 500;
const HEIGHT = 300;

export function LineChart({ data, color = '#4f46e5' }: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const parsed = data.map((d) => ({ date: new Date(d.date), count: d.count }));

    const x = d3.scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.count) ?? 0])
      .nice()
      .range([innerHeight, 0]);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %d') as any))
      .selectAll('text')
      .attr('font-size', '11px');

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

    // Dots
    g.selectAll('circle')
      .data(parsed)
      .join('circle')
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.count))
      .attr('r', 3)
      .attr('fill', color);
  }, [data, color]);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-400">No data</div>;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
