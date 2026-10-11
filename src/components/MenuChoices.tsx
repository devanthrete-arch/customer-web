import { choiceKey, type Choice } from '../lib/marketplace';
import { formatInr } from '../lib/format';
export function MenuChoices({
  menu,
  picked,
  toggle,
}: {
  menu: Choice[];
  picked: Set<string>;
  toggle: (key: string) => void;
}) {
  return (
    <>
      {(['SERVICE', 'PACKAGE'] as const).map((kind) => {
        const rows = menu.filter((item) => item.kind === kind);
        if (!rows.length) return null;
        return (
          <section key={kind}>
            <h2>{kind === 'SERVICE' ? 'Services' : 'Packages'}</h2>
            <div className="af-line-list">
              {rows.map((item) => (
                <label
                  className={`af-line ${picked.has(choiceKey(item)) ? '' : 'off'}`}
                  key={choiceKey(item)}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(choiceKey(item))}
                    onChange={() => toggle(choiceKey(item))}
                  />
                  <span>
                    <b>{item.name}</b>
                    <small>{item.description}</small>
                    <small>
                      {item.vehicleType === 'FOUR_WHEELER'
                        ? 'Car'
                        : item.vehicleType === 'TWO_WHEELER'
                          ? 'Bike / scooter'
                          : 'Center-supported vehicles'}{' '}
                      · About {item.durationMinutes} minutes
                    </small>
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
                  <b>
                    {item.priceIsStarting ? 'From ' : ''}
                    {formatInr(Number(item.priceInr))}
                  </b>
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
