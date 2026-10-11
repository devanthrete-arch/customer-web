import { useState } from 'react';
import { MarketplaceImage } from './MarketplaceImage';
import { centerPhoto, marketplacePhotos, type MarketplacePhoto } from '../lib/marketplace-imagery';

type Props = {
  centerName: string;
  heroImageUrl?: string | null;
  photoUrls?: string[] | null;
  supportedVehicleTypes?: string[];
  variant?: 'preview' | 'detail';
};
type GalleryPhoto = { src?: string; fallback: MarketplacePhoto };

function usableImageUrl(value: string | null | undefined) {
  const url = value?.trim();
  return url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null;
}

export function CenterGallery({
  centerName,
  heroImageUrl,
  photoUrls,
  supportedVehicleTypes = [],
  variant = 'detail',
}: Props) {
  const fallback = centerPhoto(supportedVehicleTypes);
  const supplied = [heroImageUrl, ...(photoUrls ?? []).slice(0, 8)]
    .map(usableImageUrl)
    .filter((url): url is string => Boolean(url));
  const urls = [...new Set(supplied)];
  const illustrations =
    supportedVehicleTypes.length === 1 && supportedVehicleTypes[0] === 'TWO_WHEELER'
      ? [fallback, marketplacePhotos.chain]
      : supportedVehicleTypes.includes('TWO_WHEELER')
        ? [fallback, marketplacePhotos.workshop, marketplacePhotos.bike]
        : [fallback, marketplacePhotos.workshop];
  const photos: GalleryPhoto[] = urls.length
    ? urls.map((src) => ({ src, fallback }))
    : [...new Map(illustrations.map((photo) => [photo.src, photo])).values()].map((photo) => ({
        fallback: photo,
      }));
  // Replacing a center's gallery resets the selected image and its failed-load state.
  return (
    <GalleryContents
      key={`${centerName}:${photos.map((photo) => photo.src ?? photo.fallback.src).join('|')}`}
      centerName={centerName}
      photos={photos}
      illustrative={!urls.length}
      variant={variant}
    />
  );
}

function GalleryContents({
  centerName,
  photos,
  illustrative,
  variant,
}: {
  centerName: string;
  photos: GalleryPhoto[];
  illustrative: boolean;
  variant: 'preview' | 'detail';
}) {
  const [selected, setSelected] = useState(0);
  if (variant === 'preview') {
    return (
      <span
        className="af-center-gallery-preview"
        role="group"
        aria-label={`${centerName} photo preview`}
      >
        <span
          className={`af-center-gallery-collage${photos.length === 1 ? ' af-gallery-single' : photos.length === 2 ? ' af-gallery-double' : ''}`}
        >
          {photos.slice(0, 3).map((photo, index) => (
            <MarketplaceImage
              key={photo.src ?? photo.fallback.src}
              src={photo.src}
              photo={photo.fallback}
              alt={`Photo ${index + 1} of ${centerName}`}
              labelStock
              stockLabel={index === 0 ? 'Illustrative photo' : 'Illustrative'}
              className={index === 0 ? 'af-gallery-cover' : 'af-gallery-preview-small'}
            />
          ))}
          <span className="af-gallery-count">
            {photos.length}{' '}
            {illustrative ? 'illustrations' : photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </span>
        {illustrative && (
          <span className="af-gallery-illustration-note">
            Illustrative images · Center photos not added
          </span>
        )}
      </span>
    );
  }
  const active = photos[selected];
  return (
    <section className="af-center-gallery" aria-label={`${centerName} photos`}>
      <div className="af-gallery-main">
        <MarketplaceImage
          src={active.src}
          photo={active.fallback}
          alt={`Photo ${selected + 1} of ${centerName}`}
          labelStock
          eager
        />
        {photos.length > 1 && (
          <div className="af-gallery-navigation">
            <button
              type="button"
              aria-label={`Previous photo of ${centerName}`}
              disabled={selected === 0}
              onClick={() => setSelected((index) => index - 1)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              aria-label={`Next photo of ${centerName}`}
              disabled={selected === photos.length - 1}
              onClick={() => setSelected((index) => index + 1)}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        )}
      </div>
      <div className="af-gallery-caption">
        <span role="status" aria-live="polite">
          {illustrative ? 'Illustration' : 'Photo'} {selected + 1} of {photos.length}
        </span>
        {illustrative && <span>Stock illustrations, not photos of this center.</span>}
      </div>
      {photos.length > 1 && (
        <div className="af-gallery-thumbnails" aria-label="Choose a photo">
          {photos.map((photo, index) => (
            <button
              key={photo.src ?? photo.fallback.src}
              type="button"
              aria-label={`Show ${illustrative ? 'illustration' : 'photo'} ${index + 1} of ${photos.length} of ${centerName}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <MarketplaceImage
                photo={photo.fallback}
                src={photo.src}
                alt=""
                labelStock
                stockLabel="Illustrative"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
