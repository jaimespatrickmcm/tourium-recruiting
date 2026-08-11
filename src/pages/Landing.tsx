import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pillars } from '@/components/landing/pillars';
import { UseCases } from '@/components/landing/use-cases';
import { Stats } from '@/components/landing/stats';
import { DesignPartnerCallout } from '@/components/landing/design-partner-callout';
import { Faq } from '@/components/landing/faq';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';
import { Reveal } from '@/components/landing/reveal';

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <HowItWorks />
        <Reveal delay={40}>
          <Pillars />
        </Reveal>
        <Reveal delay={40}>
          <UseCases />
        </Reveal>
        <Reveal delay={40}>
          <Stats />
        </Reveal>
        <Reveal delay={40}>
          <DesignPartnerCallout />
        </Reveal>
        <Reveal delay={40}>
          <Faq />
        </Reveal>
        <Reveal variant="scale">
          <FinalCta />
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
