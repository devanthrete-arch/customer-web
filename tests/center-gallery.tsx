import { act, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { CenterGallery } from '../src/components/CenterGallery';
import '../src/index.css';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fixture = document.getElementById('fixture')!;
const status = document.getElementById('status')!;
const results = document.getElementById('results')!;
const root = createRoot(fixture);
const hero = '/images/marketplace/workshop.jpg';
const second = '/images/marketplace/brakes.jpg';
const third = '/images/marketplace/motorcycle-service.jpg';
let count = 0;
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function pass(message: string) {
  const item = document.createElement('li');
  item.textContent = `PASS: ${message}`;
  results.append(item);
  count++;
}
async function render(content: ReactNode) {
  await act(async () => root.render(<StrictMode>{content}</StrictMode>));
}
async function click(name: string) {
  const button = [...fixture.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.getAttribute('aria-label') === name,
  );
  check(button, `Missing button ${name}`);
  await act(async () => button!.click());
}
function mainImage() {
  return fixture.querySelector<HTMLImageElement>('.af-gallery-main img');
}
try {
  await render(
    <CenterGallery
      centerName="Fixture workshop"
      supportedVehicleTypes={['TWO_WHEELER', 'FOUR_WHEELER']}
    />,
  );
  check(
    fixture.textContent?.includes('Stock illustrations, not photos of this center.') &&
      fixture.querySelector('.af-market-image-caption')?.textContent === 'Illustrative photo' &&
      !mainImage()?.alt.includes('Fixture workshop'),
    'Fallback imagery must clearly say it is illustrative rather than depicting this center',
  );
  pass('Missing center photos produce an explicitly labeled illustrative gallery.');

  await render(
    <CenterGallery
      centerName="Fixture workshop"
      heroImageUrl={hero}
      photoUrls={[hero, second, third, second]}
    />,
  );
  check(
    mainImage()?.getAttribute('src') === hero &&
      fixture.querySelectorAll('.af-gallery-thumbnails button').length === 3 &&
      fixture.textContent?.includes('Photo 1 of 3'),
    'The cover must appear first and repeated photo URLs must appear only once',
  );
  await click('Next photo of Fixture workshop');
  check(
    mainImage()?.getAttribute('src') === second && fixture.textContent?.includes('Photo 2 of 3'),
    'Next must select the second image and announce its position',
  );
  await click('Show photo 3 of 3 of Fixture workshop');
  check(
    mainImage()?.getAttribute('src') === third &&
      fixture.querySelector<HTMLButtonElement>(
        'button[aria-label="Next photo of Fixture workshop"]',
      )?.disabled &&
      fixture
        .querySelector('button[aria-label="Show photo 3 of 3 of Fixture workshop"]')
        ?.getAttribute('aria-pressed') === 'true',
    'Thumbnails must select the requested image and expose selection and navigation limits',
  );
  await click('Previous photo of Fixture workshop');
  check(mainImage()?.getAttribute('src') === second, 'Previous must return to the preceding image');
  pass(
    'The cover leads a deduplicated gallery; named buttons and thumbnails navigate without automatic rotation.',
  );

  await act(async () => mainImage()!.dispatchEvent(new Event('error')));
  check(
    mainImage()?.getAttribute('src') !== second &&
      fixture.querySelector('.af-gallery-main .af-market-image-caption')?.textContent ===
        'Illustrative photo',
    'A failed center photo must fall back to clearly labeled stock imagery',
  );
  await act(async () => mainImage()!.dispatchEvent(new Event('error')));
  check(
    fixture.querySelector('.af-gallery-main [aria-label="Photo unavailable"]'),
    'A failed fallback must show a stable unavailable state',
  );
  await click('Show photo 1 of 3 of Fixture workshop');
  check(
    mainImage()?.getAttribute('src') === hero,
    'A different image must retain its own fresh load attempt',
  );
  pass(
    'Image failures preserve gallery controls, disclose the stock fallback, and recover on another photo.',
  );

  await click('Show photo 3 of 3 of Fixture workshop');
  await render(
    <CenterGallery centerName="Fixture workshop" heroImageUrl={second} photoUrls={[]} />,
  );
  check(
    mainImage()?.getAttribute('src') === second &&
      fixture.textContent?.includes('Photo 1 of 1') &&
      !fixture.querySelector('.af-gallery-navigation'),
    'Replacing the gallery must reset its selected position and remove obsolete controls',
  );
  pass(
    'Replacing a gallery resets the current image and handles a single photo without unnecessary controls.',
  );

  await render(
    <CenterGallery centerName="Fixture workshop" supportedVehicleTypes={['TWO_WHEELER']} />,
  );
  const decorativeThumbnail = fixture.querySelector<HTMLImageElement>('.af-gallery-thumbnails img');
  check(
    decorativeThumbnail?.getAttribute('alt') === '',
    'Illustrative thumbnails must remain decorative inside their named controls',
  );
  await act(async () => decorativeThumbnail!.dispatchEvent(new Event('error')));
  check(
    !fixture.querySelector('.af-gallery-thumbnails [role="img"]') &&
      fixture
        .querySelector('.af-gallery-thumbnails .af-market-image-unavailable')
        ?.getAttribute('aria-hidden') === 'true',
    'An unavailable thumbnail must not add a redundant image announcement',
  );
  pass(
    'Decorative gallery thumbnails stay silent to assistive technology across fallback and unavailable states.',
  );

  await render(
    <a href="#center">
      <CenterGallery
        centerName="Fixture workshop"
        heroImageUrl={hero}
        photoUrls={[second, third]}
        variant="preview"
      />
    </a>,
  );
  check(
    fixture.querySelectorAll('.af-center-gallery-collage img').length === 3 &&
      fixture.querySelectorAll('a button, a a, a input, a select').length === 0,
    'A center-card collage must show multiple images without nested interactive controls',
  );
  pass(
    'Center preview collages show several photos while remaining safe inside a single center link.',
  );

  await render(
    <CenterGallery
      centerName="A workshop with a long accessible gallery name"
      heroImageUrl={hero}
      photoUrls={[second, third]}
    />,
  );
  for (const width of [360, 390]) {
    fixture.style.width = `${width}px`;
    fixture.style.maxWidth = '100%';
    check(
      fixture.scrollWidth <= fixture.clientWidth + 1,
      `Gallery must fit a ${width}px container without page overflow`,
    );
  }
  pass(
    'The gallery stays inside narrow mobile containers while its thumbnail strip scrolls locally.',
  );
  status.textContent = `All ${count} center gallery scenarios passed.`;
} catch (error) {
  status.textContent = `FAILED: ${error instanceof Error ? error.message : error}`;
  console.error(error);
} finally {
  await act(async () => root.unmount());
}
