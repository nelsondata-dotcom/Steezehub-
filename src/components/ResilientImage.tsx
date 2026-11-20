import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  title?: string;
  className?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  title,
  className = 'w-full h-full object-cover',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-[#EFECE6] text-[#575B62] p-6 text-center select-none"
        role="img"
        aria-label={alt}
      >
        <Package className="w-8 h-8 text-[#0F4C81]/70 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-[#575B62] line-clamp-2 max-w-[200px]">
          {title || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
