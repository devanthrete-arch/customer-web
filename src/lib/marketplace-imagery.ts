import type { Choice } from './marketplace';

export type MarketplacePhoto = { src: string; alt: string };
const photo = (file: string, alt: string): MarketplacePhoto => ({
  src: `/images/marketplace/${file}.jpg`,
  alt,
});

// Presentation only: these illustrations never determine availability or booked scope.
export const marketplacePhotos = {
  oil: photo('engine-oil', 'Gloved hands pouring oil into an engine'),
  brakes: photo('brakes', 'A mechanic inspecting a disc brake'),
  wheels: photo('wheels', 'A mechanic working beside a removed wheel'),
  wash: photo('wash', 'A vehicle being cleaned with a sponge'),
  battery: photo('battery', 'Battery cables connected in an engine bay'),
  workshop: photo('workshop', 'A car raised on a lift inside a workshop'),
  comfort: photo('comfort', "A close view of a vehicle's air-conditioning vent"),
  inspection: photo('inspection', 'A mechanic checking a vehicle under its open bonnet'),
  chain: photo('chain', 'The chain drive and rear wheel of a motorcycle'),
  bike: photo('motorcycle-service', 'A mechanic examining a motorcycle in a workshop'),
};

export function servicePhoto(item: {
  name: string;
  category?: string | null;
  categoryName?: string | null;
  vehicleType?: string | null;
}): MarketplacePhoto {
  const name = item.name.toLowerCase();
  if (/\b(ac|air conditioning|air-conditioning)\b/.test(name)) return marketplacePhotos.comfort;
  if (/\b(diagnostic|diagnostics|scan|obd)\b/.test(name)) return marketplacePhotos.inspection;
  if (/\b(chain|sprocket)\b/.test(name)) return marketplacePhotos.chain;
  if (/\b(suspension)\b/.test(name)) return marketplacePhotos.workshop;
  if (/\b(brake|brakes|abs)\b/.test(name)) return marketplacePhotos.brakes;
  if (/\b(tyre|tyres|tire|tires|wheel|wheels|puncture|alignment|balancing)\b/.test(name))
    return marketplacePhotos.wheels;
  if (/\b(oil|fluid|fluids)\b/.test(name)) return marketplacePhotos.oil;
  if (/\b(battery|electrical)\b/.test(name)) return marketplacePhotos.battery;
  if (/\b(wash|washing|clean|cleaning|foam|polish|detailing)\b/.test(name))
    return marketplacePhotos.wash;
  const category = (item.category ?? item.categoryName ?? '').toLowerCase();
  if (category.includes('brake')) return marketplacePhotos.brakes;
  if (category.includes('wheel') || category.includes('tyre')) return marketplacePhotos.wheels;
  if (category.includes('fluid') || category.includes('engine')) return marketplacePhotos.oil;
  if (category.includes('electrical')) return marketplacePhotos.battery;
  if (category.includes('clean')) return marketplacePhotos.wash;
  if (category.includes('comfort')) return marketplacePhotos.comfort;
  return item.vehicleType === 'TWO_WHEELER' ? marketplacePhotos.bike : marketplacePhotos.inspection;
}

export function choicePhotos(item: Choice): MarketplacePhoto[] {
  if (item.kind === 'SERVICE') return [servicePhoto(item)];
  // Show actual included activities, without inventing a package-specific photograph.
  const photos = item.scope.map((part) => servicePhoto({ ...part, vehicleType: item.vehicleType }));
  if (!photos.length) return [servicePhoto(item)];
  return [...new Map(photos.map((image) => [image.src, image])).values()].slice(0, 2);
}

export function centerPhoto(types: string[] = []): MarketplacePhoto {
  return types.length === 1 && types[0] === 'TWO_WHEELER'
    ? marketplacePhotos.bike
    : marketplacePhotos.inspection;
}
