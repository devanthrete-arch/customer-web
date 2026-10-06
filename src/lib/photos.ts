const crop = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const photos = {
  hero: crop('photo-1558981403-c5f9899a28bc', 1600),
  bay: crop('photo-1486262715619-67b85e0b08d3', 900),
  slot: crop('photo-1449965408869-eaa3f722e40d', 900),
  ride: crop('photo-1558981806-ec527fa84c39', 900),
  bike: crop('photo-1558981403-c5f9899a28bc', 800),
  car: crop('photo-1492144534655-ae79c964c9d7', 800),
};

export function vehiclePhoto(type: string | null | undefined): string {
  return type === 'FOUR_WHEELER' ? photos.car : photos.bike;
}
