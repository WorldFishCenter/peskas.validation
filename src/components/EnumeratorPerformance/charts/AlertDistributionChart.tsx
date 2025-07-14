import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { EnumeratorData } from '../types';

interface AlertDistributionChartProps {
  enumerators: EnumeratorData[];
}

const AlertDistributionChart: React.FC<AlertDistributionChartProps> = ({ 
  enumerators
}) => {
  // Process and calculate alert distribution using memoization for better performance
  const { alertData, totalAlerts } = useMemo(() => {
    // Collect all alert types across all enumerators
    const alertDistribution = enumerators.reduce((counts: Record<string, number>, enumerator) => {
      // Use filtered submissions when available
      const submissions = enumerator.filteredSubmissions || enumerator.submissions;
      
      submissions.forEach(submission => {
        if (submission.alert_flag && submission.alert_flag !== "NA") {
          counts[submission.alert_flag] = (counts[submission.alert_flag] || 0) + 1;
        }
      });
      
      return counts;
    }, {});
    
    // Convert to array format for the chart
    const data = Object.entries(alertDistribution)
      .map(([label, count]) => ({
        name: label,
        y: count
      }))
      .sort((a, b) => b.y - a.y); // Sort by count in descending order

    // Calculate total alerts
    const total = data.reduce((sum, item) => sum + item.y, 0);
    
    return { alertData: data, totalAlerts: total };
  }, [enumerators]);
  
  // Show an empty message if no alerts are found
  if (alertData.length === 0) {
    return (
      <div className="alert alert-info" role="alert">
        <div className="d-flex">
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle me-2" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
              <path d="M12 8l.01 0"></path>
              <path d="M11 12h1v4h1"></path>
            </svg>
          </div>
          <div>No alerts found in the selected time period.</div>
        </div>
      </div>
    );
  }
  
  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'pie',
      height: 550 // Increased height for better visualization
    },
    title: {
      text: `Alert Distribution Across All Enumerators`
    },
    subtitle: {
      text: `Total Alerts: ${totalAlerts}`
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
          format: '<b>{point.name}</b>: {point.percentage:.1f}%',
          distance: 20,
          filter: {
            property: 'percentage',
            operator: '>',
            value: 4 // Only show labels for segments > 4%
          }
        },
        showInLegend: true,
        size: '80%'
      }
    },
    legend: {
      enabled: true,
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'middle',
      itemMarginTop: 5,
      itemMarginBottom: 5,
      maxHeight: 400
    },
    series: [{
      name: 'Alerts',
      type: 'pie',
      data: alertData
    }],
    credits: {
      enabled: false
    }
  };

  return <HighchartsReact highcharts={Highcharts} options={chartOptions} />;
};

export default AlertDistributionChart; 