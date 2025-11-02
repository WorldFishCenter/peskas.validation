import React from 'react';
import { STATUS_STYLES, ValidationStatus } from '../../types/validation';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  // Normalize status and fallback to default if not found
  const normalizedStatus = (status || 'default') as ValidationStatus;
  const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES['default'];

  // Debug log for unexpected statuses
  if (!STATUS_STYLES[normalizedStatus] && status) {
    console.warn(`Unknown validation status: "${status}". Using default style.`);
  }

  return (
    <span
      style={{
        backgroundColor: style.backgroundColor,
        color: style.textColor,
        border: `1px solid ${style.borderColor}`,
        borderRadius: '4px',
        padding: '4px 10px',
        display: 'inline-block',
        fontWeight: '500',
        fontSize: '0.875rem',
        textTransform: 'capitalize',
      }}
    >
      {status ? status.replace('validation_status_', '').replace(/_/g, ' ') : 'Unknown'}
    </span>
  );
};

export default StatusBadge; 