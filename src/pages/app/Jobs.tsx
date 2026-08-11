import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Briefcase, ExternalLink } from 'lucide-react';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/use-company';
import { useModal } from '@/contexts/modal-context';

type Job = {
  id: string;
  slug: string;
  title: string;
  status: string;
  created_at: string;
  applications_count?: number;
};

export function Jobs() {
  const { company } = useCompany();
  const { openModal } = useModal();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, slug, title, status, created_at, applications(count)')
        .order('created_at', { ascending: false });

      if (jobsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const withCounts = (jobsData as any[]).map((j) => ({
          ...j,
          applications_count: j.applications?.[0]?.count ?? 0,
        })) as Job[];
        setJobs(withCounts);
      }
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.05),transparent_70%)]" />

      <div className="relative max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
              Vagas
            </p>
            <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
              {jobs.length > 0 ? `${jobs.length} ${jobs.length === 1 ? 'vaga' : 'vagas'}` : 'Suas vagas'}
            </h1>
            <p className="text-[16px] text-[#6b6b70] mt-3 max-w-xl leading-relaxed">
              Cada vaga vira uma career page pública. A IA analisa cada candidato sob o DNA da sua empresa.
            </p>
          </div>
          <BrandCtaButton onClick={() => openModal('job-new')}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nova vaga
          </BrandCtaButton>
        </div>

        {loading ? (
          <div className="text-[#8a8a8f] text-sm">Carregando...</div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-gray-200 p-12 text-center">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-gray-100 items-center justify-center mb-4">
              <Briefcase className="h-6 w-6 text-[#6b6b70]" strokeWidth={1.5} />
            </div>
            <p className="text-[18px] font-semibold text-[#1d1d1f] mb-2">Nenhuma vaga ainda</p>
            <p className="text-[14px] text-[#6b6b70] mb-6 max-w-md mx-auto">
              Crie sua primeira vaga. A career page pública é gerada automaticamente.
            </p>
            <BrandCtaButton onClick={() => openModal('job-new')}>Criar vaga</BrandCtaButton>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                to={`/app/jobs/${job.id}`}
                className="block bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-satoshi font-bold text-[18px] tracking-[-0.2px] text-[#1d1d1f] truncate">
                      {job.title}
                    </p>
                    <p className="text-[13px] text-[#8a8a8f] mt-1">
                      {job.applications_count ?? 0} candidato
                      {job.applications_count === 1 ? '' : 's'} · status: {job.status}
                    </p>
                  </div>
                  {company && job.status === 'active' && (
                    <a
                      href={`/careers/${company.slug}/${job.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Career page
                    </a>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Jobs;
