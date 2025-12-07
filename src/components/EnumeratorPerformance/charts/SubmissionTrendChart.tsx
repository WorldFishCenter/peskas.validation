import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';
import { baseTooltipConfig, formatTooltipHeader, wrapTooltip } from '../utils/chartConfig';

interface SubmissionTrendChartProps {
  enumerators: EnumeratorData[];
  uniqueDates: string[];
}

const SubmissionTrendChart: React.FC<SubmissionTrendChartProps> = ({
  enumerators,
  uniqueDates
}) => {
  // Filter enumerators with submissions
  const filteredEnumerators = enumerators.filter(e => {
    const total = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
    return total > 0;
  });

  // Sort dates chronologically
  const sortedDates = [...uniqueDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Format dates for display
  const formattedDates = sortedDates.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  });

  const tickInterval = Math.max(1, Math.floor(sortedDates.length / 10));

  // Get top 10 enumerators
  const topEnumerators = [...filteredEnumerators]
    .sort((a, b) => {
      const aTotal = a.filteredTotal ?? a.totalSubmissions;
      const bTotal = b.filteredTotal ?? b.totalSubmissions;
      return bTotal - aTotal;
    })
    .slice(0, 10);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'line',
      height: 500,
      zoomType: 'x',
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: sortedDates.length > 30 ? 'Drag to zoom into a specific period' : undefined,
      style: { fontSize: '12px', color: '#888' }
    },
    xAxis: {
      categories: formattedDates,
      title: { text: null },
      labels: {
        rotation: -45,
        style: { fontSize: '11px' },
        step: tickInterval
      },
      crosshair: {
        width: 1,
        color: '#dee2e6',
        dashStyle: 'Dash'
      }
    },
    yAxis: {
      title: { text: 'Submissions' },
      min: 0
    },
    tooltip: {
      ...baseTooltipConfig,
      shared: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: function(this: any) {
        const points = this.points || [];
        const activePoints = points.filter((p: any) => (p.y || 0) > 0);

        // Get formatted date from category axis (more reliable than this.x)
        const dateLabel = points.length > 0 
          ? (points[0].key || this.chart.xAxis[0].categories[points[0].x])
          : (typeof this.x === 'string' ? this.x : this.chart.xAxis[0].categories[this.x]);

        if (activePoints.length === 0) {
          return wrapTooltip(
            formatTooltipHeader(String(dateLabel)) +
            '<span style="color: #888;">No submissions on this date</span>'
          );
        }

        let content = formatTooltipHeader(String(dateLabel));
        const total = activePoints.reduce((sum: number, p: any) => sum + (p.y || 0), 0);

        activePoints
          .sort((a: any, b: any) => (b.y || 0) - (a.y || 0))
          .forEach((point: any) => {
            const value = point.y || 0;
            content += `<div style="display: flex; align-items: center; margin: 3px 0;">
              <span style="color: ${point.series.color}; font-size: 14px; margin-right: 6px;">●</span>
              <span style="flex: 1;">${point.series.name}</span>
              <span style="font-weight: 600; margin-left: 8px;">${value}</span>
            </div>`;
          });

        content += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee; display: flex; justify-content: space-between;">
          <span style="color: #666;">Total:</span>
          <span style="font-weight: 600;">${total} submission${total !== 1 ? 's' : ''}</span>
        </div>`;

        return wrapTooltip(content);
      }
    },
    legend: {
      enabled: true,
      layout: 'horizontal',
      align: 'center',
      verticalAlign: 'bottom',
      maxHeight: 80,
      itemStyle: { fontSize: '11px' }
    },
    plotOptions: {
      line: {
        lineWidth: 2,
        marker: {
          enabled: sortedDates.length < 30,
          radius: 3
        },
        connectNulls: false
      }
    },
    series: topEnumerators.map(enumerator => {
      const dateCounts = enumerator.submissionTrend.reduce((acc: Record<string, number>, item) => {
        acc[item.date] = item.count;
        return acc;
      }, {});

      const data = sortedDates.map(date => dateCounts[date] || 0);
      const seriesTotal = data.reduce((sum, value) => sum + value, 0);

      return {
        name: enumerator.name,
        type: 'line' as const,
        data,
        visible: seriesTotal > 0
      };
    }),
    credits: { enabled: false }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default SubmissionTrendChart; 