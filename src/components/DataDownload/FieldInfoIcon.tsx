/**
 * FieldInfoIcon Component
 *
 * A small, accessible icon button that appears in data table column headers
 * to indicate that field metadata/documentation is available.
 *
 * When clicked, triggers the parent component to open a modal with detailed
 * field information (description, type, unit, examples, etc.).
 *
 * Features:
 * - Keyboard accessible (Enter/Space to activate)
 * - Screen reader friendly (aria-label)
 * - Hover effects for discoverability
 * - Follows Tabler UI icon patterns
 */

import React from 'react';
import { IconInfoCircle } from '@tabler/icons-react';

interface FieldInfoIconProps {
  /** The field name to show metadata for */
  fieldName: string;

  /** Callback when icon is clicked */
  onClick: (fieldName: string) => void;
}

const FieldInfoIcon: React.FC<FieldInfoIconProps> = ({ fieldName, onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering column sort or other handlers
    onClick(fieldName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onClick(fieldName);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-link p-0 ms-1 border-0 text-muted"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View field description for ${fieldName.replace(/_/g, ' ')}`}
      title="View field description"
      style={{
        cursor: 'pointer',
        lineHeight: 1,
        verticalAlign: 'middle'
      }}
    >
      <IconInfoCircle size={16} stroke={1.5} />
    </button>
  );
};

export default FieldInfoIcon;
