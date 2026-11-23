/**
 * Utility formatters for Bengali currency, numbers, and dates
 */

export const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return '৳ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatNumber = (num) => {
  const n = Number(num) || 0;
  return n.toLocaleString('en-IN');
};

export const formatDate = (dateInput) => {
  if (!dateInput) return '';
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatDateTime = (dateInput) => {
  if (!dateInput) return '';
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Convert number to Bengali Words for Cash Memo / Invoices
 */
export const numberToBengaliWords = (amount) => {
  const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ'];
  const n = Math.floor(Number(amount) || 0);
  if (n === 0) return 'শূন্য টাকা মাত্র';
  if (n <= 20) return `${units[n]} টাকা মাত্র`;
  return `${formatNumber(n)} টাকা মাত্র`;
};
