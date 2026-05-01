export const formatLocalDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.52 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 83.30 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.79 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rate: 151.45 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rate: 1.36 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rate: 1.35 }
];

export const getCurrencySymbol = (code: string = 'USD') => {
  return SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol || '$';
};

export const convertCurrency = (amount: number, fromCode: string = 'USD', toCode: string = 'USD') => {
  if (fromCode === toCode) return amount;
  
  const fromCurrency = SUPPORTED_CURRENCIES.find(c => c.code === fromCode);
  const toCurrency = SUPPORTED_CURRENCIES.find(c => c.code === toCode);
  
  if (!fromCurrency || !toCurrency) return amount;
  
  // Convert to USD first, then to target
  const inUsd = amount / fromCurrency.rate;
  return inUsd * toCurrency.rate;
};
