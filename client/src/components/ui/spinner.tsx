import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Spinner component for loading states
 * Can be sized using the size prop
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  // Size classes for different spinner sizes
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div 
      className={cn(
        'animate-spin rounded-full border-solid border-gray-300 border-t-blue-600',
        sizeClasses[size],
        className
      )} 
      role="status" 
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
} 