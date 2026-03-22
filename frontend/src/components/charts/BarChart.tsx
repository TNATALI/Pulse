import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface BarChartProps {
  data: { label: string; value: number }[];
  orientation?: 'vertical' | 'horizontal';
  color?: string;
  xLabel?: string;
  yLabel?: string;
  tickInterval?: number;
}

const MARGIN = { top: 20, right: 20, bottom: 120, left: 55 };
const WIDTH = 640;
const HEIGHT = 380;

export function BarChart({
  data,
  orientation = 'vertical',
  color = '#4f46e5',
  xLabel,
  yLabel,
  tickInterval,
}: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const tooltip = tooltipRef.current ? d3.select(tooltipRef.current) : null;

    function showTooltip(event: MouseEvent, label: string, value: number) {
      if (!tooltip) return;
      tooltip
        .style('opacity', '1')
        .style('left', `${event.offsetX + 12}px`)
        .style('top', `${event.offsetY - 28}px`)
        .html(`<strong>${label}</strong>: ${value.toLocaleString()}`);
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.style('opacity', '0');
    }

    if (orientation === 'vertical') {
      const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, innerWidth]).padding(0.3);
      const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) ?? 0]).nice().range([innerHeight, 0]);

      // X axis — auto-compute tick interval so labels never crowd each other.
      // Each rotated label needs ~40px of vertical space; if the caller passes
      // an explicit tickInterval that is stricter, honour that instead.
      const autoInterval = Math.ceil(data.length / Math.floor(innerWidth / 40));
      const effectiveInterval = Math.max(autoInterval, tickInterval && tickInterval > 1 ? tickInterval : 1);
      const xAxis = d3.axisBottom(x);
      if (effectiveInterval > 1) {
        xAxis.tickValues(
          data
            .filter((_, i) => i % effectiveInterval === 0)
            .map((d) => d.label),
        );
      }
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .attr('font-size', '11px')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.6em')
        .attr('dy', '0.15em')
        .attr('transform', 'rotate(-90)');

      // Y axis
      g.append('g').call(d3.axisLeft(y).ticks(5)).selectAll('text').attr('font-size', '11px');

      // Bars with tooltip
      g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', (d) => x(d.label)!)
        .attr('y', (d) => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', (d) => innerHeight - y(d.value))
        .attr('fill', color)
        .attr('rx', 2)
        .style('cursor', 'default')
        .on('mousemove', function (event, d) {
          d3.select(this).attr('fill-opacity', 0.8);
          showTooltip(event, d.label, d.value);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('fill-opacity', 1);
          hideTooltip();
        });

      // X axis label — placed at the very bottom of the margin area,
      // clear of the rotated tick labels which extend ~80px below the axis.
      if (xLabel) {
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight + MARGIN.bottom - 8)
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
    } else {
      const leftMargin = Math.min(
        150,
        Math.max(60, d3.max(data, (d) => d.label.length * 7) ?? 60),
      );
      const adjustedWidth = WIDTH - leftMargin - MARGIN.right;

      svg.selectAll('g').remove();
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
        .attr('rx', 2)
        .style('cursor', 'default')
        .on('mousemove', function (event, d) {
          d3.select(this).attr('fill-opacity', 0.8);
          showTooltip(event, d.label, d.value);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('fill-opacity', 1);
          hideTooltip();
        });

      // X axis label
      if (xLabel) {
        gH.append('text')
          .attr('x', adjustedWidth / 2)
          .attr('y', innerHeight + 40)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', '#6b7280')
          .text(xLabel);
      }

      // Y axis label
      if (yLabel) {
        gH.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -innerHeight / 2)
          .attr('y', -leftMargin + 14)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', '#6b7280')
          .text(yLabel);
      }
    }
  }, [data, orientation, color, xLabel, yLabel, tickInterval]);

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
