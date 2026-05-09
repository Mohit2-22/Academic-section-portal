import { Link } from "react-router-dom";
import Logo from "./Logo";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[var(--gu-cream)] text-[var(--gu-text)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#8B0000]/95 backdrop-blur-xl text-white border-b border-[var(--gu-gold)] shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:h-16 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-4 animate-fade-in">
            <Logo size="sm" />
          </div>

          <nav className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 md:gap-8 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em]">
            {[
              { name: "Home", path: "/" },
              { name: "About", path: "/about" },
              { name: "Academics", path: "/academics" },
              { name: "Portal Login", path: "/login" },
            ].map((link, i) => (
              <Link
                key={link.path}
                to={link.path}
                className="group relative py-1 text-white/70 hover:text-white transition-all duration-300 animate-slide-down"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {link.name}
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[var(--gu-gold)] transition-all duration-300 group-hover:w-full shadow-[0_0_8px_var(--gu-gold)]"></span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">{children}</main>

      {/* Footer */}
      <footer className="bg-[var(--gu-red-dark)] py-6 border-t border-[rgba(212,175,55,0.3)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
          <div className="opacity-80">
            <Logo size="md" />
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/70">
            <a
              href="#"
              className="hover:text-[var(--gu-gold)] transition-colors whitespace-nowrap"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="hover:text-[var(--gu-gold)] transition-colors whitespace-nowrap"
            >
              Contact
            </a>
            <a
              href="#"
              className="hover:text-[var(--gu-gold)] transition-colors whitespace-nowrap"
            >
              Help Desk
            </a>
          </div>
          <p className="font-serif text-sm tracking-wide text-white/60">
            &copy; 2025 Ganpat University. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
