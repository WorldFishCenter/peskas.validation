import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';
import {
  baseTooltipConfig,
  formatTooltipHeader,
  formatTooltipRow,
  formatStatRow,
  wrapTooltip,
  chartColors
} from '../utils/chartConfig';

interface QualityRankingChartProps {
  enumerators: EnumeratorData[];
}

const QualityRankingChart: React.FC<QualityRankingChartProps> = ({
  enumerators
}) => {
  // Filter and sort once
  const sortedEnumerators = enumerators
    .filter(e => {
      const total = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
      return total > 0;
    })
    .sort((a, b) => {
      const aRate = a.filteredErrorRate ?? a.errorRate;
      const bRate = b.filteredErrorRate ?? b.errorRate;
      return aRate - bRate; // Best quality first
    });

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      height: Math.max(450, sortedEnumerators.length * 32),
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    xAxis: {
      categories: sortedEnumerators.map(e => e.name),
      title: { text: null },
      labels: { style: { fontSize: '12px' } }
    },
    yAxis: [{
      title: { text: 'Quality Score (%)' },
      min: 0,
      max: 100,
      labels: { format: '{value}%' }
    }, {
      title: { text: 'Submissions' },
      min: 0,
      opposite: true
    }],
    tooltip: {
      ...baseTooltipConfig,
      shared: true,
      formatter: function() {
        const name = String(this.x);
        const enumerator = sortedEnumerators.find(e => e.name === name);

        if (!enumerator) return wrapTooltip(formatTooltipHeader(name) + '<span style="color:#888;">No data</span>');

        const total = enumerator.filteredTotal ?? enumerator.totalSubmissions;
        const alerts = enumerator.filteredAlertsCount ?? enumerator.submissionsWithAlerts;
        const cleanCount = Math.max(0, total - alerts);
        const qualityScore = (100 - (enumerator.filteredErrorRate ?? enumerator.errorRate)).toFixed(1);

        return wrapTooltip(
          formatTooltipHeader(name) +
          formatTooltipRow(chartColors.success, 'Quality Score', qualityScore, '%') +
          formatTooltipRow(chartColors.info, 'Submissions', total) +
          `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee;">` +
          formatStatRow('Clean submissions', cleanCount) +
          formatStatRow('With alerts', alerts) +
          `</div>`
        );
      }
    },
    plotOptions: {
      bar: {
        borderRadius: 3,
        dataLabels: {
          enabled: true,
          style: { fontSize: '10px', fontWeight: '500' }
        },
        grouping: true
      }
    },
    series: [{
      name: 'Quality Score',
      type: 'bar',
      data: sortedEnumerators.map(e => {
        const rate = e.filteredErrorRate ?? e.errorRate;
        return parseFloat((100 - rate).toFixed(1));
      }),
      color: chartColors.success,
      dataLabels: { format: '{y}%' }
    }, {
      name: 'Submissions',
      type: 'bar',
      data: sortedEnumerators.map(e => e.filteredTotal || e.totalSubmissions),
      color: chartColors.info,
      yAxis: 1,
      opacity: 0.8,
      dataLabels: { format: '{y}' }
    }],
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'top',
      floating: false,
      itemStyle: { fontSize: '12px' }
    },
    credits: { enabled: false }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default QualityRankingChart; 