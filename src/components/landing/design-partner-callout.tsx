import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';

export function DesignPartnerCallout() {
  return (
    <section className="w-full py-16 md:py-24 px-5">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white border border-gray-200 rounded-[28px] p-8 md:p-10 text-center shadow-sm"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-gray-50 border border-gray-200">
            <Building2 className="h-3.5 w-3.5 text-[#6b6b70]" strokeWidth={2.2} />
            <span className="text-[12px] font-semibold text-[#6b6b70] uppercase tracking-wider">
              Design Partner
            </span>
          </div>

          <h3 className="font-satoshi font-bold text-[22px] md:text-[28px] tracking-[-0.4px] text-[#1d1d1f] mb-3">
            MCM. O primeiro cliente da Noren é a própria MCM.
          </h3>
          <p className="text-[15px] md:text-[16px] text-[#6b6b70] leading-relaxed max-w-2xl mx-auto">
            Antes de vender pra fora, a gente usa a Noren pra dentro: contratar,
            avaliar e acompanhar o próprio time. Cada decisão de produto passa pelo
            crivo de quem cuida de gente de verdade. Honestidade radical sobre o que
            funciona e o que não.
          </p>

          <p className="mt-5 text-[13px] text-[#8a8a8f] font-medium">
            Próximas 3-5 vagas de design partner abertas após o v1 entrar em produção.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default DesignPartnerCallout;
