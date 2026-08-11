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
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-full h-14 pl-5 pr-2 shadow-[0_4px_20px_-4px_rgba(15,15,30,0.08)]">
          <Link to="/" className="flex-shrink-0 font-satoshi font-bold text-[20px] tracking-[-0.5px] text-[#1d1d1f]">
            Noren
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[14px] text-[#1d1d1f] font-medium px-3 py-2 rounded-full hover:bg-gray-50 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              className="text-[14px] text-[#1d1d1f] font-medium px-3 py-2 rounded-full hover:bg-gray-50 transition-colors"
            >
              Entrar
            </Link>
          </div>

          <Link
            to="/signup"
            className="hidden md:inline-flex holo-gradient rounded-full p-[2px] hover:opacity-95 transition-opacity flex-shrink-0"
          >
            <span className="bg-white rounded-full px-4 py-2 text-[13px] font-semibold text-[#1d1d1f]">
              Criar conta
            </span>
          </Link>

          <button
            className="md:hidden h-10 w-10 rounded-full flex items-center justify-center text-[#1d1d1f] hover:bg-gray-50 transition-colors flex-shrink-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" strokeWidth={2.5} /> : <Menu className="h-5 w-5" strokeWidth={2.5} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden mt-2 bg-white border border-gray-200 rounded-2xl p-2 shadow-[0_8px_30px_-8px_rgba(15,15,30,0.12)]">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block text-[15px] text-[#1d1d1f] font-medium px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-[15px] text-[#1d1d1f] font-medium px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileOpen(false)}
              className="mt-1 w-full holo-gradient rounded-xl p-[2px] block"
            >
              <span className="block bg-white rounded-[10px] px-4 py-3 text-[15px] font-semibold text-[#1d1d1f] text-center">
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
