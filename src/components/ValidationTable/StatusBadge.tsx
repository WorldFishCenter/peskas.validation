import React from 'react';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = (value: string): string => {
    switch (value) {
      case 'validation_status_approved':
        return 'bg-success';
      case 'validation_status_not_approved':
        return 'bg-danger';
      case 'validation_status_on_hold':
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  };

  const getStatusLabel = (value: string): string => {
    return value.replace('validation_status_', '').replace(/_/g, ' ');
  };

  return (
    <span className={`badge ${getStatusColor(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
};

export default StatusBadge; 