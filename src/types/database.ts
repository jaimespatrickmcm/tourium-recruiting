export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'owner' | 'recruiter' | 'viewer';
export type CompanyPlan = 'trial' | 'starter' | 'growth';
export type ApplicationStatus = 'triagem' | 'entrevista' | 'proposta' | 'contratado' | 'reprovado';
export type ApplicationEventType = 'stage_change' | 'note' | 'hired';
export type CollaboratorStatus = 'ativo' | 'desligado';
export type ScoreSource = 'analise_inicial' | 'avaliacao';
export type GoalStatus = 'em_andamento' | 'concluida' | 'pausada';
export type QuestionKind = 'culture' | 'reasoning';
export type JobVisibility = 'public' | 'private';
export type HighlightType = 'yes_no' | 'short_text';

/** Perfil de requisitos interno da vaga (jobs.requirements). Nunca exposto ao candidato. */
export type JobRequirements = {
  seniority: string;
  summary: string;
  must_have: string[];
  nice_to_have: string[];
  responsibilities: string[];
  evaluation_focus: string[];
  red_flags: string[];
};
export type AnswerSource = 'candidate_info' | 'job_question' | 'culture' | 'reasoning';

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          slug: string;
          name: string;
          plan: CompanyPlan;
          created_at: string;
          updated_at: string;
          dna_version: number;
          dna_document: Json | null;
          dna_completed_at: string | null;
          system_prompt_cached: string | null;
          retention_rejected_months: number;
          retention_hired_months: number;
          website_url: string | null;
          description: string | null;
          industry: string | null;
          stage: string | null;
          work_model: string | null;
          team_size: string | null;
          company_completed_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['companies']['Row']> & { name: string; slug: string };
        Update: Partial<Database['public']['Tables']['companies']['Row']>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['users']['Row']> & {
          id: string;
          company_id: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Row']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          company_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          payload: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['audit_log']['Row']> & { action: string };
        Update: Partial<Database['public']['Tables']['audit_log']['Row']>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          company_id: string;
          slug: string;
          title: string;
          description: string | null;
          status: string;
          visibility: JobVisibility;
          highlight_question: string | null;
          highlight_type: HighlightType | null;
          highlight_expected: string | null;
          requirements: JobRequirements | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['jobs']['Row']> & {
          company_id: string;
          slug: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Row']>;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          candidate_id: string | null;
          candidate_name: string;
          candidate_email: string;
          candidate_phone: string | null;
          why_interested: string | null;
          status: ApplicationStatus;
          city: string | null;
          form_completed_at: string | null;
          resume_path: string | null;
          linkedin_url: string | null;
          highlight_answer: string | null;
          highlight_matched: boolean | null;
          ai_suspected: boolean;
          ai_flags: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['applications']['Row']> & {
          job_id: string;
          company_id: string;
          candidate_name: string;
          candidate_email: string;
        };
        Update: Partial<Database['public']['Tables']['applications']['Row']>;
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          picture_url: string | null;
          linkedin_url: string | null;
          linkedin_sub: string | null;
          about: string | null;
          cv_file_path: string | null;
          cv_extracted_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['candidates']['Row']> & {
          id: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['candidates']['Row']>;
        Relationships: [];
      };
      ai_analyses: {
        Row: {
          id: string;
          application_id: string;
          score: number | null;
          recommendation: string | null;
          reasoning: string | null;
          cv_observations: string | null;
          dimensions: Json | null;
          dna_version_used: number | null;
          model_used: string | null;
          cost_cents: number | null;
          status: string;
          error_message: string | null;
          ran_at: string;
        };
        Insert: Partial<Database['public']['Tables']['ai_analyses']['Row']> & { application_id: string };
        Update: Partial<Database['public']['Tables']['ai_analyses']['Row']>;
        Relationships: [];
      };
      application_events: {
        Row: {
          id: string;
          application_id: string;
          company_id: string;
          actor_id: string | null;
          type: ApplicationEventType;
          from_status: string | null;
          to_status: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['application_events']['Row']> & {
          application_id: string;
          company_id: string;
        };
        Update: Partial<Database['public']['Tables']['application_events']['Row']>;
        Relationships: [];
      };
      collaborators: {
        Row: {
          id: string;
          company_id: string;
          candidate_id: string | null;
          application_id: string | null;
          full_name: string;
          email: string;
          role_title: string | null;
          hired_at: string;
          status: CollaboratorStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['collaborators']['Row']> & {
          company_id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['collaborators']['Row']>;
        Relationships: [];
      };
      collaborator_scores: {
        Row: {
          id: string;
          collaborator_id: string;
          company_id: string;
          area: string;
          score: number;
          note: string | null;
          source: ScoreSource;
          actor_id: string | null;
          recorded_at: string;
        };
        Insert: Partial<Database['public']['Tables']['collaborator_scores']['Row']> & {
          collaborator_id: string;
          company_id: string;
          area: string;
          score: number;
        };
        Update: Partial<Database['public']['Tables']['collaborator_scores']['Row']>;
        Relationships: [];
      };
      development_goals: {
        Row: {
          id: string;
          collaborator_id: string;
          company_id: string;
          title: string;
          description: string | null;
          area: string | null;
          status: GoalStatus;
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['development_goals']['Row']> & {
          collaborator_id: string;
          company_id: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['development_goals']['Row']>;
        Relationships: [];
      };
      company_questions: {
        Row: {
          id: string;
          company_id: string;
          kind: QuestionKind;
          position: number;
          question: string;
          guidance: string | null;
          scoring_rubric: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['company_questions']['Row']> & {
          company_id: string;
          kind: QuestionKind;
          question: string;
        };
        Update: Partial<Database['public']['Tables']['company_questions']['Row']>;
        Relationships: [];
      };
      job_questions: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          position: number;
          question: string;
          guidance: string | null;
          scoring_rubric: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['job_questions']['Row']> & {
          job_id: string;
          company_id: string;
          question: string;
        };
        Update: Partial<Database['public']['Tables']['job_questions']['Row']>;
        Relationships: [];
      };
      application_answers: {
        Row: {
          id: string;
          application_id: string;
          company_id: string;
          source: AnswerSource;
          ref_id: string | null;
          question_snapshot: string;
          answer: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['application_answers']['Row']> & {
          application_id: string;
          company_id: string;
          source: AnswerSource;
          question_snapshot: string;
        };
        Update: Partial<Database['public']['Tables']['application_answers']['Row']>;
        Relationships: [];
      };
      applicant_profiles: {
        Row: {
          email: string;
          full_name: string | null;
          phone: string | null;
          city: string | null;
          linkedin_url: string | null;
          picture_url: string | null;
          about: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['applicant_profiles']['Row']> & { email: string };
        Update: Partial<Database['public']['Tables']['applicant_profiles']['Row']>;
        Relationships: [];
      };
    };
    Views: {
      company_public_profiles: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
        };
        Relationships: [];
      };
      company_questions_public: {
        Row: {
          id: string;
          company_id: string;
          kind: QuestionKind;
          position: number;
          question: string;
        };
        Relationships: [];
      };
      job_questions_public: {
        Row: {
          id: string;
          job_id: string;
          position: number;
          question: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      company_plan: CompanyPlan;
    };
    CompositeTypes: Record<string, never>;
  };
};
