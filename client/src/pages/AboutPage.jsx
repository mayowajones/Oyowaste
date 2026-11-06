import { Link } from 'react-router-dom';

function AboutPage() {
  return (
    <section className="page about-page">
      <div className="about-hero">
        <div className="about-copy">
          <p className="eyebrow">About Oyowaste</p>
          <h1>Helping Oyo State manage waste with purpose and pride.</h1>
          <p>
            Oyowaste brings residents, pickup teams, and local authorities together through a single digital system for requests,
            tracking, and public service updates.
          </p>
          <div className="hero-actions">
            <Link to="/" className="button primary">Back to Home</Link>
            <Link to="/request" className="button secondary">Request Pickup</Link>
          </div>
        </div>

        <div className="about-image-card">
          <img
            src="https://images.unsplash.com/photo-1694903683483-b373e71a4847?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Community waste management team working together"
          />
        </div>
      </div>

      <div className="feature-grid">
        <article>
          <h3>Community-first</h3>
          <p>We focus on cleaner streets, faster responses, and better service for every neighborhood.</p>
        </article>
        <article>
          <h3>Transparent Operations</h3>
          <p>Residents can follow pickup progress, manage requests, and see their impact in one view.</p>
        </article>
        <article>
          <h3>Built for Growth</h3>
          <p>The platform is designed to scale across more communities as waste management needs evolve.</p>
        </article>
      </div>
    </section>
  );
}

export default AboutPage;
