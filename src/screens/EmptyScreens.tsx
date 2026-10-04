import { Link } from 'react-router-dom';

export function EmptyModule({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="af-screen af-form">
      <h1 className="af-title">{title}</h1>
      <div className="af-empty">
        <p>{body}</p>
        <Link className="af-btn" to="/home">
          Back to home
        </Link>
        <Link className="af-btn ghost" to="/services/book/vehicle">
          Book service
        </Link>
      </div>
    </section>
  );
}
