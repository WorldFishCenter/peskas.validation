import React from 'react';

interface AlertBadgeProps {
  alertFlag: string;
  alertFlags?: string[];
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ alertFlag, alertFlags }) => {
  if (!alertFlag || alertFlag.trim() === '') {
    return <span className="text-muted">—</span>;
  }

  return (
    <span
      className="alert-badge"
      title={
        alertFlags && alertFlags.length > 0
          ? `Alerts: ${alertFlags.join(', ')}`
          : `Alert: ${alertFlag}`
      }
      style={{
        cursor: 'help',
        textAlign: 'center',
        display: 'block',
        backgroundColor: 'rgba(220, 53, 69, 0.15)',
        color: '#dc3545',
        border: '1px solid rgba(220, 53, 69, 0.3)',
        borderRadius: '4px',
        padding: '2px 8px',
        fontWeight: '600',
        fontSize: '0.85rem'
      }}
    >
      {alertFlag}
    </span>
  );
};

export default AlertBadge; 