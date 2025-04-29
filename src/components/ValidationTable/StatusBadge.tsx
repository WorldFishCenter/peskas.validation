import React from 'react';
import { STATUS_STYLES, ValidationStatus } from '../../types/validation';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  // Use exact status or default
  const style = STATUS_STYLES[(status || 'default') as ValidationStatus];
  
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