'use client';

import React from 'react';
import Image from 'next/image';
import { DEFAULT_BLOG_IMAGE, ensureImagePath } from '@/lib/image-utils';

interface BlogImageProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

/**
 * BlogImage component that uses next/image with unoptimized setting
 * for blog images to avoid optimization issues while maintaining performance.
 */
export default function BlogImage({ 
  src, 
  alt, 
  className = '',
  width = 800,
  height = 600,
  fill = false 
}: BlogImageProps) {
  const [error, setError] = React.useState(false);
  const processedSrc = ensureImagePath(src);
  
  // Extract filename for fallback alt text
  const getAltFromSrc = (path: string): string => {
    // Extract filename from path
    const filename = path.split('/').pop() || '';
    // Remove extension and replace hyphens/underscores with spaces
    return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  };
  
  // Use provided alt text or extract from filename
  const altText = alt || getAltFromSrc(processedSrc);
  const finalAlt = error ? "Default image" : altText;
  
  // Handle image loading errors
  const handleError = () => {
    if (!error) {
      setError(true);
    }
  };
  
  // Return the appropriate Image component based on whether fill mode is requested
  if (fill) {
    return (
      <Image
        src={error ? DEFAULT_BLOG_IMAGE : processedSrc}
        alt={finalAlt}
        className={`object-cover ${className}`}
        unoptimized={true}
        onError={handleError}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    );
  }
  
  return (
    <Image
      src={error ? DEFAULT_BLOG_IMAGE : processedSrc}
      alt={finalAlt}
      className={`object-cover ${className}`}
      unoptimized={true}
      onError={handleError}
      width={width}
      height={height}
    />
  );
} 