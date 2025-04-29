import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface AlertDistributionChartProps {
  selectedEnumeratorData: EnumeratorData;
  timeframe: 'all' | '7days' | '30days' | '90days';
}

export const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({ 
  selectedEnumeratorData, 
  timeframe 
}) => {
  // Generate detailed analysis for selected enumerator
  const enumeratorAlertDistribution = 
    // Use filteredSubmissions if available, otherwise use all submissions
    (selectedEnumeratorData.filteredSubmissions || selectedEnumeratorData.submissions).reduce((counts: Record<string, number>, submission) => {
      if (submission.alert_flag && submission.alert_flag !== "NA") {
        counts[submission.alert_flag] = (counts[submission.alert_flag] || 0) + 1;
      }
      return counts;
    }, {});
  
  const alertLabels = Object.keys(enumeratorAlertDistribution);
  const alertCounts = Object.values(enumeratorAlertDistribution);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      height: 350
    },
    title: {
      text: `Alert Types for ${selectedEnumeratorData?.name || ''} (${timeframe === 'all' ? 'All Time' : `Last ${timeframe.replace('days', ' days')}`})`
    },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.y} ({point.percentage:.1f}%)</b>'
    },
    accessibility: {
      point: {
        valueSuffix: '%'
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %'
        }
      }
    },
    series: [{
      name: 'Alerts',
      type: 'pie',
      data: alertLabels.map((label, index) => ({
        name: label,
        y: alertCounts[index]
      }))
    }],
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

interface EnumeratorTrendChartProps {
  selectedEnumeratorData: EnumeratorData;
  filterByTimeframe: (date: string) => boolean;
}

export const EnumeratorTrendChart: React.FC<EnumeratorTrendChartProps> = ({ 
  selectedEnumeratorData, 
  filterByTimeframe
}) => {
  // Generate individual submission trend for selected enumerator
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'column',
      height: 350,
      zoomType: 'x'
    },
    title: {
      text: `Submission Trend for ${selectedEnumeratorData?.name || ''}`
    },
    xAxis: {
      categories: selectedEnumeratorData?.submissionTrend
        .filter(t => filterByTimeframe(t.date))
        .map(t => t.date) || [],
      title: {
        text: 'Date'
      },
      labels: {
        rotation: -45,
        style: {
          fontSize: '11px'
        }
      }
    },
    yAxis: {
      title: {
        text: 'Number of Submissions'
      },
      min: 0
    },
    tooltip: {
      formatter: function() {
        return `<b>${this.x}</b><br/>
                Submissions: ${this.y}`;
      }
    },
    plotOptions: {
      column: {
        dataLabels: {
          enabled: true,
          format: '{y}',
          style: {
            fontSize: '10px'
          }
        }
      }
    },
    series: [{
      name: 'Submissions',
      type: 'column',
      data: selectedEnumeratorData?.submissionTrend
        .filter(t => filterByTimeframe(t.date))
        .map(t => t.count) || [],
      color: '#0d6efd'
    }],
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
}; 