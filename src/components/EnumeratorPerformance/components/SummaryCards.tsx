import React from 'react';
import {
  IconFileAnalytics,
  IconUsers,
  IconAlertTriangle,
  IconTrophy
} from '@tabler/icons-react';
import { EnumeratorData } from '../types';

interface SummaryCardsProps {
  totalSubmissions: number;
  enumerators: EnumeratorData[];
  avgErrorRate: number;
  bestEnumerator: EnumeratorData;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalSubmissions,
  enumerators,
  avgErrorRate,
  bestEnumerator
}) => {
  // Determine error rate indicator color
  const getErrorRateColor = (rate: number) => {
    if (rate <= 10) return 'green';
    if (rate <= 25) return 'yellow';
    return 'red';
  };

  const errorRateColor = getErrorRateColor(avgErrorRate);
  const bestEnumeratorErrorRate = bestEnumerator.filteredErrorRate ?? bestEnumerator.errorRate;

  return (
    <div className="row row-deck row-cards mb-4">
      {/* Total Submissions */}
      <div className="col-sm-6 col-lg-3">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center mb-2">
              <span className="avatar avatar-sm bg-primary-lt me-2">
                <IconFileAnalytics size={18} stroke={1.5} />
              </span>
              <div className="subheader">Total Submissions</div>
            </div>
            <div className="h1 mb-0">{totalSubmissions.toLocaleString()}</div>
            <div className="text-muted small">In selected date range</div>
          </div>
        </div>
      </div>

      {/* Total Enumerators */}
      <div className="col-sm-6 col-lg-3">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center mb-2">
              <span className="avatar avatar-sm bg-purple-lt me-2">
                <IconUsers size={18} stroke={1.5} />
              </span>
              <div className="subheader">Enumerators</div>
            </div>
            <div className="h1 mb-0">{enumerators.length}</div>
            <div className="text-muted small">With activity in period</div>
          </div>
        </div>
      </div>

      {/* Average Error Rate */}
      <div className="col-sm-6 col-lg-3">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center mb-2">
              <span className={`avatar avatar-sm bg-${errorRateColor}-lt me-2`}>
                <IconAlertTriangle size={18} stroke={1.5} />
              </span>
              <div className="subheader">Avg Alert Rate</div>
            </div>
            <div className={`h1 mb-0 text-${errorRateColor}`}>{avgErrorRate.toFixed(1)}%</div>
            <div className="text-muted small">
              {avgErrorRate <= 10 ? 'Excellent' : avgErrorRate <= 25 ? 'Moderate' : 'Needs attention'}
            </div>
          </div>
        </div>
      </div>

      {/* Best Performer */}
      <div className="col-sm-6 col-lg-3">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center mb-2">
              <span className="avatar avatar-sm bg-green-lt me-2">
                <IconTrophy size={18} stroke={1.5} />
              </span>
              <div className="subheader">Top Performer</div>
            </div>
            <div className="h4 mb-0 text-truncate" title={bestEnumerator.name}>
              {bestEnumerator.name}
            </div>
            <div className="text-muted small">
              {(100 - bestEnumeratorErrorRate).toFixed(0)}% quality score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryCards; 