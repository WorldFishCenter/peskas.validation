import React, { useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useFetchEnumeratorStats } from '../../api/api';

// Create a type for the enumerator data
interface EnumeratorData {
  name: string;
  totalSubmissions: number;
  submissionsWithAlerts: number;
  errorRate: number;
  alertFrequency: Array<{
    code: string;
    count: number;
    description: string;
  }>;
  submissionTrend: Array<{
    date: string;
    count: number;
  }>;
  validationStatus: {
    approved: number;
    not_approved: number;
    on_hold: number;
  };
}

// Define types for Highcharts formatter functions
interface HighchartsFormatterContextObject {
  x?: string;
  y?: number;
  key?: string;
  point?: any;
  series?: any;
  percentage?: number;
  total?: number;
  category?: string;
}

const EnumeratorPerformance: React.FC = () => {
  const { data: enumerators = [], isLoading, error } = useFetchEnumeratorStats();
  const [selectedEnumerator, setSelectedEnumerator] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center my-4">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  // Set default selected enumerator to top performer if none selected
  if (!selectedEnumerator && enumerators.length > 0) {
    setSelectedEnumerator(enumerators[0].name);
  }

  const enumeratorData = enumerators.find(e => e.name === selectedEnumerator) as EnumeratorData | undefined;
  
  // Calculate dates for submission trend chart
  const allDates = enumerators.flatMap(e => e.submissionTrend.map((t: {date: string}) => t.date)) || [];
  const uniqueDates = [...new Set(allDates)].sort();

  // Generate chart options for submission volume by enumerator
  const submissionVolumeOptions: Highcharts.Options = {
    chart: {
      type: 'column'
    },
    title: {
      text: 'Submission Volume by Enumerator'
    },
    xAxis: {
      categories: enumerators.map(e => e.name),
      title: {
        text: 'Enumerator'
      }
    },
    yAxis: {
      title: {
        text: 'Number of Submissions'
      }
    },
    tooltip: {
      formatter: function() {
        const x = String(this.x);
        return `<b>${x}</b><br/>
                Total Submissions: ${this.y}<br/>
                Error Rate: ${enumerators.find(e => e.name === x)?.errorRate.toFixed(1)}%`;
      }
    },
    series: [{
      name: 'Submissions',
      type: 'column',
      data: enumerators.map(e => e.totalSubmissions)
    }],
    plotOptions: {
      column: {
        cursor: 'pointer',
        point: {
          events: {
            click: function() {
              const category = this.category as string;
              setSelectedEnumerator(category);
            }
          }
        }
      }
    }
  };

  // Error rate chart options
  const errorRateOptions: Highcharts.Options = {
    chart: {
      type: 'column'
    },
    title: {
      text: 'Error Rate by Enumerator'
    },
    xAxis: {
      categories: enumerators.map(e => e.name),
      title: {
        text: 'Enumerator'
      }
    },
    yAxis: {
      title: {
        text: 'Error Rate (%)'
      },
      max: 100
    },
    series: [{
      name: 'Error Rate',
      type: 'column',
      data: enumerators.map(e => parseFloat(e.errorRate.toFixed(1))),
      color: '#dc3545'
    }],
    plotOptions: {
      column: {
        cursor: 'pointer',
        point: {
          events: {
            click: function() {
              const category = this.category as string;
              setSelectedEnumerator(category);
            }
          }
        }
      }
    }
  };

  // Generate detailed charts for selected enumerator
  let alertFrequencyOptions: Highcharts.Options = {};
  let submissionTrendOptions: Highcharts.Options = {};
  let validationStatusOptions: Highcharts.Options = {};

  if (enumeratorData) {
    // Alert frequency chart
    alertFrequencyOptions = {
      chart: {
        type: 'bar'
      },
      title: {
        text: `Common Errors for ${enumeratorData.name}`
      },
      xAxis: {
        categories: enumeratorData.alertFrequency.map(a => `Code ${a.code}`),
        title: {
          text: 'Alert Code'
        }
      },
      yAxis: {
        title: {
          text: 'Frequency'
        }
      },
      tooltip: {
        formatter: function() {
          const x = String(this.x);
          const alertCode = x.replace('Code ', '');
          const alert = enumeratorData.alertFrequency.find(a => a.code === alertCode);
          return `<b>${x}</b><br/>
                Count: ${this.y}<br/>
                Description: ${alert?.description}`;
        }
      },
      series: [{
        name: 'Occurrence',
        type: 'bar',
        data: enumeratorData.alertFrequency.map(a => a.count),
        color: '#fd7e14'
      }]
    };

    // Submission trend chart (line chart over time)
    const trendData = uniqueDates.map(date => {
      const entry = enumeratorData.submissionTrend.find(t => t.date === date);
      return entry ? entry.count : 0;
    });

    submissionTrendOptions = {
      chart: {
        type: 'line'
      },
      title: {
        text: `Submission Trend for ${enumeratorData.name}`
      },
      xAxis: {
        categories: uniqueDates,
        title: {
          text: 'Date'
        }
      },
      yAxis: {
        title: {
          text: 'Submissions'
        }
      },
      series: [{
        name: 'Submissions',
        type: 'line',
        data: trendData,
        color: '#0d6efd'
      }]
    };

    // Validation status pie chart
    validationStatusOptions = {
      chart: {
        type: 'pie'
      },
      title: {
        text: `Validation Status for ${enumeratorData.name}`
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
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
        name: 'Status',
        type: 'pie',
        data: [
          {
            name: 'Approved',
            y: enumeratorData.validationStatus.approved,
            color: '#57A773'
          },
          {
            name: 'Not Approved',
            y: enumeratorData.validationStatus.not_approved,
            color: '#D34E24'
          },
          {
            name: 'On Hold',
            y: enumeratorData.validationStatus.on_hold,
            color: '#89909F'
          }
        ]
      } as any]
    };
  }

  return (
    <div className="container-xl">
      <div className="page-header d-print-none">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">Enumerator Performance Dashboard</h2>
            <div className="text-muted mt-1">
              Analyze performance metrics for data collectors
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <HighchartsReact
                highcharts={Highcharts}
                options={submissionVolumeOptions}
              />
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <HighchartsReact
                highcharts={Highcharts}
                options={errorRateOptions}
              />
            </div>
          </div>
        </div>
      </div>

      {enumeratorData && (
        <div className="mt-4">
          <div className="alert alert-info">
            <div className="d-flex">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-user" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                  <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path>
                  <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
                </svg>
              </div>
              <div className="ms-3">
                <h4 className="my-0">Detailed Analysis for: {enumeratorData.name}</h4>
                <div className="text-muted">
                  Total Submissions: {enumeratorData.totalSubmissions} | 
                  Error Rate: {enumeratorData.errorRate.toFixed(1)}% | 
                  Submissions with Alerts: {enumeratorData.submissionsWithAlerts}
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={alertFrequencyOptions}
                  />
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={validationStatusOptions}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-12">
              <div className="card">
                <div className="card-body">
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={submissionTrendOptions}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Alert Details for {enumeratorData.name}</h3>
                </div>
                <div className="table-responsive">
                  <table className="table table-vcenter card-table">
                    <thead>
                      <tr>
                        <th>Alert Code</th>
                        <th>Description</th>
                        <th>Count</th>
                        <th>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enumeratorData.alertFrequency.map(alert => (
                        <tr key={alert.code}>
                          <td>Code {alert.code}</td>
                          <td>{alert.description}</td>
                          <td>{alert.count}</td>
                          <td>
                            {((alert.count / enumeratorData.submissionsWithAlerts) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      {enumeratorData.alertFrequency.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center">No alerts recorded</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnumeratorPerformance; 