export function LogoMark({
  decorative = false,
  className = 'af-logo',
}: {
  decorative?: boolean;
  className?: string;
}) {
  return (
    <img
      className={className}
      src="/autoflex-logo.png"
      alt={decorative ? '' : 'Autoflex'}
    />
  );
}

export function LogoLockup() {
  return (
    <div className="af-lockup">
      <LogoMark />
      <p className="af-wordmark">
        CAR <span>SERVICE</span>
      </p>
      <p className="af-tagline">CARE YOU CAN TRUST</p>
    </div>
  );
}
