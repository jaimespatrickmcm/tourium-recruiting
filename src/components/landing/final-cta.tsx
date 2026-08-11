import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function FinalCta() {
  return (
    <section className="w-full py-24 md:py-32 px-5">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="font-satoshi font-black text-[40px] sm:text-[56px] md:text-[72px] leading-[1.05] tracking-[-0.8px] text-[#1d1d1f]">
          Seu processo de gente pode andar sozinho <span className="holo-gradient-text">até a hora da sua decisão.</span>
        </h2>
        <p className="mt-5 text-[16px] md:text-[18px] text-[#6b6b70] font-medium">
          Configure o DNA da sua empresa hoje. A primeira candidatura já chega analisada.
        </p>

        <div className="mt-10 flex items-center justify-center">
          <Link
            to="/signup"
            className="holo-gradient rounded-full inline-flex items-center gap-2 pl-6 pr-3 py-3 text-white font-semibold text-[16px] hover:opacity-95 transition-opacity shadow-lg shadow-sky-500/30"
          >
            Começar agora
            <span className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default FinalCta;
