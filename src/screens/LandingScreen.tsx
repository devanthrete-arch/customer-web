import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoLockup';

const steps = [
  {
    n: '1',
    title: 'Add your vehicle',
    body: 'Save the bike or scooter you actually ride. One account can hold more than one.',
  },
  {
    n: '2',
    title: 'Pick a center and a time',
    body: 'Tell us what it needs, choose a nearby center, and take an open slot.',
  },
  {
    n: '3',
    title: 'Bring it in',
    body: 'You ride there yourself. Pay at the center when the visit is done.',
  },
];

const points = [
  {
    title: 'One place for your vehicles',
    body: 'Registration, make, and model stay on your account, so the next booking starts from the vehicle — not from memory.',
  },
  {
    title: 'A booking you can open again',
    body: 'After you confirm, the visit stays under Services with the center, the time, and the status.',
  },
  {
    title: 'No card to enter',
    body: 'This visit is pay-at-center. You are not asked for card details before you arrive.',
  },
];

export function LandingScreen() {
  return (
    <div className="af-landing">
      <header className="af-landing-hero">
        <div className="af-landing-wrap">
          <nav className="af-landing-nav" aria-label="Landing">
            <Link className="af-landing-brand" to="/">
              <LogoMark decorative className="af-logo af-logo-nav" />
              <span>Autoflex</span>
            </Link>
            <div className="af-landing-nav-actions">
              <Link className="af-landing-signin" to="/auth/sign-in">
                Sign in
              </Link>
              <Link className="af-landing-cta" to="/auth/register">
                Get started
              </Link>
            </div>
          </nav>

          <div className="af-landing-hero-grid">
            <div>
              <LogoMark className="af-logo af-logo-hero" />
              <p className="af-landing-kicker">Care you can trust</p>
              <h1>Book a service without chasing the garage on WhatsApp.</h1>
              <p className="af-landing-lead">
                Autoflex is the place you keep your vehicle and the visit. Add it,
                choose a time, bring it in, and pay at the center.
              </p>
              <div className="af-landing-hero-actions">
                <Link className="af-landing-cta af-landing-cta-lg" to="/auth/register">
                  Get started
                </Link>
                <Link className="af-landing-signin af-landing-signin-lg" to="/auth/sign-in">
                  I already have an account
                </Link>
              </div>
            </div>

            <aside className="af-landing-preview" aria-label="What a confirmed visit looks like">
              <p className="af-landing-preview-kicker">After you confirm</p>
              <h2>Your visit stays on the account</h2>
              <dl>
                <div>
                  <dt>Service</dt>
                  <dd>Periodic service</dd>
                </div>
                <div>
                  <dt>How you arrive</dt>
                  <dd>You bring the vehicle in</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>Pay at the center</dd>
                </div>
              </dl>
              <p className="af-landing-preview-note">
                After you confirm, this card also shows the center and the time you picked.
              </p>
            </aside>
          </div>
        </div>
      </header>

      <main>
        <section className="af-landing-section">
          <div className="af-landing-wrap">
            <h2>How a visit works</h2>
            <p className="af-landing-intro">
              Three steps. You can sign in with your mobile number and stop as soon as the booking is confirmed.
            </p>
            <ol className="af-landing-steps">
              {steps.map((step) => (
                <li key={step.n}>
                  <span>{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="af-landing-section af-landing-section-alt">
          <div className="af-landing-wrap">
            <h2>What stays with you</h2>
            <ul className="af-landing-points">
              {points.map((point) => (
                <li key={point.title}>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="af-landing-section">
          <div className="af-landing-wrap af-landing-faq">
            <h2>Before you sign up</h2>
            <div>
              <h3>Do I pay on this page?</h3>
              <p>No. You confirm the visit first and pay at the center.</p>
            </div>
            <div>
              <h3>Will someone collect the vehicle?</h3>
              <p>Not yet. You bring it to the center yourself. Pickup is not available.</p>
            </div>
            <div>
              <h3>What do I need to start?</h3>
              <p>Your name, an Indian mobile number, your city, and the vehicle you want serviced.</p>
            </div>
          </div>
        </section>
      </main>

      <section className="af-landing-close">
        <div className="af-landing-wrap">
          <h2>Keep the next service in one place.</h2>
          <p>Create an account with your mobile number. It takes a short OTP, then your profile.</p>
          <Link className="af-landing-cta af-landing-cta-lg" to="/auth/register">
            Get started
          </Link>
        </div>
      </section>
    </div>
  );
}
