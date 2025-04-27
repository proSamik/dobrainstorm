'use client';

import React from 'react';
import Image from 'next/image';
import { handleImageError, ensureImagePath } from '@/lib/image-utils';

interface PostImageProps {
  src: string;
  alt: string;
}

/**
 * Client component for displaying post images with error handling
 */
const PostImage = ({ src, alt }: PostImageProps) => {
  // Process the image path
  const processedSrc = ensureImagePath(src);
  
  // Handle local blog images specifically
  const isBlogImage = processedSrc ? (
    processedSrc.startsWith('/blog/') || 
    (!processedSrc.startsWith('http') && !processedSrc.startsWith('/'))
  ) : false;
  
  return (
    <div className="w-full h-64 md:h-96 overflow-hidden relative bg-accent/20">
      <Image
        src={processedSrc}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 1200px"
        onError={handleImageError}
        unoptimized={true}
      />
    </div>
  );
};

export { PostImage };
export default PostImage; 