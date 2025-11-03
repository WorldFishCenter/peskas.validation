import React from 'react';
import { ValidationStatus } from '../../types/validation';

interface StatusBadgeProps {
  status: string;
}

// Map validation statuses to Tabler badge colors with proper text colors
const getStatusBadgeClass = (status: string): string => {
  const normalizedStatus = (status || 'default') as ValidationStatus;

  switch (normalizedStatus) {
    case 'validation_status_approved':
      return 'badge bg-green text-green-fg';
    case 'validation_status_not_approved':
      return 'badge bg-red text-red-fg';
    case 'validation_status_on_hold':
      return 'badge bg-yellow text-yellow-fg';
    default:
      return 'badge bg-secondary text-secondary-fg';
  }
};

// Format status text for display
const formatStatusText = (status: string): string => {
  if (!status) return 'Unknown';
  return status.replace('validation_status_', '').replace(/_/g, ' ');
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const badgeClass = getStatusBadgeClass(status);
  const displayText = formatStatusText(status);

  return (
    <span className={`${badgeClass} text-uppercase text-nowrap`}>
      {displayText}
    </span>
  );
};

export default StatusBadge;
