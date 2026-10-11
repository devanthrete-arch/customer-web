import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icons';
import { LogoMark } from '../components/LogoLockup';
import { photos } from '../lib/photos';

const why = [
  {
    title: 'Before the visit',
    body: 'A clear price is hard to see, and the next booking starts from memory instead of the vehicle you actually own.',
  },
  {
    title: 'During the visit',
    body: 'Progress stays inside the garage. Extra work can appear without a record of what was proposed, or of your decision.',
  },
  {
    title: 'After the visit',
    body: 'The history is scattered across paper bills and chat threads. The next reminder has nowhere to live.',
  },
];

const steps: { title: string; body: string; icon: IconName; image: string; alt: string }[] = [
  {
    title: 'Explore services and centers',
    body: 'Sign in to explore the work you need, compare service prices, and see what each package includes. You can also start from a saved car or bike.',
    icon: 'vehicle',
    image: photos.ride,
    alt: 'A rider on a motorcycle along a city road',
  },
  {
    title: 'Choose your vehicle and a time',
    body: 'When you are ready to book, select or add your vehicle, check the work and price, and choose an open slot. The center confirms your booking before you arrive.',
    icon: 'calendar',
    image: photos.slot,
    alt: 'A car on an open road in daylight',
  },
  {
    title: 'Bring it in',
    body: 'You ride or drive it there yourself. When the work is done, you pay at the center by UPI, card, or cash. Pickup is not available yet.',
    icon: 'wrench',
    image: photos.bay,
    alt: 'A mechanic working on a vehicle in a workshop',
  },
];

const follow: { title: string; body: string; icon: IconName }[] = [
  {
    title: 'Status',
    body: 'From the request through pickup, the visit shows where the work stands.',
    icon: 'status',
  },
  {
    title: 'Estimate',
    body: 'The booked work and its price stay on the visit, so you can see them before you arrive.',
    icon: 'estimate',
  },
  {
    title: 'Your decision',
    body: 'Extra work is proposed to you. The center cannot silently add it.',
    icon: 'support',
  },
  {
    title: 'Center and time',
    body: 'The garage name, the slot, and your request stay attached to the booking.',
    icon: 'pin',
  },
  {
    title: 'Pay at the center',
    body: 'You are not asked for card details here. You pay by UPI, card, or cash when you collect the vehicle.',
    icon: 'pay',
  },
  {
    title: 'After the visit',
    body: 'Documents and the next service reminder stay with the vehicle, on the same account.',
    icon: 'file',
  },
];

const questions = [
  {
    q: 'Do I pay on this page?',
    a: 'No. You confirm the visit first and pay at the center.',
  },
  {
    q: 'Will someone collect the vehicle?',
    a: 'Not yet. You bring it to the center yourself. Pickup is not available.',
  },
  {
    q: 'What do I need to start?',
    a: 'Sign in with an Indian mobile number and complete your profile to explore. Choose or add your vehicle when you book. You must be at least 18 to make a booking.',
  },
  {
    q: 'Can the center add work without asking?',
    a: 'Extra work is proposed to you. The center cannot silently add it.',
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
          <div className="af-landing-hero-copy">
            <p className="af-landing-kicker">Care you can trust</p>
            <h1>Book a service. Watch the visit. Pay at the center.</h1>
            <p className="af-landing-lead">
              You hand a vehicle over and then wait, without a clear view of the work, the bill, or
              when it will be ready. Autoflex is the record of that visit: the vehicle, the booking,
              and the job, on one account.
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

          <div className="af-landing-stage">
            <img src={photos.hero} alt="A motorcycle parked in warm evening light" />
            <aside className="af-landing-preview" aria-label="What a confirmed visit looks like">
              <p className="af-landing-preview-kicker">After you book</p>
              <h2>The visit stays on your account</h2>
              <dl>
                <div>
                  <dt>
                    <Icon name="status" /> Status
                  </dt>
                  <dd>Booking confirmed</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="estimate" /> Estimate
                  </dt>
                  <dd>Periodic service · ₹1,499</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="pin" /> Center
                  </dt>
                  <dd>Apex Auto Garage · 11:00 am</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="pay" /> Payment
                  </dt>
                  <dd>Pay at the center</dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      <main>
        <section className="af-landing-section">
          <div className="af-landing-wrap">
            <h2>Why Autoflex exists</h2>
            <p className="af-landing-intro">
              Vehicle servicing is still one of the least clear things an owner does. Autoflex keeps
              the vehicle, the booking, and the job together, so you can open the same visit later.
            </p>
            <ul className="af-landing-why">
              {why.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="af-landing-section af-landing-section-alt">
          <div className="af-landing-wrap">
            <h2>How a visit works</h2>
            <p className="af-landing-intro">
              Sign in with your mobile number. You can stop as soon as the booking is confirmed.
            </p>
            <ol className="af-landing-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <img src={step.image} alt={step.alt} />
                  <div className="af-landing-step-copy">
                    <span>
                      <Icon name={step.icon} />
                      {index + 1}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="af-landing-section">
          <div className="af-landing-wrap af-landing-see">
            <div>
              <h2>What you can follow</h2>
              <p className="af-landing-intro">
                The same visit is visible to you and to the center. Nothing important lives only in
                a phone call.
              </p>
              <ul className="af-landing-points">
                {follow.map((point) => (
                  <li key={point.title}>
                    <span>
                      <Icon name={point.icon} />
                    </span>
                    <div>
                      <h3>{point.title}</h3>
                      <p>{point.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <img src={photos.bay} alt="A mechanic working on a vehicle in a workshop" />
          </div>
        </section>

        <section className="af-landing-section af-landing-section-alt">
          <div className="af-landing-wrap af-landing-faq">
            <h2>Before you sign up</h2>
            {questions.map((item) => (
              <div key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <section className="af-landing-close">
        <div className="af-landing-wrap">
          <img src={photos.ride} alt="A rider on a motorcycle along a city road" />
          <div>
            <h2>Keep the next service in one place.</h2>
            <p>
              Create an account with your mobile number. A short code confirms it is yours, then you
              complete your profile. Explore services and add your vehicle when you book. The
              booking and the job stay on the account.
            </p>
            <Link className="af-landing-cta af-landing-cta-lg" to="/auth/register">
              Get started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
