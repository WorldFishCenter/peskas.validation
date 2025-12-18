import React from 'react';
import { useTranslation } from 'react-i18next';
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
    default:
      return 'badge bg-secondary text-secondary-fg';
  }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation('common');
  const badgeClass = getStatusBadgeClass(status);

  // Map status to translation key
  const getStatusKey = (status: string): string => {
    const normalized = status || 'default';
    const key = normalized.replace('validation_status_', '');
    return `status.${key}`;
  };

  const displayText = t(getStatusKey(status));

  return (
    <span className={`${badgeClass} text-uppercase text-nowrap`}>
      {displayText}
    </span>
  );
};

export default StatusBadge;
