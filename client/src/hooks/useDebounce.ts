import { useCallback, useRef } from 'react';

/**
 * Custom hook for debouncing function calls
 * Useful for limiting the frequency of expensive operations
 * 
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export const useDebounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      fn(...args);
    }, delay);
  }, [fn, delay]);
}; 