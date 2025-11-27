import React from 'react';

interface AlertBadgeProps {
  alertFlag: string;
  alertFlags?: string[];
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ alertFlag, alertFlags }) => {
  if (!alertFlag || alertFlag.trim() === '') {
    return <span className="text-muted">—</span>;
  }

  const tooltipText = alertFlags && alertFlags.length > 0
    ? `Alerts: ${alertFlags.join(', ')}`
    : `Alert: ${alertFlag}`;

  return (
    <span
      className="badge bg-red-lt text-red cursor-help"
      title={tooltipText}
    >
      {alertFlag}
    </span>
  );
};

export default AlertBadge;
