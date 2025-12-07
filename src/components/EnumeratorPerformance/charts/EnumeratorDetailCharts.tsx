import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { IconMoodSmile } from '@tabler/icons-react';
import { EnumeratorData } from '../types';
import {
  baseTooltipConfig,
  wrapTooltip,
  formatTooltipHeader,
  chartColors
} from '../utils/chartConfig';

interface AlertDistributionChartProps {
  selectedEnumeratorData: EnumeratorData;
}

export const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({
  selectedEnumeratorData
}) => {
  const submissions = selectedEnumeratorData.filteredSubmissions || selectedEnumeratorData.submissions;
  const alertDistribution = submissions.reduce((counts: Record<string, number>, submission) => {
    if (submission.alert_flag && submission.alert_flag !== "NA") {
      counts[submission.alert_flag] = (counts[submission.alert_flag] || 0) + 1;
    }
    return counts;
  }, {});

  const alertData = Object.entries(alertDistribution)
    .map(([label, count]) => ({ name: label, y: count }))
    .sort((a, b) => b.y - a.y);

  const totalAlerts = alertData.reduce((sum, item) => sum + item.y, 0);

  // Empty state
  if (alertData.length === 0) {
    return (
      <div className="empty py-4">
        <div className="empty-icon">
          <IconMoodSmile size={36} stroke={1.5} className="text-green" />
        </div>
        <p className="empty-title h4">No alerts</p>
        <p className="empty-subtitle text-secondary">
          This enumerator has no flagged submissions in the selected period.
        </p>
      </div>
    );
  }

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      height: 320,
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: `${totalAlerts} alert${totalAlerts !== 1 ? 's' : ''} total`,
      style: { fontSize: '12px', color: '#666' }
    },
    tooltip: {
      ...baseTooltipConfig,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: function(this: any) {
        const point = this.point;
        return wrapTooltip(
          formatTooltipHeader(`Alert: ${point.name}`) +
          `<div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span style="color: #666;">Count:</span>
            <span style="font-weight: 600;">${point.y}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span style="color: #666;">Share:</span>
            <span style="font-weight: 600;">${point.percentage.toFixed(1)}%</span>
          </div>`
        );
      }
    },
    accessibility: { point: { valueSuffix: '%' } },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        borderRadius: 3,
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f}%',
          style: { fontSize: '10px' }
        },
        size: '85%'
      }
    },
    series: [{
      name: 'Alerts',
      type: 'pie',
      data: alertData
    }],
    legend: { enabled: false },
    credits: { enabled: false }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

interface EnumeratorTrendChartProps {
  selectedEnumeratorData: EnumeratorData;
}

export const EnumeratorTrendChart: React.FC<EnumeratorTrendChartProps> = ({
  selectedEnumeratorData
}) => {
  const trendData = selectedEnumeratorData?.submissionTrend || [];

  // Filter dates by selected date range
  const filteredDates = trendData
    .filter(t => {
      const datePart = t.date.includes('T') ? t.date.split('T')[0] : t.date.split(' ')[0];
      return selectedEnumeratorData.filteredSubmissions?.some(s => {
        if (!s.submission_date) return false;
        const sDate = s.submission_date.includes('T') ? s.submission_date.split('T')[0] : s.submission_date.split(' ')[0];
        return sDate === datePart;
      });
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Format dates
  const categories = filteredDates.map(item => {
    const d = new Date(item.date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  });

  const data = filteredDates.map(item => item.count);
  const tickInterval = Math.max(1, Math.floor(categories.length / 8));
  const totalSubmissions = data.reduce((sum, val) => sum + val, 0);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      height: 320,
      zoomType: 'x',
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: `${totalSubmissions} submission${totalSubmissions !== 1 ? 's' : ''} over ${data.length} day${data.length !== 1 ? 's' : ''}`,
      style: { fontSize: '12px', color: '#666' }
    },
    xAxis: {
      categories,
      title: { text: null },
      labels: {
        rotation: -45,
        style: { fontSize: '10px' },
        step: tickInterval
      },
      crosshair: {
        width: 1,
        color: '#dee2e6'
      }
    },
    yAxis: {
      title: { text: 'Submissions' },
      min: 0,
      allowDecimals: false
    },
    tooltip: {
      ...baseTooltipConfig,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: function(this: any) {
        // Get formatted date from category axis
        const dateLabel = this.key || 
          (typeof this.x === 'string' ? this.x : this.chart.xAxis[0].categories[this.x]);
        const value = this.y || 0;
        return wrapTooltip(
          formatTooltipHeader(String(dateLabel)) +
          `<div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span style="color: #666;">Submissions:</span>
            <span style="font-weight: 600;">${value}</span>
          </div>`
        );
      }
    },
    plotOptions: {
      column: {
        borderRadius: 3,
        dataLabels: {
          enabled: data.length <= 20,
          format: '{y}',
          style: { fontSize: '10px', fontWeight: '500' }
        },
        color: chartColors.primary
      }
    },
    series: [{
      name: 'Submissions',
      type: 'column',
      data
    }],
    legend: { enabled: false },
    credits: { enabled: false }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
}; 