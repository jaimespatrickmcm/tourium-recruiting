import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navItems = [
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Produto', href: '#produto' },
  { label: 'FAQ', href: '#faq' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pt-5 px-5 pointer-events-none">
      <nav className="max-w-4xl mx-auto pointer-events-auto">
        <div className="flex items-center justify-between bg-white border border-line-soft rounded-full h-14 pl-5 pr-2 shadow-e1">
          <Link to="/" className="flex-shrink-0 font-satoshi font-bold text-[20px] tracking-[-0.5px] text-ink">
            Noren
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-callout text-ink font-medium px-3 py-2 rounded-full hover:bg-canvas transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              className="text-callout text-ink font-medium px-3 py-2 rounded-full hover:bg-canvas transition-colors"
            >
              Entrar
            </Link>
          </div>

          <Link
            to="/signup"
            className="hidden md:inline-flex holo-gradient rounded-full p-[2px] hover:opacity-95 transition-opacity flex-shrink-0"
          >
            <span className="bg-white rounded-full px-4 py-2 text-footnote font-semibold text-ink">
              Criar conta
            </span>
          </Link>

          <button
            className="md:hidden h-10 w-10 rounded-full flex items-center justify-center text-ink hover:bg-canvas transition-colors flex-shrink-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" strokeWidth={2.5} /> : <Menu className="h-5 w-5" strokeWidth={2.5} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden mt-2 bg-white border border-line-soft rounded-card p-2 shadow-e2">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-callout text-ink font-medium px-4 py-3 rounded-tile hover:bg-canvas transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-callout text-ink font-medium px-4 py-3 rounded-tile hover:bg-canvas transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileOpen(false)}
              className="mt-1 w-full holo-gradient rounded-tile p-[2px] block"
            >
              <span className="block bg-white rounded-control px-4 py-3 text-callout font-semibold text-ink text-center">
                Criar conta
              </span>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
