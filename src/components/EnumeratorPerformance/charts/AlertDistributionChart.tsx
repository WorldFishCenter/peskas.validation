import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { IconMoodSmile } from '@tabler/icons-react';
import { EnumeratorData } from '../types';
import { baseTooltipConfig, wrapTooltip, formatTooltipHeader } from '../utils/chartConfig';

interface AlertDistributionChartProps {
  enumerators: EnumeratorData[];
}

const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({
  enumerators
}) => {
  const { t } = useTranslation('enumerators');

  const { alertData, totalAlerts } = useMemo(() => {
    const alertDistribution = enumerators.reduce((counts: Record<string, number>, enumerator) => {
      const submissions = enumerator.filteredSubmissions || enumerator.submissions;

      submissions.forEach(submission => {
        if (submission.alert_flag && submission.alert_flag !== "NA") {
          counts[submission.alert_flag] = (counts[submission.alert_flag] || 0) + 1;
        }
      });

      return counts;
    }, {});

    const data = Object.entries(alertDistribution)
      .map(([label, count]) => ({
        name: label,
        y: count
      }))
      .sort((a, b) => b.y - a.y);

    const total = data.reduce((sum, item) => sum + item.y, 0);

    return { alertData: data, totalAlerts: total };
  }, [enumerators]);

  // Empty state with friendly message
  if (alertData.length === 0) {
    return (
      <div className="empty py-5">
        <div className="empty-icon">
          <IconMoodSmile size={48} stroke={1.5} className="text-green" />
        </div>
        <p className="empty-title">{t('charts.noAlerts')}</p>
        <p className="empty-subtitle text-secondary">
          {t('charts.noAlertsDescription')}
        </p>
      </div>
    );
  }

  const chartOptions: Highcharts.Options = useMemo(() => ({
    chart: {
      type: 'pie',
      height: 480,
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: totalAlerts === 1 ? t('charts.alertCount', { count: totalAlerts }) : t('charts.alertCountPlural', { count: totalAlerts }),
      style: { fontSize: '13px', color: '#666' }
    },
    tooltip: {
      ...baseTooltipConfig,
      formatter: function(this: any) {
        const point = this.point;
        return wrapTooltip(
          formatTooltipHeader(`${t('charts.alert')}${point.name}`) +
          `<div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span style="color: #666;">${t('charts.count')}</span>
            <span style="font-weight: 600;">${point.y}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span style="color: #666;">${t('charts.share')}</span>
            <span style="font-weight: 600;">${point.percentage.toFixed(1)}%</span>
          </div>`
        );
      }
    },
    accessibility: {
      point: { valueSuffix: '%' }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        borderRadius: 4,
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f}%',
          distance: 25,
          style: { fontSize: '11px', fontWeight: '500' },
          filter: {
            property: 'percentage',
            operator: '>',
            value: 4
          }
        },
        showInLegend: true,
        size: '75%'
      }
    },
    legend: {
      enabled: true,
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'middle',
      itemMarginTop: 4,
      itemMarginBottom: 4,
      maxHeight: 350,
      itemStyle: { fontSize: '12px' }
    },
    series: [{
      name: t('charts.alerts'),
      type: 'pie',
      data: alertData
    }],
    credits: { enabled: false }
  }), [alertData, totalAlerts, t]);

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default AlertDistributionChart; 