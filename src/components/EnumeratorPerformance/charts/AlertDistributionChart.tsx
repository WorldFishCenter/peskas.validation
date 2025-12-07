import React, { useMemo } from 'react';
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
        <p className="empty-title">No alerts in this period</p>
        <p className="empty-subtitle text-secondary">
          All submissions in the selected date range passed validation without issues.
        </p>
      </div>
    );
  }

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      height: 480,
      style: { fontFamily: 'inherit' }
    },
    title: { text: undefined },
    subtitle: {
      text: `${totalAlerts} total alert${totalAlerts !== 1 ? 's' : ''} detected`,
      style: { fontSize: '13px', color: '#666' }
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
      name: 'Alerts',
      type: 'pie',
      data: alertData
    }],
    credits: { enabled: false }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default AlertDistributionChart; 