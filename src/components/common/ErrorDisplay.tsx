import React from 'react';
import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorDisplayProps {
  error: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => (
  <div className="alert alert-danger">
    <IconAlertCircle className="icon me-2" size={24} stroke={2} />
    {error}
  </div>
);

export default ErrorDisplay; 