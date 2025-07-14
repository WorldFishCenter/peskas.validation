import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface AlertDistributionChartProps {
  selectedEnumeratorData: EnumeratorData;
}

export const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({ 
  selectedEnumeratorData
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
      text: `Alert Types for ${selectedEnumeratorData?.name || ''} (Selected Date Range)`
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
}

export const EnumeratorTrendChart: React.FC<EnumeratorTrendChartProps> = ({ 
  selectedEnumeratorData
}) => {
  // Filter and sort dates for this enumerator's trend chart
  const trendData = selectedEnumeratorData?.submissionTrend || [];
  
  // Filter dates by selected date range and sort chronologically
  const filteredDates = trendData
    .filter(t => {
      const datePart = t.date.includes('T') ? t.date.split('T')[0] : t.date.split(' ')[0];
      // Use filteredSubmissions to determine range
      // If the date is present in filteredSubmissions, include it
      return (
        selectedEnumeratorData.filteredSubmissions?.some(s => {
          if (!s.submission_date) return false;
          const sDate = s.submission_date.includes('T') ? s.submission_date.split('T')[0] : s.submission_date.split(' ')[0];
          return sDate === datePart;
        })
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Format dates for better display
  const formattedDateMap = filteredDates.reduce((map, item) => {
    const d = new Date(item.date);
    const formatted = d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    map[item.date] = { formatted, count: item.count };
    return map;
  }, {} as Record<string, { formatted: string, count: number }>);
  
  // Create arrays for categories and data
  const categories = filteredDates.map(item => formattedDateMap[item.date].formatted);
  const data = filteredDates.map(item => item.count);
  
  // Determine appropriate tick interval based on number of dates
  const tickInterval = Math.max(1, Math.floor(categories.length / 8));
  
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
      categories: categories,
      title: {
        text: 'Date'
      },
      labels: {
        rotation: -45,
        style: {
          fontSize: '11px'
        },
        step: tickInterval
      },
      tickmarkPlacement: 'on',
      startOnTick: true,
      endOnTick: true,
      showLastLabel: true
    },
    yAxis: {
      title: {
        text: 'Number of Submissions'
      },
      min: 0
    },
    tooltip: {
      formatter: function() {
        const value = this.y || 0;
        return `<b>${this.x}</b><br/>
                Submissions: ${value} ${value !== 1 ? 'submissions' : 'submission'}`;
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
        },
        pointWidth: Math.max(5, Math.min(25, 800 / Math.max(1, filteredDates.length))) // Responsive bar width
      }
    },
    series: [{
      name: 'Submissions',
      type: 'column',
      data: data,
      color: '#0d6efd'
    }],
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
}; 