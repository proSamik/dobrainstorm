'use client';

import React from 'react';
import BlogImage from '@/components/BlogImage';

interface PostImageProps {
  src: string;
  alt: string;
}

/**
 * Client component for displaying post images with error handling
 */
const PostImage = ({ src, alt }: PostImageProps) => {
  return (
    <div className="w-full h-64 md:h-96 overflow-hidden relative bg-accent/20">
      <BlogImage
        src={src}
        alt={alt}
        fill
        className="object-cover"
      />
    </div>
  );
};

export { PostImage };
export default PostImage; 