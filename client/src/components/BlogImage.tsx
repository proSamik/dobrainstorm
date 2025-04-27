'use client';

import React from 'react';
import { DEFAULT_BLOG_IMAGE, ensureImagePath } from '@/lib/image-utils';

interface BlogImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * BlogImage component that uses a regular img tag instead of next/image
 * for blog images to avoid optimization issues.
 */
export default function BlogImage({ src, alt, className = '' }: BlogImageProps) {
  const [error, setError] = React.useState(false);
  const processedSrc = ensureImagePath(src);
  
  // Handle image loading errors
  const handleError = () => {
    if (!error) {
      setError(true);
    }
  };
  
  return (
    <img
      src={error ? DEFAULT_BLOG_IMAGE : processedSrc}
      alt={alt}
      className={`object-cover ${className}`}
      onError={handleError}
    />
  );
} 