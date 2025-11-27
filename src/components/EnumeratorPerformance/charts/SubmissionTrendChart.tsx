import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface SubmissionTrendChartProps {
  enumerators: EnumeratorData[];
  uniqueDates: string[];
}

const SubmissionTrendChart: React.FC<SubmissionTrendChartProps> = ({ 
  enumerators, 
  uniqueDates
}) => {
  // Filter out enumerators with no submissions in the selected date range
  const filteredEnumerators = enumerators.filter(e => {
    const total = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
    return total > 0; // Only include enumerators with at least 1 submission
  });

  // Filter and sort dates chronologically
  const filteredDates = uniqueDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Format dates for better display
  const formattedDates = filteredDates.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  });

  // Determine appropriate tick interval based on number of dates
  const tickInterval = Math.max(1, Math.floor(filteredDates.length / 10));
  
  // Generate options for submission trend over time
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'line',
      height: 550,
      zoomType: 'x'
    },
    title: {
      text: `Enumerator Quality Ranking (Selected Date Range)`
    },
    xAxis: {
      categories: formattedDates,
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
      shared: true,
      crosshairs: true,
      formatter: function() {
        const points = this.points || [];
        let tooltip = `<b>${this.x}</b><br/>`;
        
        // Add information for each series point at this x position
        points.forEach(point => {
          const value = point.y || 0;
          if (value > 0) {
            tooltip += `<span style="color:${point.series.color}">●</span> ${point.series.name}: ${value} submission${value !== 1 ? 's' : ''}<br/>`;
          }
        });
        
        return tooltip;
      }
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
    plotOptions: {
      line: {
        marker: {
          enabled: filteredDates.length < 30 // Only show markers if we have fewer dates
        },
        connectNulls: false
      }
    },
    series: filteredEnumerators
      .sort((a, b) => {
        // Sort by filtered total when available, otherwise use total submissions
        const aTotal = a.filteredTotal !== undefined ? a.filteredTotal : a.totalSubmissions;
        const bTotal = b.filteredTotal !== undefined ? b.filteredTotal : b.totalSubmissions;
        return bTotal - aTotal;
      })
      .slice(0, 10) // Top 10 enumerators by filtered volume
      .map(enumerator => {
        // Create a map of date -> count for this enumerator
        const dateCounts = enumerator.submissionTrend.reduce((acc: Record<string, number>, item) => {
          acc[item.date] = item.count;
          return acc;
        }, {});
        
        // Generate data points for each date
        const data = filteredDates.map(date => dateCounts[date] || 0);
        
        // Calculate series total for logging
        const seriesTotal = data.reduce((sum, value) => sum + value, 0);
        
        return {
          name: enumerator.name,
          type: 'line' as const,
          data,
          visible: seriesTotal > 0 // Only make series visible if it has data in the timeframe
        };
      }),
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default SubmissionTrendChart; 