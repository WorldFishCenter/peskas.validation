import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface SubmissionTrendChartProps {
  enumerators: EnumeratorData[];
  timeframe: 'all' | '7days' | '30days' | '90days';
  uniqueDates: string[];
  filterByTimeframe: (date: string) => boolean;
}

const SubmissionTrendChart: React.FC<SubmissionTrendChartProps> = ({ 
  enumerators, 
  timeframe,
  uniqueDates,
  filterByTimeframe
}) => {
  // Generate options for submission trend over time
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'line',
      height: 550,
      zoomType: 'x'
    },
    title: {
      text: `Submission Trend Over Time (${timeframe === 'all' ? 'All Time' : `Last ${timeframe.replace('days', ' days')}`})`
    },
    xAxis: {
      categories: uniqueDates,
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
      shared: true,
      crosshairs: true
    },
    legend: {
      enabled: true,
      layout: 'horizontal',
      align: 'center',
      verticalAlign: 'bottom',
      maxHeight: 80,
      itemStyle: {
        fontSize: '10px'
      }
    },
    series: enumerators
      .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
      .slice(0, 10) // Top 10 enumerators by volume
      .map(enumerator => {
        // Create a map of date -> count for this enumerator
        const dateCounts = enumerator.submissionTrend.reduce((acc: Record<string, number>, item) => {
          acc[item.date] = item.count;
          return acc;
        }, {});
        
        // Generate data points for each date
        const data = uniqueDates
          .filter(date => filterByTimeframe(date))
          .map(date => dateCounts[date] || 0);
        
        return {
          name: enumerator.name,
          type: 'line' as const,
          data
        };
      }),
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default SubmissionTrendChart; 