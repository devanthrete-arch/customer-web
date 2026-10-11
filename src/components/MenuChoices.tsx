import { choiceKey, vehicleTypeLabel, type Choice } from '../lib/marketplace';
import { formatInr } from '../lib/format';
import { choicePhotos } from '../lib/marketplace-imagery';
import { MarketplaceImage } from './MarketplaceImage';
export function MenuChoices({
  menu,
  picked,
  toggle,
  disabled,
  busy = false,
}: {
  menu: Choice[];
  picked: Set<string>;
  toggle: (key: string) => void;
  disabled?: (item: Choice) => boolean;
  busy?: boolean;
}) {
  return (
    <>
      {(['SERVICE', 'PACKAGE'] as const).map((kind) => {
        const rows = menu.filter((item) => item.kind === kind);
        if (!rows.length) return null;
        return (
          <section className="af-menu-section" key={kind}>
            <h2>{kind === 'SERVICE' ? 'Services' : 'Packages'}</h2>
            <p className="af-menu-intro">
              {kind === 'SERVICE'
                ? 'Choose the individual work you need.'
                : 'A group of services with one package price. Check the inclusions below.'}
            </p>
            <div className="af-menu-list">
              {rows.map((item) => (
                <label
                  className={`af-menu-choice ${picked.has(choiceKey(item)) ? 'is-selected' : ''} ${disabled?.(item) ? 'is-disabled' : ''}`}
                  key={choiceKey(item)}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(choiceKey(item))}
                    disabled={busy || disabled?.(item)}
                    onChange={() => toggle(choiceKey(item))}
                  />
                  <span className="af-menu-choice-photos" aria-hidden="true">
                    {choicePhotos(item).map((photo) => (
                      <MarketplaceImage key={photo.src} photo={photo} />
                    ))}
                  </span>
                  <span className="af-menu-choice-copy">
                    <b>{item.name}</b>
                    <small>{item.description}</small>
                    <small>
                      {item.vehicleTypes
                        ? item.vehicleTypes.map(vehicleTypeLabel).join(' · ')
                        : item.vehicleType
                          ? vehicleTypeLabel(item.vehicleType)
                          : 'Center-supported vehicles'}{' '}
                      · About {item.durationMinutes} minutes
                    </small>
                    {disabled?.(item) ? (
                      <small>Choose a separate booking for this vehicle type.</small>
                    ) : null}
                    {kind === 'PACKAGE' && (
                      <ul>
                        {item.scope.map((part) => (
                          <li key={part.offeringId}>
                            {part.quantity} × {part.name}
                            {part.description ? <small>{part.description}</small> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </span>
                  <b className="af-menu-choice-price">
                    {item.priceIsStarting ? 'From ' : ''}
                    {formatInr(Number(item.priceInr))}
                  </b>
                </label>
              ))}
            </div>
          </section>
        );
      })}
      {menu.length > 0 && (
        <p className="af-market-photo-note">
          Photos illustrate the type of work. The descriptions and package inclusions define your
          booking.
        </p>
      )}
    </>
  );
}
