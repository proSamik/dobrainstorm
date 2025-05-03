// Client-side API key validation module

import { ApiProvider } from './models/providers';

/**
 * Formats and masks an API key for display
 * @param key API key to mask
 * @returns Masked API key
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  
  // Show first 4 and last 4 characters, mask the rest
  if (key.length <= 8) {
    return '••••••••';
  }
  
  const firstFour = key.substring(0, 4);
  const lastFour = key.substring(key.length - 4);
  const middleLength = key.length - 8;
  const maskedMiddle = '•'.repeat(Math.min(middleLength, 10));
  
  return `${firstFour}${maskedMiddle}${lastFour}`;
} 