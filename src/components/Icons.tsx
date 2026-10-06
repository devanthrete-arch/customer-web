export type IconName =
  | 'home'
  | 'vehicle'
  | 'wrench'
  | 'file'
  | 'calendar'
  | 'history'
  | 'card'
  | 'support'
  | 'user'
  | 'bell'
  | 'status'
  | 'estimate'
  | 'pin'
  | 'pay';

const PATHS: Record<IconName, string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
  vehicle: 'M4 15h16M6 15l1.2-4.2A2 2 0 0 1 9.1 9h5.8a2 2 0 0 1 1.9 1.8L18 15M7 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  wrench: 'M14.5 6.5a3.5 3.5 0 0 0-4.8 4.3L4 16.5 7.5 20l5.7-5.7a3.5 3.5 0 0 0 4.3-4.8L15 12l-3-3z',
  file: 'M7 3.5h7l5 5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1zm7 0V9h5',
  calendar: 'M7 4v2M17 4v2M4.5 9h15M6 5.5h12a1.5 1.5 0 0 1 1.5 1.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1.5 1.5 0 0 1 1.5-1.5z',
  history: 'M12 7v5l3 2M5 12a7 7 0 1 0 2-4.9M5 5v3.2h3.2',
  card: 'M4 7.5h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm0 3h16',
  support: 'M12 20a8 8 0 1 0-8-8M12 16.5V12m0-4h.01',
  user: 'M12 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 12zm-6.2 7.2a6.2 6.2 0 0 1 12.4 0',
  bell: 'M6.5 16.5h11l-1.2-2.1V11a4.3 4.3 0 1 0-8.6 0v3.4zM10 16.5a2 2 0 0 0 4 0',
  status: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm0 3.2v4.6l2.8 1.6',
  estimate: 'M7 5.5h10v13l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2zM9 9h6M9 12h4',
  pin: 'M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10zm0-7.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  pay: 'M5 8.5h14v8H5zm2.5 0V7a4.5 4.5 0 0 1 9 0v1.5',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="af-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
