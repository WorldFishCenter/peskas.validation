import React, { useState, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useFetchEnumeratorStats } from '../../api/api';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/apiConfig';

// Define types based on the new data structure
interface SubmissionData {
  submission_id: number;
  submitted_by: string;
  submission_date: string;
  alert_flag: string | null;
}

interface EnumeratorData {
  name: string;
  submissions: SubmissionData[];
  totalSubmissions: number;
  submissionsWithAlerts: number;
  errorRate: number;
  submissionTrend: { date: string; count: number }[];
  filteredSubmissions?: SubmissionData[];
  filteredTotal?: number;
  filteredAlertsCount?: number;
  filteredErrorRate?: number;
}


// Temporary alternative implementation of refreshEnumeratorStats
const refreshEnumeratorStats = async (adminToken: string) => {
  const API_BASE_URL = getApiBaseUrl();
  try {
    const response = await axios.post(
      `${API_BASE_URL}/admin/refresh-enumerator-stats`,
      {},
      {
        headers: {
          'Admin-Token': adminToken
        }
      }
    );
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error refreshing enumerator stats:', error);
    return {
      success: false,
      message: (error as any).response?.data?.error || 'Failed to refresh enumerator statistics'
    };
  }
};

// Add extended Highcharts types to fix TypeScript errors
declare module 'highcharts' {
  interface ChartOptions {
    zoomType?: string;
  }
  
  interface TooltipOptions {
    crosshairs?: boolean;
  }
}

const EnumeratorPerformance: React.FC = () => {
  const { data: rawData = [], isLoading, error, refetch } = useFetchEnumeratorStats();
  const [enumerators, setEnumerators] = useState<EnumeratorData[]>([]);
  const [selectedEnumerator, setSelectedEnumerator] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'volume' | 'quality' | 'trends'>('volume');
  const [detailActiveTab, setDetailActiveTab] = useState<'overview' | 'trends' | 'alerts'>('overview');

  // Process the raw data into the format needed for the charts
  useEffect(() => {
    if (rawData && rawData.length > 0) {
      // Format data from the table shown in the screenshot
      const processedData: Record<string, any> = {};
      
      // Group by enumerator
      rawData.forEach((item: SubmissionData) => {
        // Skip items with missing or "Unknown" enumerator name
        if (!item.submitted_by || item.submitted_by === 'Unknown') {
          return;
        }
        
        const enumerator = item.submitted_by;
        
        if (!processedData[enumerator]) {
          processedData[enumerator] = {
            name: enumerator,
            submissions: [],
            totalSubmissions: 0,
            submissionsWithAlerts: 0,
            submissionTrend: {}
          };
        }
        
        processedData[enumerator].submissions.push(item);
        processedData[enumerator].totalSubmissions++;
        
        // Count submissions with alerts
        if (item.alert_flag && item.alert_flag !== "NA") {
          processedData[enumerator].submissionsWithAlerts++;
        }
        
        // Track submission trends by date - Add null check for submission_date
        if (item.submission_date) {
          // Parse date safely, handling different formats
          let dateStr = item.submission_date;
          
          // Extract just the date part (handles both ISO formats and other formats with spaces)
          const datePart = dateStr.includes('T') 
            ? dateStr.split('T')[0]  // Handle ISO format: "2025-02-19T00:00:00"
            : dateStr.split(' ')[0]; // Handle space format: "2025-02-19 00:00:00"
            
          if (datePart) {
            if (!processedData[enumerator].submissionTrend[datePart]) {
              processedData[enumerator].submissionTrend[datePart] = 0;
            }
            processedData[enumerator].submissionTrend[datePart]++;
          }
        }
      });
      
      // Calculate error rates and format the data for charts
      const formattedData = Object.values(processedData).map((enumerator: any) => {
        // Calculate error rate
        const errorRate = enumerator.totalSubmissions > 0 
          ? (enumerator.submissionsWithAlerts / enumerator.totalSubmissions) * 100 
          : 0;
        
        // Format submission trend for the chart
        const submissionTrend = Object.entries(enumerator.submissionTrend).map(
          ([date, count]: [string, any]) => ({ date, count })
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return {
          ...enumerator,
          errorRate,
          submissionTrend
        };
      });
      
      // Sort by total submissions (descending)
      const sortedData = formattedData.sort((a: any, b: any) => b.totalSubmissions - a.totalSubmissions);
      
      setEnumerators(sortedData);
      
      // Set default selected enumerator
      if (sortedData.length > 0 && !selectedEnumerator) {
        setSelectedEnumerator(sortedData[0].name);
      }
    }
  }, [rawData, selectedEnumerator]);

  // Apply time filtering to data when timeframe changes
  useEffect(() => {
    if (enumerators.length === 0) return;
    
    // Recalculate stats based on time filter
    const filteredEnumerators = enumerators.map(enumerator => {
      // Filter submissions by timeframe
      const filteredSubmissions = enumerator.submissions.filter(submission => {
        if (!submission.submission_date) return false;
        return filterByTimeframe(submission.submission_date.split(' ')[0]);
      });
      
      // Count submissions with alerts in the filtered timeframe
      const submissionsWithAlerts = filteredSubmissions.filter(
        s => s.alert_flag && s.alert_flag !== "NA"
      ).length;
      
      // Calculate new error rate based on filtered data
      const errorRate = filteredSubmissions.length > 0 
        ? (submissionsWithAlerts / filteredSubmissions.length) * 100 
        : 0;
        
      return {
        ...enumerator,
        filteredSubmissions,
        filteredTotal: filteredSubmissions.length,
        filteredAlertsCount: submissionsWithAlerts,
        filteredErrorRate: errorRate
      };
    });
    
    setEnumerators(filteredEnumerators);
  }, [timeframe]);

  // Check for admin token
  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken) {
      setAdminToken(storedToken);
      setIsAdmin(true);
    }
  }, []);

  // Handle admin refresh
  const handleAdminRefresh = async () => {
    if (!adminToken) {
      const token = prompt('Enter admin token to refresh data:');
      if (!token) return;
      setAdminToken(token);
      localStorage.setItem('admin_token', token);
      setIsAdmin(true);
    }

    setIsRefreshing(true);
    setRefreshMessage(null);
    
    try {
      const result = await refreshEnumeratorStats(adminToken);
      if (result.success) {
        setRefreshMessage(result.message);
        await refetch();
      } else {
        setRefreshMessage(`Error: ${result.message}`);
        if (result.message.includes('Unauthorized')) {
          setIsAdmin(false);
          localStorage.removeItem('admin_token');
        }
      }
    } catch (error) {
      setRefreshMessage('Failed to refresh data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter data based on selected timeframe
  const filterByTimeframe = (date: string): boolean => {
    if (timeframe === 'all') return true;
    
    const now = new Date();
    const submissionDate = new Date(date);
    const daysDifference = Math.floor((now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (timeframe === '7days') return daysDifference <= 7;
    if (timeframe === '30days') return daysDifference <= 30;
    if (timeframe === '90days') return daysDifference <= 90;
    
    return true;
  };

  // Initialize all popovers after component has rendered
  useEffect(() => {
    // Check if Bootstrap's popover function exists
    if (typeof document !== 'undefined' && (window as any).bootstrap?.Popover) {
      const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
      [...popoverTriggerList].map(popoverTriggerEl => {
        return new (window as any).bootstrap.Popover(popoverTriggerEl);
      });
    }
  }, [activeTab]); // Re-initialize when tab changes

  // Loading state
  if (isLoading) {
    return (
      <div className="container-xl">
        <div className="card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <div className="mt-3">Loading data...</div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container-xl">
        <div className="alert alert-danger my-4" role="alert">
          <div className="d-flex">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-alert-circle" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                <path d="M12 8v4"></path>
                <path d="M12 16h.01"></path>
              </svg>
            </div>
            <div className="ms-2">{error}</div>
          </div>
          <div className="mt-3">
            <button className="btn btn-outline-primary" onClick={refetch}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (enumerators.length === 0) {
    return (
      <div className="container-xl">
        <div className="alert alert-info my-4" role="alert">
          <div className="d-flex">
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                <path d="M12 8l.01 0"></path>
                <path d="M11 12h1v4h1"></path>
              </svg>
            </div>
            <div className="ms-2">No enumerator performance data available.</div>
          </div>
        </div>
      </div>
    );
  }

  const selectedEnumeratorData = enumerators.find(e => e.name === selectedEnumerator);
  
  // Calculate summary statistics based on filtered data
  const totalSubmissions = enumerators.reduce((sum, e) => sum + (e.filteredTotal || e.totalSubmissions), 0);
  const totalAlerts = enumerators.reduce((sum, e) => sum + (e.filteredAlertsCount || e.submissionsWithAlerts), 0);
  const avgErrorRate = totalSubmissions > 0 ? (totalAlerts / totalSubmissions) * 100 : 0;
  
  // Find the best enumerator using a weighted quality score
  const bestEnumerator = enumerators.reduce((best, current) => {
    // Only consider enumerators with at least 5 submissions
    const currentSubmissions = current.filteredTotal !== undefined ? current.filteredTotal : current.totalSubmissions;
    const bestSubmissions = best.filteredTotal !== undefined ? best.filteredTotal : best.totalSubmissions;
    
    if (currentSubmissions < 5) return best;
    if (bestSubmissions < 5 && currentSubmissions >= 5) return current;
    
    // Calculate quality scores
    const bestQualityScore = 100 - (best.filteredErrorRate !== undefined ? best.filteredErrorRate : best.errorRate);
    const currentQualityScore = 100 - (current.filteredErrorRate !== undefined ? current.filteredErrorRate : current.errorRate);
    
    // Calculate weighted scores that consider both quality and volume
    // Using logarithmic scale to balance between quality and quantity
    const bestWeightedScore = bestQualityScore * Math.log10(bestSubmissions + 1);
    const currentWeightedScore = currentQualityScore * Math.log10(currentSubmissions + 1);
    
    return currentWeightedScore > bestWeightedScore ? current : best;
  }, enumerators[0] || { name: '', errorRate: 0, filteredErrorRate: 0 });
  
  // Calculate dates for submission trend chart
  const allDates = enumerators.flatMap(e => 
    e.submissionTrend
      .filter(t => filterByTimeframe(t.date))
      .map(t => t.date)
  );
  const uniqueDates = [...new Set(allDates)].sort();

  // Generate chart options for submission volume by enumerator
  const submissionVolumeOptions: Highcharts.Options = {
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
              setSelectedEnumerator(category);
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

  // Generate enumerator quality ranking chart
  const qualityRankingOptions: Highcharts.Options = {
    chart: {
      type: 'bar',
      height: 550
    },
    title: {
      text: `Enumerator Quality Ranking (${timeframe === 'all' ? 'All Time' : `Last ${timeframe.replace('days', ' days')}`})`
    },
    xAxis: {
      categories: enumerators
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
        const enumerator = enumerators.find(e => e.name === x);
        
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
      data: enumerators
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
      data: enumerators
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

  // Generate options for submission trend over time
  const submissionTrendOptions: Highcharts.Options = {
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

  // Generate detailed analysis for selected enumerator
  const enumeratorAlertDistribution = selectedEnumeratorData ? 
    // Use filteredSubmissions if available, otherwise use all submissions
    (selectedEnumeratorData.filteredSubmissions || selectedEnumeratorData.submissions).reduce((counts: Record<string, number>, submission) => {
      if (submission.alert_flag && submission.alert_flag !== "NA") {
        counts[submission.alert_flag] = (counts[submission.alert_flag] || 0) + 1;
      }
      return counts;
    }, {}) : {};
  
  const alertLabels = Object.keys(enumeratorAlertDistribution);
  const alertCounts = Object.values(enumeratorAlertDistribution);

  const alertDistributionOptions: Highcharts.Options = {
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

  // Generate individual submission trend for selected enumerator
  const selectedEnumeratorTrendOptions: Highcharts.Options = {
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

  return (
    <div className="container-xl">
      {/* Page header with actions */}
      <div className="page-header d-print-none mb-4">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <h2 className="page-title">Enumerator Performance Dashboard</h2>
              <div className="text-muted mt-1">
                Monitor and analyze data collection performance metrics
              </div>
            </div>
            <div className="col-auto ms-auto d-print-none">
              <div className="btn-list">
                <div className="d-flex">
                  <div className="btn-group me-2" role="group" aria-label="Time period">
                    <button type="button" 
                      className={`btn btn-sm ${timeframe === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeframe('all')}>
                      All Time
                    </button>
                    <button type="button" 
                      className={`btn btn-sm ${timeframe === '7days' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeframe('7days')}>
                      7 Days
                    </button>
                    <button type="button" 
                      className={`btn btn-sm ${timeframe === '30days' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeframe('30days')}>
                      30 Days
                    </button>
                    <button type="button" 
                      className={`btn btn-sm ${timeframe === '90days' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeframe('90days')}>
                      90 Days
                    </button>
                  </div>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={refetch}
                    disabled={isRefreshing}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-refresh" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path>
                      <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path>
                    </svg>
                    Refresh
                  </button>
                  {isAdmin && (
                    <button 
                      className="btn btn-outline-primary btn-sm ms-2"
                      onClick={handleAdminRefresh}
                      disabled={isRefreshing}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-database" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                        <path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"></path>
                        <path d="M4 6v6a8 3 0 0 0 16 0v-6"></path>
                        <path d="M4 12v6a8 3 0 0 0 16 0v-6"></path>
                      </svg>
                      Admin Refresh
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {refreshMessage && (
        <div className={`alert ${refreshMessage.includes('Error') ? 'alert-danger' : 'alert-success'} mb-4`}>
          {refreshMessage}
        </div>
      )}

      {/* Summary statistics cards */}
      <div className="row row-deck row-cards mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="subheader">Total Submissions</div>
              </div>
              <div className="h1 mb-0">{totalSubmissions}</div>
              <div className="text-muted mt-1">All enumerators combined</div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="subheader">Total Enumerators</div>
              </div>
              <div className="h1 mb-0">{enumerators.length}</div>
              <div className="text-muted mt-1">Active data collectors</div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="subheader">Average Error Rate</div>
              </div>
              <div className="h1 mb-0">{avgErrorRate.toFixed(1)}%</div>
              <div className="text-muted mt-1">Across all submissions</div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="subheader">Best Performing Enumerator</div>
              </div>
              <div className="h1 mb-0">{bestEnumerator.name}</div>
              <div className="text-muted mt-1">Error rate: {bestEnumerator.filteredErrorRate !== undefined ? bestEnumerator.filteredErrorRate.toFixed(1) : bestEnumerator.errorRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content section with tabs */}
      <div className="card mb-4">
        <div className="card-header">
          <ul className="nav nav-tabs card-header-tabs" data-bs-toggle="tabs">
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'volume' ? 'active' : ''}`} 
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('volume'); }}
              >
                Submission Volume
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'quality' ? 'active' : ''}`} 
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('quality'); }}
              >
                Quality Metrics
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`} 
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('trends'); }}
              >
                Submission Trends
              </a>
            </li>
          </ul>
        </div>
        <div className="card-body" style={{ minHeight: '600px' }}>
          <div className="tab-content">
            {/* Volume Tab */}
            <div className={`tab-pane ${activeTab === 'volume' ? 'active show' : ''}`}>
              <h3 className="card-title">Submission Volume by Enumerator</h3>
              <p className="text-muted mb-4">Click on any bar to view detailed statistics for that enumerator</p>
              <HighchartsReact highcharts={Highcharts} options={submissionVolumeOptions} />
            </div>
            
            {/* Quality Tab */}
            <div className={`tab-pane ${activeTab === 'quality' ? 'active show' : ''}`}>
              <div className="row">
                <div className="col-12">
                  <div className="card border-0 shadow-none">
                    <div className="card-body p-0">
                      <div className="d-flex align-items-center mb-1">
                        <h3 className="card-title mb-0">Enumerator Quality Ranking</h3>
                        <div className="ms-2">
                          <span 
                            className="cursor-help" 
                            data-bs-toggle="popover" 
                            data-bs-placement="top" 
                            data-bs-html="true"
                            data-bs-trigger="hover focus"
                            title="Understanding Quality Metrics" 
                            data-bs-content="
                              <strong>Quality Score:</strong> Percentage of submissions without alerts (100% - Error Rate).<br><br>
                              <strong>Best Performer:</strong> Uses a weighted score that considers both quality and submission volume, requiring at least 5 submissions.<br><br>
                              <strong>Chart:</strong> Green bars show quality score (%), blue bars show submission count.
                            "
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-info-circle text-primary" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                              <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
                              <path d="M12 8l.01 0"></path>
                              <path d="M11 12h1v4h1"></path>
                            </svg>
                          </span>
                        </div>
                      </div>
                      <p className="text-muted small mb-3">Ranked by percentage of submissions without alerts</p>
                      <HighchartsReact highcharts={Highcharts} options={qualityRankingOptions} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Trends Tab */}
            <div className={`tab-pane ${activeTab === 'trends' ? 'active show' : ''}`}>
              <h3 className="card-title mb-1">Submission Trend Over Time</h3>
              <p className="text-muted small mb-3">Showing top 10 enumerators by submission volume (use mouse to zoom)</p>
              <div className="mt-0">
                <HighchartsReact highcharts={Highcharts} options={submissionTrendOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed enumerator analysis section */}
      {selectedEnumeratorData && (
        <div className="card" id="enumerator-detail">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div className="d-flex align-items-center">
                <span className="avatar avatar-md bg-azure-lt me-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-user" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path>
                    <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
                  </svg>
                </span>
                <h3 className="card-title m-0">Detailed Analysis: {selectedEnumeratorData.name}</h3>
              </div>
              <div style={{ width: '200px' }}>
                <select 
                  className="form-select" 
                  value={selectedEnumerator || ''} 
                  onChange={(e) => setSelectedEnumerator(e.target.value)}
                >
                  <option value="" disabled>Select Enumerator</option>
                  {enumerators
                    .filter(e => e.name !== 'Unknown')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(enumerator => (
                      <option key={enumerator.name} value={enumerator.name}>
                        {enumerator.name}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
            
            <div className="card-tabs">
              <ul className="nav nav-tabs nav-tabs-bottom">
                <li className="nav-item">
                  <a 
                    className={`nav-link ${detailActiveTab === 'overview' ? 'active' : ''}`} 
                    href="#"
                    onClick={(e) => { e.preventDefault(); setDetailActiveTab('overview'); }}
                  >
                    Overview
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${detailActiveTab === 'trends' ? 'active' : ''}`} 
                    href="#"
                    onClick={(e) => { e.preventDefault(); setDetailActiveTab('trends'); }}
                  >
                    Submission Trend
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${detailActiveTab === 'alerts' ? 'active' : ''}`} 
                    href="#"
                    onClick={(e) => { e.preventDefault(); setDetailActiveTab('alerts'); }}
                  >
                    Alert Distribution
                  </a>
                </li>
              </ul>
            </div>
            
            <div className="tab-content mt-3">
              {/* Overview Tab */}
              <div className={`tab-pane ${detailActiveTab === 'overview' ? 'active show' : ''}`}>
                <div className="row row-cards">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between">
                          <div>
                            <div className="subheader">TOTAL SUBMISSIONS</div>
                            <div className="h1 mt-2">{selectedEnumeratorData.filteredTotal || selectedEnumeratorData.totalSubmissions}</div>
                          </div>
                          <div>
                            <span className="badge bg-primary text-white p-2">
                              {timeframe === 'all' ? 'All time' : `Last ${timeframe.replace('days', ' days')}`}
                            </span>
                          </div>
                        </div>
                        <div className="d-flex mt-3">
                          <div>Submission Rate</div>
                          <div className="ms-auto text-green">
                            {Math.round((selectedEnumeratorData.filteredTotal || selectedEnumeratorData.totalSubmissions) / (enumerators.reduce((sum, e) => sum + (e.filteredTotal || e.totalSubmissions), 0) / enumerators.length) * 100)}%
                            <svg xmlns="http://www.w3.org/2000/svg" className="icon ms-1" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                              <path d="M3 17l6 -6l4 4l8 -8"></path>
                              <path d="M14 7l7 0l0 7"></path>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between">
                          <div>
                            <div className="subheader">QUALITY SCORE</div>
                            <div className="h1 mt-2">{(100 - (selectedEnumeratorData.filteredErrorRate !== undefined ? selectedEnumeratorData.filteredErrorRate : selectedEnumeratorData.errorRate)).toFixed(1)}%</div>
                          </div>
                          <div>
                            <span className="badge bg-success text-white p-2">
                              Performance
                            </span>
                          </div>
                        </div>
                        <div className="d-flex mt-3">
                          <div>Clean Submissions</div>
                          <div className="ms-auto text-green">
                            {(selectedEnumeratorData.filteredTotal || selectedEnumeratorData.totalSubmissions) - 
                             (selectedEnumeratorData.filteredAlertsCount || selectedEnumeratorData.submissionsWithAlerts)}
                            <span className="text-muted ms-2">
                              of {selectedEnumeratorData.filteredTotal || selectedEnumeratorData.totalSubmissions}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Trends Tab */}
              <div className={`tab-pane ${detailActiveTab === 'trends' ? 'active show' : ''}`}>
                <h4 className="mb-3">
                  Submission Trend for {selectedEnumeratorData.name} ({timeframe === 'all' ? 'All Time' : `Last ${timeframe.replace('days', ' days')}`})
                </h4>
                <HighchartsReact highcharts={Highcharts} options={selectedEnumeratorTrendOptions} />
              </div>
              
              {/* Alerts Tab */}
              <div className={`tab-pane ${detailActiveTab === 'alerts' ? 'active show' : ''}`}>
                <h4 className="mb-3">Alert Types for {selectedEnumeratorData.name}</h4>
                <HighchartsReact highcharts={Highcharts} options={alertDistributionOptions} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnumeratorPerformance; 