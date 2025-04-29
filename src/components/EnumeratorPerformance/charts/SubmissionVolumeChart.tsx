import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface SubmissionVolumeChartProps {
  enumerators: EnumeratorData[];
  timeframe: 'all' | '7days' | '30days' | '90days';
  onEnumeratorSelect: (name: string) => void;
}

const SubmissionVolumeChart: React.FC<SubmissionVolumeChartProps> = ({ 
  enumerators, 
  timeframe,
  onEnumeratorSelect
}) => {
  // Generate chart options for submission volume by enumerator
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      height: 500
    },
    title: {
      text: `Submission Volume by Enumerator (${timeframe === 'all' ? 'All Time' : `Last ${timeframe.replace('days', ' days')}`})`
    },
    xAxis: {
      categories: enumerators
        .sort((a, b) => (b.filteredTotal || b.totalSubmissions) - (a.filteredTotal || a.totalSubmissions))
        .map(e => e.name),
      title: {
        text: 'Enumerator'
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
        const x = String(this.x);
        const enumerator = enumerators.find(e => e.name === x);
        const errorRate = enumerator?.filteredErrorRate !== undefined ? 
          enumerator.filteredErrorRate : enumerator?.errorRate;
        
        return `<b>${x}</b><br/>
                Total Submissions: ${this.y}<br/>
                Error Rate: ${errorRate?.toFixed(1)}%`;
      }
    },
    plotOptions: {
      bar: {
        cursor: 'pointer',
        point: {
          events: {
            click: function(this: Highcharts.Point) {
              const category = this.category as string;
              onEnumeratorSelect(category);
              // Auto-scroll to the detailed section
              setTimeout(() => {
                const detailSection = document.getElementById('enumerator-detail');
                if (detailSection) {
                  detailSection.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
          }
        },
        dataLabels: {
          enabled: true,
          format: '{y}',
          style: {
            fontSize: '10px'
          }
        },
        colorByPoint: false,
        color: '#0d6efd'
      }
    },
    series: [{
      name: 'Submissions',
      type: 'bar',
      data: enumerators
        .sort((a, b) => (b.filteredTotal || b.totalSubmissions) - (a.filteredTotal || a.totalSubmissions))
        .map(e => e.filteredTotal || e.totalSubmissions),
    }],
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default SubmissionVolumeChart; 