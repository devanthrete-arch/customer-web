import { useState } from 'react';
import type { MarketplacePhoto } from '../lib/marketplace-imagery';
import { Icon } from './Icons';

type Props = {
  photo: MarketplacePhoto;
  src?: string | null;
  alt?: string;
  className?: string;
  labelStock?: boolean;
  stockLabel?: string;
  eager?: boolean;
};

export function MarketplaceImage(props: Props) {
  // A changed center URL gets a fresh attempt, including after a previous failure.
  return <ImageWithFallback key={`${props.src ?? ''}:${props.photo.src}`} {...props} />;
}

function ImageWithFallback({
  photo,
  src,
  alt,
  className = '',
  labelStock,
  stockLabel = 'Illustrative photo',
  eager,
}: Props) {
  const supplied = src && (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src)) ? src : null;
  const [failure, setFailure] = useState<'none' | 'primary' | 'all'>('none');
  const useSupplied = Boolean(supplied && failure === 'none');
  return (
    <span className={`af-market-image ${className}`}>
      {failure === 'all' ? (
        <span
          className="af-market-image-unavailable"
          role={alt === '' ? undefined : 'img'}
          aria-label={alt === '' ? undefined : 'Photo unavailable'}
          aria-hidden={alt === '' || undefined}
        >
          <Icon name="wrench" />
          <span>Photo unavailable</span>
        </span>
      ) : (
        <img
          src={useSupplied ? supplied! : photo.src}
          alt={alt === '' ? '' : useSupplied ? (alt ?? photo.alt) : photo.alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailure(useSupplied ? 'primary' : 'all')}
        />
      )}
      {labelStock && !useSupplied && failure !== 'all' && (
        <span className="af-market-image-caption">{stockLabel}</span>
      )}
    </span>
  );
}
