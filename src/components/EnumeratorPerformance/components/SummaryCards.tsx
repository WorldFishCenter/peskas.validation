import React from 'react';
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
  return (
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
            <div className="text-muted mt-1">
              Error rate: {bestEnumerator.filteredErrorRate !== undefined 
                ? bestEnumerator.filteredErrorRate.toFixed(1) 
                : bestEnumerator.errorRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryCards; 