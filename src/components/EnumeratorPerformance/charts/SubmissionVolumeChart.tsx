import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';
import {
  baseTooltipConfig,
  formatTooltipHeader,
  formatStatRow,
  wrapTooltip,
  chartColors
} from '../utils/chartConfig';

interface SubmissionVolumeChartProps {
  enumerators: EnumeratorData[];
  onEnumeratorSelect: (name: string) => void;
}

const SubmissionVolumeChart: React.FC<SubmissionVolumeChartProps> = ({
  enumerators,
  onEnumeratorSelect
}) => {
  // Filter out enumerators with no submissions in the selected timeframe
  const filteredEnumerators = enumerators.filter(e => {
    const total = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
    return total > 0;
  });

  // Sort once for consistency
  const sortedEnumerators = [...filteredEnumerators].sort(
    (a, b) => (b.filteredTotal || b.totalSubmissions) - (a.filteredTotal || a.totalSubmissions)
  );

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      height: Math.max(400, sortedEnumerators.length * 28),
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    xAxis: {
      categories: sortedEnumerators.map(e => e.name),
      title: { text: null },
      labels: {
        style: { fontSize: '12px' }
      }
    },
    yAxis: {
      title: { text: 'Submissions' },
      min: 0
    },
    tooltip: {
      ...baseTooltipConfig,
      formatter: function() {
        const name = String(this.x);
        const enumerator = sortedEnumerators.find(e => e.name === name);
        const errorRate = enumerator?.filteredErrorRate ?? enumerator?.errorRate ?? 0;
        const qualityScore = (100 - errorRate).toFixed(1);

        return wrapTooltip(
          formatTooltipHeader(name) +
          formatStatRow('Submissions', this.y || 0) +
          formatStatRow('Quality Score', qualityScore, '%') +
          `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee; font-size: 11px; color: #888;">
            Click to view details
          </div>`
        );
      }
    },
    plotOptions: {
      bar: {
        cursor: 'pointer',
        borderRadius: 3,
        point: {
          events: {
            click: function(this: Highcharts.Point) {
              const category = this.category as string;
              onEnumeratorSelect(category);
              setTimeout(() => {
                const detailSection = document.getElementById('enumerator-detail');
                if (detailSection) {
                  detailSection.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
          }
        },
        dataLabels: {
          enabled: true,
          format: '{y}',
          style: { fontSize: '11px', fontWeight: '500' }
        },
        color: chartColors.primary
      }
    },
    series: [{
      name: 'Submissions',
      type: 'bar',
      data: sortedEnumerators.map(e => e.filteredTotal || e.totalSubmissions)
    }],
    legend: { enabled: false },
    credits: { enabled: false }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default SubmissionVolumeChart; 