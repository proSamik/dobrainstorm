'use client';

import React from 'react';
import Image from 'next/image';
import { DEFAULT_BLOG_IMAGE, ensureImagePath } from '@/lib/image-utils';

interface BlogImageProps {
  src: string;
  alt: string;
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
  
  // Handle image loading errors
  const handleError = () => {
    if (!error) {
      setError(true);
    }
  };
  
  // Common props for both variants of the Image component
  const imageProps = {
    src: error ? DEFAULT_BLOG_IMAGE : processedSrc,
    alt,
    className: `object-cover ${className}`,
    unoptimized: true, // Disable optimization for blog images to ensure they load directly
    onError: handleError
  };
  
  // Return the appropriate Image component based on whether fill mode is requested
  if (fill) {
    return (
      <Image
        {...imageProps}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    );
  }
  
  return (
    <Image
      {...imageProps}
      width={width}
      height={height}
    />
  );
} 