export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  try {
    // Check if the date string is actually a Unix timestamp (number)
    const timestamp = Number(dateStr);
    const date = !isNaN(timestamp) 
      ? new Date(timestamp * 1000)  // Convert seconds to milliseconds
      : new Date(dateStr);

    // Check if it's a valid date object
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

export const formatDateShort = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
  try {
    // For submission date, we only want YYYY-MM-DD
    return dateStr.split('T')[0];
  } catch (e) {
    return 'Invalid Date';
  }
}; 