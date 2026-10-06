import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoLockup';

const steps = [
  {
    n: '1',
    title: 'Add your vehicle',
    body: 'Save the bike, scooter, or car you use. One account can hold more than one.',
  },
  {
    n: '2',
    title: 'Pick a center and a time',
    body: 'Tell us what it needs, choose a nearby center, and take an open slot.',
  },
  {
    n: '3',
    title: 'Bring it in',
    body: 'You take the vehicle there yourself. Pay at the center when the visit is done.',
  },
];

const points = [
  {
    title: 'Status',
    body: 'From the request through pickup, the visit shows where the work stands.',
  },
  {
    title: 'Estimate',
    body: 'The booked work and its price stay on the visit, before anyone asks you to approve more.',
  },
  {
    title: 'Center',
    body: 'The garage name, the slot, and your request stay attached to the booking.',
  },
  {
    title: 'Pay at the center',
    body: 'You are not asked for card details here. You pay by UPI, card, or cash when you collect the vehicle.',
  },
];

export function LandingScreen() {
  return (
    <div className="af-landing">
      <header className="af-landing-bar">
        <div className="af-landing-wrap af-landing-nav">
          <Link className="af-landing-brand" to="/">
            <LogoMark decorative className="af-logo af-logo-nav" />
            <span>Autoflex</span>
          </Link>
          <nav className="af-landing-nav-actions" aria-label="Account">
            <Link className="af-landing-signin" to="/auth/sign-in">
              Sign in
            </Link>
            <Link className="af-landing-cta" to="/auth/register">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="af-landing-hero">
        <div className="af-landing-wrap af-landing-hero-grid">
          <div>
            <p className="af-landing-kicker">Care you can trust</p>
            <h1>Book a service. Watch the visit. Pay at the center.</h1>
            <p className="af-landing-lead">
              Autoflex is where you keep your vehicle and the service visit. Add it, choose a time,
              bring it in, and follow the work until it is ready.
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
            <p className="af-landing-preview-kicker">After you book</p>
            <h2>The visit stays on your account</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>Booking confirmed</dd>
              </div>
              <div>
                <dt>Estimate</dt>
                <dd>Periodic service · ₹1,499</dd>
              </div>
              <div>
                <dt>Center</dt>
                <dd>Apex Auto Garage · 11:00 am</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>Pay at the center</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <main>
        <section className="af-landing-section">
          <div className="af-landing-wrap">
            <h2>How a visit works</h2>
            <p className="af-landing-intro">
              Sign in with your mobile number. You can stop as soon as the booking is confirmed.
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
            <h2>What you can see after booking</h2>
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
          <p>Create an account with your mobile number. It takes a short code, then your profile.</p>
          <Link className="af-landing-cta af-landing-cta-lg" to="/auth/register">
            Get started
          </Link>
        </div>
      </section>
    </div>
  );
}
