import Link from "next/link";

export default function Home() {
  return (
    <main className="hero">
      <div className="hero-left">
        <div className="hero-content">
          <h1 className="hero-title">
            Flight. Sight.
            <br />
            Precision.
          </h1>

          <p className="hero-text">
            Aeroseeds uses aerial monitoring and intelligent sensing to help
            farmers detect problems early and act with precision.
          </p>

          <p className="hero-text">
            The brand represents the connection between nature, technology,
            and sustainable farming.
          </p>

          <Link href="/scan" className="hero-cta">
            GET INSIGHTS
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      <div className="hero-right">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding.png" alt="Aerial view of crops and fungal growth" />
        <div className="hero-scroll-indicator" />
      </div>
    </main>
  );
}
