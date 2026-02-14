import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface BarChartProps {
  data: { label: string; value: number }[];
  orientation?: 'vertical' | 'horizontal';
  color?: string;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };
const WIDTH = 500;
const HEIGHT = 300;

export function BarChart({ data, orientation = 'vertical', color = '#4f46e5' }: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    if (orientation === 'vertical') {
      const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, innerWidth]).padding(0.3);
      const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) ?? 0]).nice().range([innerHeight, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('font-size', '11px');

      g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('font-size', '11px');

      g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', (d) => x(d.label)!)
        .attr('y', (d) => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', (d) => innerHeight - y(d.value))
        .attr('fill', color)
        .attr('rx', 2);
    } else {
      const leftMargin = Math.min(
        150,
        Math.max(60, d3.max(data, (d) => d.label.length * 7) ?? 60)
      );
      const adjustedWidth = WIDTH - leftMargin - MARGIN.right;

      const g2 = svg.selectAll('g').remove();
      const gH = svg.append('g').attr('transform', `translate(${leftMargin},${MARGIN.top})`);

      const y = d3.scaleBand().domain(data.map((d) => d.label)).range([0, innerHeight]).padding(0.3);
      const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) ?? 0]).nice().range([0, adjustedWidth]);

      gH.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5))
        .selectAll('text')
        .attr('font-size', '11px');

      gH.append('g').call(d3.axisLeft(y)).selectAll('text').attr('font-size', '11px');

      gH.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', 0)
        .attr('y', (d) => y(d.label)!)
        .attr('width', (d) => x(d.value))
        .attr('height', y.bandwidth())
        .attr('fill', color)
        .attr('rx', 2);
    }
  }, [data, orientation, color]);

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
