import { Link } from 'react-router-dom';
import { Linkedin, Instagram, ArrowUpRight } from 'lucide-react';

const columns: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: 'Produto',
    links: [
      { label: 'Como funciona', to: '#como-funciona' },
      { label: 'O que muda', to: '#produto' },
      { label: 'FAQ', to: '#faq' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'MCM Group', to: 'https://www.mcmbr.com', external: true },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full bg-white border-t border-gray-100 px-5 pt-16 md:pt-20 pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left md:justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4 max-w-sm">
            <Link to="/" className="font-satoshi font-bold text-[24px] tracking-[-0.5px] text-[#1d1d1f]">
              Noren
            </Link>
            <p className="text-[15px] text-[#6b6b70] leading-relaxed">
              Gestão de pessoas com IA, da candidatura ao desenvolvimento do time.
            </p>
          </div>

          <Link
            to="/signup"
            className="holo-gradient rounded-full p-[2px] hover:opacity-95 transition-opacity"
          >
            <span className="bg-white rounded-full pl-5 pr-3 py-3 text-[14px] font-semibold text-[#1d1d1f] flex items-center gap-2">
              Criar conta grátis
              <span className="h-7 w-7 rounded-full holo-gradient flex items-center justify-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </span>
            </span>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 pt-12 border-t border-gray-100 text-center sm:text-left">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col items-center sm:items-start gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[14px] text-[#6b6b70] hover:text-[#1d1d1f] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.to}
                        className="text-[14px] text-[#6b6b70] hover:text-[#1d1d1f] transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-4">
              Conecta
            </h4>
            <ul className="flex flex-col items-center sm:items-start gap-2">
              <li>
                <a
                  href="https://www.linkedin.com/company/mcmbr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[14px] text-[#6b6b70] hover:text-[#1d1d1f] transition-colors group"
                >
                  <Linkedin className="h-4 w-4 group-hover:text-[#1d1d1f] transition-colors" />
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/mcmbr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[14px] text-[#6b6b70] hover:text-[#1d1d1f] transition-colors group"
                >
                  <Instagram className="h-4 w-4 group-hover:text-[#1d1d1f] transition-colors" />
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3 text-center sm:text-left">
          <p className="text-[13px] text-[#8a8a8f]">
            © {year} Noren. Todos os direitos reservados.
          </p>
          <p className="text-[13px] text-[#8a8a8f]">
            Uma empresa da{' '}
            <a
              href="https://www.mcmbr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1d1d1f] font-semibold hover:underline"
            >
              MCM Group
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
