import React from 'react';
import {
  IconChartBar,
  IconTrendingUp,
  IconStar,
  IconAlertTriangle
} from '@tabler/icons-react';
import { ChartTabType, EnumeratorData } from '../types';
import SubmissionVolumeChart from '../charts/SubmissionVolumeChart';
import QualityRankingChart from '../charts/QualityRankingChart';
import SubmissionTrendChart from '../charts/SubmissionTrendChart';
import AlertDistributionChart from '../charts/AlertDistributionChart';

interface ChartTabsProps {
  activeTab: ChartTabType;
  setActiveTab: (tab: ChartTabType) => void;
  enumerators: EnumeratorData[];
  onEnumeratorSelect: (name: string) => void;
  uniqueDates: string[];
}

// Tab configurations with icons and descriptions
const tabConfig = {
  volume: {
    icon: IconChartBar,
    label: 'Volume',
    description: 'Compare submission counts across enumerators. Click any bar to see details.',
    color: 'primary'
  },
  trends: {
    icon: IconTrendingUp,
    label: 'Trends',
    description: 'Track submission patterns over time for top 10 enumerators.',
    color: 'purple'
  },
  quality: {
    icon: IconStar,
    label: 'Quality',
    description: 'Rank enumerators by data quality (% submissions without alerts).',
    color: 'green'
  },
  errors: {
    icon: IconAlertTriangle,
    label: 'Alerts',
    description: 'See which alert types occur most frequently across all data.',
    color: 'orange'
  }
};

const ChartTabs: React.FC<ChartTabsProps> = ({
  activeTab,
  setActiveTab,
  enumerators,
  onEnumeratorSelect,
  uniqueDates
}) => {
  const currentTab = tabConfig[activeTab];

  return (
    <div className="card mb-4">
      <div className="card-header">
        <ul className="nav nav-tabs card-header-tabs">
          {(Object.keys(tabConfig) as ChartTabType[]).map((tabKey) => {
            const tab = tabConfig[tabKey];
            const TabIcon = tab.icon;
            const isActive = activeTab === tabKey;

            return (
              <li className="nav-item" key={tabKey}>
                <a
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  href="#"
                  onClick={(e) => { e.preventDefault(); setActiveTab(tabKey); }}
                >
                  <TabIcon
                    size={16}
                    stroke={1.5}
                    className={`me-1 ${isActive ? `text-${tab.color}` : ''}`}
                  />
                  {tab.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Tab description ribbon */}
      <div className={`bg-${currentTab.color}-lt border-bottom px-3 py-2`}>
        <small className="text-secondary">
          {currentTab.description}
        </small>
      </div>

      <div className="card-body">
        <div className="tab-content">
          {/* Volume Tab */}
          <div className={`tab-pane ${activeTab === 'volume' ? 'active show' : ''}`}>
            <SubmissionVolumeChart
              enumerators={enumerators}
              onEnumeratorSelect={onEnumeratorSelect}
            />
          </div>

          {/* Trends Tab */}
          <div className={`tab-pane ${activeTab === 'trends' ? 'active show' : ''}`}>
            <SubmissionTrendChart
              enumerators={enumerators}
              uniqueDates={uniqueDates}
            />
          </div>

          {/* Quality Tab */}
          <div className={`tab-pane ${activeTab === 'quality' ? 'active show' : ''}`}>
            <QualityRankingChart enumerators={enumerators} />
          </div>

          {/* Error Distribution Tab */}
          <div className={`tab-pane ${activeTab === 'errors' ? 'active show' : ''}`}>
            <AlertDistributionChart enumerators={enumerators} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartTabs;
