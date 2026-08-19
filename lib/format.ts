export function formatCurrency(amount: number, symbol = '₦'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    awaiting_payment: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    successful: 'bg-green-500/10 text-green-600 border-green-500/20',
    failed: 'bg-red-500/10 text-red-600 border-red-500/20',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
    active: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-600 border-green-500/20',
    cancelled: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    expired: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    credit: 'bg-green-500/10 text-green-600 border-green-500/20',
    debit: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  return map[status] ?? 'bg-gray-500/10 text-gray-600 border-gray-500/20';
}
