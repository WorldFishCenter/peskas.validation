import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface QualityRankingChartProps {
  enumerators: EnumeratorData[];
}

const QualityRankingChart: React.FC<QualityRankingChartProps> = ({ 
  enumerators
}) => {
  // Filter out enumerators with no submissions in the selected timeframe
  const filteredEnumerators = enumerators.filter(e => {
    const total = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
    return total > 0; // Only include enumerators with at least 1 submission
  });

  // Generate enumerator quality ranking chart
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      height: 550
    },
    title: {
      text: `Enumerator Quality Ranking (Selected Date Range)`
    },
    xAxis: {
      categories: filteredEnumerators
        .sort((a, b) => {
          const aRate = a.filteredErrorRate !== undefined ? a.filteredErrorRate : a.errorRate;
          const bRate = b.filteredErrorRate !== undefined ? b.filteredErrorRate : b.errorRate;
          return aRate - bRate;
        })
        .map(e => e.name),
      title: {
        text: 'Enumerator'
      }
    },
    yAxis: [{
      title: {
        text: 'Quality Score (%)'
      },
      min: 0,
      max: 100
    }, {
      title: {
        text: 'Submission Count'
      },
      min: 0,
      opposite: true
    }],
    tooltip: {
      formatter: function() {
        const x = String(this.x);
        const enumerator = filteredEnumerators.find(e => e.name === x);
        
        if (!enumerator) return `<b>${x}</b><br/>No data available`;
        
        const total = enumerator.filteredTotal !== undefined ? 
          enumerator.filteredTotal : enumerator.totalSubmissions;
        
        const alerts = enumerator.filteredAlertsCount !== undefined ? 
          enumerator.filteredAlertsCount : enumerator.submissionsWithAlerts;
        
        const cleanSubmissions = Math.max(0, total - alerts);
        
        return `<b>${x}</b><br/>
                <span style="color:${this.series.color}">●</span> ${this.series.name}: ${this.y}${this.series.name === 'Quality Score' ? '%' : ''}<br/>
                Total Submissions: ${total}<br/>
                Clean Submissions: ${cleanSubmissions}`;
      },
      shared: true
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true,
          style: {
            fontSize: '10px'
          }
        },
        grouping: false
      }
    },
    series: [{
      name: 'Quality Score',
      type: 'bar',
      data: filteredEnumerators
        .sort((a, b) => {
          const aRate = a.filteredErrorRate !== undefined ? a.filteredErrorRate : a.errorRate;
          const bRate = b.filteredErrorRate !== undefined ? b.filteredErrorRate : b.errorRate;
          return aRate - bRate;
        })
        .map(e => {
          const rate = e.filteredErrorRate !== undefined ? e.filteredErrorRate : e.errorRate;
          return parseFloat((100 - rate).toFixed(1));
        }),
      color: '#28a745',
      dataLabels: {
        format: '{y}%'
      }
    }, {
      name: 'Submission Count',
      type: 'bar',
      data: filteredEnumerators
        .sort((a, b) => {
          const aRate = a.filteredErrorRate !== undefined ? a.filteredErrorRate : a.errorRate;
          const bRate = b.filteredErrorRate !== undefined ? b.filteredErrorRate : b.errorRate;
          return aRate - bRate;
        })
        .map(e => e.filteredTotal || e.totalSubmissions),
      color: '#17a2b8',
      yAxis: 1,
      opacity: 0.7,
      dataLabels: {
        format: '{y}'
      }
    }],
    credits: {
      enabled: false
    },
    legend: {
      enabled: true
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default QualityRankingChart; 