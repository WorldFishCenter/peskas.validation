/**
 * Shared Highcharts configuration utilities
 * Provides consistent styling across all charts
 */

import Highcharts from 'highcharts';

/**
 * Base tooltip configuration with proper styling
 */
export const baseTooltipConfig: Highcharts.TooltipOptions = {
  useHTML: true,
  backgroundColor: 'rgba(255, 255, 255, 0.97)',
  borderColor: '#dee2e6',
  borderRadius: 8,
  borderWidth: 1,
  shadow: {
    color: 'rgba(0, 0, 0, 0.1)',
    offsetX: 1,
    offsetY: 2,
    width: 4
  },
  style: {
    fontSize: '13px',
    fontFamily: 'inherit'
  },
  padding: 12
};

/**
 * Format a tooltip row with colored bullet and value
 */
export const formatTooltipRow = (
  color: string,
  label: string,
  value: string | number,
  suffix: string = ''
): string => {
  return `<div style="display: flex; align-items: center; margin: 4px 0;">
    <span style="color: ${color}; font-size: 16px; margin-right: 6px;">●</span>
    <span style="color: #666;">${label}:</span>
    <span style="font-weight: 600; margin-left: 4px;">${value}${suffix}</span>
  </div>`;
};

/**
 * Format tooltip header
 */
export const formatTooltipHeader = (title: string): string => {
  return `<div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee;">${title}</div>`;
};

/**
 * Format a simple stat row without bullet
 */
export const formatStatRow = (
  label: string,
  value: string | number,
  suffix: string = ''
): string => {
  return `<div style="display: flex; justify-content: space-between; margin: 3px 0;">
    <span style="color: #666;">${label}:</span>
    <span style="font-weight: 500; margin-left: 12px;">${value}${suffix}</span>
  </div>`;
};

/**
 * Wrap content in tooltip container
 */
export const wrapTooltip = (content: string): string => {
  return `<div style="min-width: 180px;">${content}</div>`;
};

/**
 * Color palette for charts
 */
export const chartColors = {
  primary: '#206bc4',
  success: '#2fb344',
  warning: '#f76707',
  danger: '#d63939',
  info: '#4299e1',
  teal: '#0ca678',
  secondary: '#667382'
};

/**
 * Base chart configuration
 */
export const baseChartConfig: Partial<Highcharts.Options> = {
  credits: { enabled: false },
  chart: {
    style: {
      fontFamily: 'inherit'
    }
  }
};
