import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mist">
      {/* Navbar */}
      <nav className="bg-white border-b border-line px-4 sm:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo flex items-center justify-center">
            <span className="text-white font-serif text-base">R</span>
          </div>
          <span className="font-serif text-lg text-ink">ResumeMatch</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-slate hover:text-indigo transition"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/register")}
            className="text-sm bg-indigo text-white px-4 py-2 rounded-lg hover:bg-indigo-dark transition"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-light px-3 py-1.5 rounded-full mb-6">
          <span className="text-xs font-medium text-indigo">
            AI-Powered Recruitment for Nepal
          </span>
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl text-ink leading-tight mb-5">
          Where the right CV
          <br />
          finds the right job
        </h1>

        <p className="text-slate text-base sm:text-lg max-w-xl mx-auto mb-8">
          Upload your resume once. Our NLP engine reads your skills, projects,
          and experience — then matches you to roles that actually fit, and
          notifies employers when you're a strong match.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => navigate("/register")}
            className="bg-indigo text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-indigo-dark transition"
          >
            Find your next role
          </button>
          <button
            onClick={() => navigate("/register")}
            className="bg-white border border-line text-ink px-6 py-3 rounded-xl text-sm font-medium hover:border-indigo/40 transition"
          >
            Hire top talent
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="font-serif text-2xl text-ink text-center mb-10">
          How it works
        </h2>

        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-line p-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-light flex items-center justify-center mb-4">
              <span className="text-lg">📄</span>
            </div>
            <h3 className="font-medium text-ink mb-2">Upload your CV</h3>
            <p className="text-sm text-slate">
              Our NLP pipeline extracts your skills, projects, and experience —
              automatically, in seconds.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-line p-6">
            <div className="w-10 h-10 rounded-lg bg-amber-light flex items-center justify-center mb-4">
              <span className="text-lg">🎯</span>
            </div>
            <h3 className="font-medium text-ink mb-2">Get matched</h3>
            <p className="text-sm text-slate">
              A semantic matching engine scores you against real job
              descriptions — not just keywords.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-line p-6">
            <div className="w-10 h-10 rounded-lg bg-success-light flex items-center justify-center mb-4">
              <span className="text-lg">📧</span>
            </div>
            <h3 className="font-medium text-ink mb-2">Get noticed</h3>
            <p className="text-sm text-slate">
              Score above 65% and you're notified instantly — employers see you
              in their ranked shortlist.
            </p>
          </div>
        </div>
      </div>

      {/* Stats-style section */}
      <div className="bg-ink text-white py-16">
        <div className="max-w-5xl mx-auto px-4 grid sm:grid-cols-3 gap-8 text-center">
          <div>
            <p className="font-serif text-3xl mb-1">NLP</p>
            <p className="text-white/60 text-sm">
              Semantic matching, not keyword search
            </p>
          </div>
          <div>
            <p className="font-serif text-3xl mb-1">65%</p>
            <p className="text-white/60 text-sm">
              Match threshold for instant notification
            </p>
          </div>
          <div>
            <p className="font-serif text-3xl mb-1">24</p>
            <p className="text-white/60 text-sm">
              Job categories, precisely classified
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h2 className="font-serif text-2xl sm:text-3xl text-ink mb-4">
          Ready to find your match?
        </h2>
        <p className="text-slate mb-8">
          Whether you're hiring or job hunting, ResumeMatch does the reading so
          you don't have to.
        </p>
        <button
          onClick={() => navigate("/register")}
          className="bg-indigo text-white px-8 py-3 rounded-xl text-sm font-medium hover:bg-indigo-dark transition"
        >
          Create your account
        </button>
      </div>

      {/* Footer */}
      <footer className="border-t border-line py-6 text-center">
        <p className="text-xs text-slate/60">
          ResumeMatch AI · Pokhara University · School of Engineering
        </p>
      </footer>
    </div>
  );
}

export default Landing;
