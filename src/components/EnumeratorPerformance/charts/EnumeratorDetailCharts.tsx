import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { IconMoodSmile } from '@tabler/icons-react';
import { EnumeratorData } from '../types';
import {
  pieTooltipConfig,
  columnTooltipConfig,
  wrapTooltip,
  formatTooltipHeader,
  formatTooltipRow,
  formatStatRow,
  chartColors
} from '../utils/chartConfig';

interface AlertDistributionChartProps {
  selectedEnumeratorData: EnumeratorData;
}

export const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({
  selectedEnumeratorData
}) => {
  const { t } = useTranslation('enumerators');
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
        <p className="empty-title h4">{t('charts.noAlertsTitle')}</p>
        <p className="empty-subtitle text-secondary">
          {t('charts.noAlertsEnumerator')}
        </p>
      </div>
    );
  }

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'pie',
      height: 320,
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: totalAlerts === 1 ? t('charts.alertCount', { count: totalAlerts }) : t('charts.alertCountPlural', { count: totalAlerts }),
      style: { fontSize: '12px', color: '#666' }
    },
    tooltip: {
      ...pieTooltipConfig,
      formatter: function(this: any) {
        const point = this.point;
        const totalAlerts = this.series.data.reduce((sum: number, p: any) => sum + (p.y || 0), 0);
        const alertText = totalAlerts === 1 ? t('charts.alertCount', { count: totalAlerts }) : t('charts.alertCountPlural', { count: totalAlerts });

        return wrapTooltip(
          formatTooltipHeader(`${t('charts.alertType')}${point.name}`) +
          formatTooltipRow(point.color, t('charts.count'), point.y, '') +
          formatStatRow(t('charts.percentage'), `${point.percentage.toFixed(1)}%`) +
          formatStatRow(t('charts.outOfTotal'), alertText)
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
      name: t('charts.tabs.alerts'),
      type: 'pie',
      data: alertData
    }],
    legend: { enabled: false },
    credits: { enabled: false }
  }), [alertData, totalAlerts, t]);

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

interface EnumeratorTrendChartProps {
  selectedEnumeratorData: EnumeratorData;
}

export const EnumeratorTrendChart: React.FC<EnumeratorTrendChartProps> = ({
  selectedEnumeratorData
}) => {
  const { t } = useTranslation('enumerators');
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

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'column',
      height: 320,
      zoomType: 'x',
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: totalSubmissions === 1 && data.length === 1
        ? t('charts.submissionsOverDays', { count: totalSubmissions, days: data.length })
        : t('charts.submissionsOverDaysPlural', { count: totalSubmissions, days: data.length }),
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
      title: { text: t('charts.submissions') },
      min: 0,
      allowDecimals: false
    },
    tooltip: {
      ...columnTooltipConfig,
      formatter: function(this: any) {
        // Get formatted date from category axis
        const dateLabel = this.key || 
          (typeof this.x === 'string' ? this.x : this.chart.xAxis[0].categories[this.x]);
        const value = this.y || 0;
        
        // Calculate stats for context
        const allData = this.series.data.map((p: any) => p.y || 0);
        const maxValue = Math.max(...allData);
        const avgValue = (allData.reduce((sum: number, v: number) => sum + v, 0) / allData.length).toFixed(1);
        const isPeak = value === maxValue && value > 0;

        let content = formatTooltipHeader(String(dateLabel)) +
          formatTooltipRow(chartColors.primary, t('charts.submissions'), value, '');

        if (isPeak) {
          content += `<div style="margin-top: 6px; padding: 4px 8px; background: rgba(47, 179, 68, 0.1); border-radius: 4px; font-size: 11px; color: ${chartColors.success};">
            ${t('charts.peakDay')}
          </div>`;
        }

        content += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee; font-size: 11px;">
          ${formatStatRow(t('charts.dailyAverage'), avgValue)}
        </div>`;
        
        return wrapTooltip(content);
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
      name: t('charts.submissions'),
      type: 'column',
      data
    }],
    legend: { enabled: false },
    credits: { enabled: false }
  }), [categories, data, tickInterval, totalSubmissions, t]);

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
}; 