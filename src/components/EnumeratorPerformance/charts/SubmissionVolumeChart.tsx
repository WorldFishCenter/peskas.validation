import React from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface SubmissionVolumeChartProps {
  enumerators: EnumeratorData[];
  onEnumeratorSelect: (name: string) => void;
}

const SubmissionVolumeChart: React.FC<SubmissionVolumeChartProps> = ({ 
  enumerators, 
  onEnumeratorSelect
}) => {
  // Filter out enumerators with no submissions in the selected timeframe
  const filteredEnumerators = enumerators.filter(e => {
    const total = e.filteredTotal !== undefined ? e.filteredTotal : e.totalSubmissions;
    return total > 0; // Only include enumerators with at least 1 submission
  });

  // Log what we're actually displaying
  console.log(`Volume chart showing ${filteredEnumerators.length} enumerators with submissions in selected date range`);

  // Generate chart options for submission volume by enumerator
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      height: 500
    },
    title: {
      text: `Submission Volume by Enumerator (Selected Date Range)`
    },
    xAxis: {
      categories: filteredEnumerators
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
        const enumerator = filteredEnumerators.find(e => e.name === x);
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
      data: filteredEnumerators
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