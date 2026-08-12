import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export type DnaDocument = {
  culture?: string;
  benefits?: string[];
  // legacy fields kept for backward compat (old wizard data lives here)
  values?: string[];
  workStyle?: { pace?: string; autonomy?: string; communication?: string; decisionMaking?: string };
  idealProfile?: string;
  antiFit?: string;
  leadership?: { style?: string; feedback?: string };
};

export type Company = {
  id: string;
  slug: string;
  name: string;
  dna_document: DnaDocument | null;
  dna_version: number;
  dna_completed_at: string | null;
  website_url: string | null;
  description: string | null;
  industry: string | null;
  stage: string | null;
  work_model: string | null;
  team_size: string | null;
  company_completed_at: string | null;
};

const COMPANY_FIELDS =
  'id, slug, name, dna_document, dna_version, dna_completed_at, website_url, description, industry, stage, work_model, team_size, company_completed_at';

export function useCompany() {
  const { user, loading: authLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('companies')
      .select(COMPANY_FIELDS)
      .limit(1)
      .maybeSingle<Company>();

    if (error) {
      console.error('[useCompany] fetch error:', error);
      setError(error.message);
      setLoading(false);
      return;
    }
    setCompany(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void fetchCompany();
  }, [authLoading, fetchCompany]);

  async function update(patch: Partial<Company>) {
    if (!company) return { error: 'No company loaded' };
    const { data, error } = await supabase
      .from('companies')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq('id', company.id)
      .select(COMPANY_FIELDS)
      .single<Company>();
    if (error) {
      console.error('[useCompany] update error:', error);
      return { error: error.message };
    }
    setCompany(data);
    return {};
  }

  return { company, loading: authLoading || loading, error, refetch: fetchCompany, update };
}
