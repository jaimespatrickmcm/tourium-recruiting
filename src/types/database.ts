export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'owner' | 'recruiter' | 'viewer';
export type CompanyPlan = 'trial' | 'starter' | 'growth';
export type ApplicationStatus =
  | 'triagem'
  | 'fit_cultural'
  | 'entrevista'
  | 'proposta'
  | 'contratado'
  | 'reprovado';
export type ApplicationEventType = 'stage_change' | 'note' | 'hired';
export type CollaboratorStatus = 'ativo' | 'desligado';
export type ScoreSource = 'analise_inicial' | 'avaliacao';
export type GoalStatus = 'em_andamento' | 'concluida' | 'pausada';
export type QuestionKind = 'profile' | 'culture' | 'reasoning' | 'curiosity';
export type QuestionFormat = 'text' | 'number' | 'single_select' | 'multi_select';
export type JobVisibility = 'public' | 'private';
export type HighlightType = 'yes_no' | 'short_text';
export type CollaboratorAccessStatus = 'pending' | 'active' | 'revoked';
export type PerformanceReviewKind = 'standard' | '360';
export type PerformanceReviewStatus = 'draft' | 'open' | 'closed';
export type ReviewRelationship = 'self' | 'manager' | 'peer' | 'direct_report' | 'other';
export type ReviewAssignmentStatus = 'pending' | 'in_progress' | 'submitted';
export type CollaboratorSkillStatus = 'in_progress' | 'unlocked';
export type DevelopmentPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type DevelopmentGoalStatus = 'not_started' | 'in_progress' | 'completed' | 'paused';
export type DevelopmentActionKind = 'course' | 'practice' | 'mentoring' | 'reading' | 'other';
export type DevelopmentActionStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';
export type EmploymentEventType = 'hired' | 'role_changed' | 'status_changed';

export type CollaboratorAddress = {
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  postal_code?: string;
};

export type CollaboratorLifetimeEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  title: string;
  score: number | null;
  amount_minor: number | null;
  currency: string | null;
  skill_id: string | null;
  goal_id: string | null;
  source_id: string | null;
  metadata: Json;
};

/** Perfil de requisitos interno da vaga (jobs.requirements). Nunca exposto ao candidato. */
export type JobRequirements = {
  seniority: string;
  summary: string;
  /** Local + modelo de trabalho da vaga (ex.: "Presencial em BH", "Remoto"). '' quando desconhecido. */
  location: string;
  must_have: string[];
  nice_to_have: string[];
  responsibilities: string[];
  evaluation_focus: string[];
  red_flags: string[];
};
export type AnswerSource =
  | 'candidate_info'
  | 'job_question'
  | 'profile'
  | 'culture'
  | 'reasoning'
  | 'curiosity';

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
          show_benefits: boolean;
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
          cv_feedback: Json | null;
          evidence_stage: string | null;
          stage_score: number | null;
          stage_verdict: string | null;
          stage_note: string | null;
          dimensions: Json | null;
          stage_dimensions: Json | null;
          strengths: Json | null;
          concerns: Json | null;
          question_scores: Json | null;
          potential_breakdown: Json | null;
          leadership_signal: Json | null;
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
          auth_user_id: string | null;
          corporate_email: string | null;
          pending_corporate_email: string | null;
          access_status: CollaboratorAccessStatus;
          employment_ended_at: string | null;
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
      collaborator_private_profiles: {
        Row: {
          collaborator_id: string;
          company_id: string;
          birth_date: string | null;
          address: CollaboratorAddress | null;
          shirt_size: string | null;
          food_preferences: string[];
          dietary_restrictions: string[];
          personal_data: Json;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['collaborator_private_profiles']['Row']> & {
          collaborator_id: string;
          company_id: string;
        };
        Update: Partial<Database['public']['Tables']['collaborator_private_profiles']['Row']>;
        Relationships: [];
      };
      salary_history: {
        Row: {
          id: string;
          collaborator_id: string;
          company_id: string;
          amount_minor: number;
          currency: string;
          effective_from: string;
          effective_to: string | null;
          reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['salary_history']['Row']> & {
          collaborator_id: string;
          company_id: string;
          amount_minor: number;
          effective_from: string;
        };
        Update: Partial<Database['public']['Tables']['salary_history']['Row']>;
        Relationships: [];
      };
      performance_reviews: {
        Row: {
          id: string;
          company_id: string;
          collaborator_id: string;
          kind: PerformanceReviewKind;
          title: string;
          review_date: string;
          period_start: string | null;
          period_end: string | null;
          status: PerformanceReviewStatus;
          overall_score: number | null;
          summary: string | null;
          created_by: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['performance_reviews']['Row']> & {
          company_id: string;
          collaborator_id: string;
          title: string;
          review_date: string;
        };
        Update: Partial<Database['public']['Tables']['performance_reviews']['Row']>;
        Relationships: [];
      };
      review_dimensions: {
        Row: {
          id: string;
          company_id: string;
          review_id: string;
          skill_id: string | null;
          name: string;
          description: string | null;
          weight: number;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['review_dimensions']['Row']> & {
          company_id: string;
          review_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['review_dimensions']['Row']>;
        Relationships: [];
      };
      review_assignments: {
        Row: {
          id: string;
          company_id: string;
          review_id: string;
          evaluator_user_id: string | null;
          evaluator_email: string | null;
          relationship: ReviewRelationship;
          status: ReviewAssignmentStatus;
          access_token_hash: string | null;
          access_token_expires_at: string | null;
          access_token_used_at: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['review_assignments']['Row']> & {
          company_id: string;
          review_id: string;
          relationship: ReviewRelationship;
        };
        Update: Partial<Database['public']['Tables']['review_assignments']['Row']>;
        Relationships: [];
      };
      review_responses: {
        Row: {
          id: string;
          company_id: string;
          assignment_id: string;
          overall_comment: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['review_responses']['Row']> & {
          company_id: string;
          assignment_id: string;
        };
        Update: Partial<Database['public']['Tables']['review_responses']['Row']>;
        Relationships: [];
      };
      review_response_items: {
        Row: {
          id: string;
          company_id: string;
          response_id: string;
          dimension_id: string;
          score: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['review_response_items']['Row']> & {
          company_id: string;
          response_id: string;
          dimension_id: string;
          score: number;
        };
        Update: Partial<Database['public']['Tables']['review_response_items']['Row']>;
        Relationships: [];
      };
      skills: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          category: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['skills']['Row']> & {
          company_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['skills']['Row']>;
        Relationships: [];
      };
      collaborator_skills: {
        Row: {
          collaborator_id: string;
          skill_id: string;
          company_id: string;
          level: number;
          status: CollaboratorSkillStatus;
          unlocked_at: string | null;
          evidence: string | null;
          source_review_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['collaborator_skills']['Row']> & {
          collaborator_id: string;
          skill_id: string;
          company_id: string;
        };
        Update: Partial<Database['public']['Tables']['collaborator_skills']['Row']>;
        Relationships: [];
      };
      development_plans: {
        Row: {
          id: string;
          company_id: string;
          collaborator_id: string;
          title: string;
          description: string | null;
          status: DevelopmentPlanStatus;
          starts_at: string | null;
          target_date: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['development_plans']['Row']> & {
          company_id: string;
          collaborator_id: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['development_plans']['Row']>;
        Relationships: [];
      };
      development_plan_goals: {
        Row: {
          id: string;
          company_id: string;
          plan_id: string;
          skill_id: string | null;
          title: string;
          description: string | null;
          target_level: number | null;
          success_criteria: string | null;
          due_date: string | null;
          status: DevelopmentGoalStatus;
          progress_percent: number;
          completed_at: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['development_plan_goals']['Row']> & {
          company_id: string;
          plan_id: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['development_plan_goals']['Row']>;
        Relationships: [];
      };
      development_actions: {
        Row: {
          id: string;
          company_id: string;
          goal_id: string;
          title: string;
          description: string | null;
          kind: DevelopmentActionKind;
          due_date: string | null;
          status: DevelopmentActionStatus;
          completed_at: string | null;
          resource_url: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['development_actions']['Row']> & {
          company_id: string;
          goal_id: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['development_actions']['Row']>;
        Relationships: [];
      };
      development_checkins: {
        Row: {
          id: string;
          company_id: string;
          plan_id: string;
          goal_id: string | null;
          occurred_at: string;
          progress_percent: number | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['development_checkins']['Row']> & {
          company_id: string;
          plan_id: string;
          occurred_at: string;
        };
        Update: Partial<Database['public']['Tables']['development_checkins']['Row']>;
        Relationships: [];
      };
      employment_events: {
        Row: {
          id: string;
          company_id: string;
          collaborator_id: string;
          event_type: EmploymentEventType;
          occurred_at: string;
          title: string;
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['employment_events']['Row']> & {
          company_id: string;
          collaborator_id: string;
          event_type: EmploymentEventType;
          occurred_at: string;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['employment_events']['Row']>;
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
          required: boolean;
          // false = coleta de dado (salario, regime, anos de experiencia,
          // origem da vaga): vira contexto na analise, nunca nota.
          scored: boolean;
          format: QuestionFormat;
          options: Json | null;
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
          required: boolean;
          scored: boolean;
          format: QuestionFormat;
          options: Json | null;
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
          guidance_snapshot: string | null;
          rubric_snapshot: string | null;
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
      profile_assessments: {
        Row: {
          id: string;
          email: string;
          method: 'disc' | 'bigfive' | 'grit';
          answers: Json;
          result: Json;
          consent_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profile_assessments']['Row']> & {
          email: string;
          method: 'disc' | 'bigfive' | 'grit';
          answers: Json;
          result: Json;
          consent_at: string;
        };
        Update: Partial<Database['public']['Tables']['profile_assessments']['Row']>;
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
          /** Só os benefícios do DNA. O resto do dna_document continua interno. */
          benefits: Json;
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
          required: boolean;
          format: QuestionFormat;
          options: Json | null;
          min_selections: number;
        };
        Relationships: [];
      };
      job_questions_public: {
        Row: {
          id: string;
          job_id: string;
          position: number;
          question: string;
          required: boolean;
          format: QuestionFormat;
          options: Json | null;
          min_selections: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_review_assignment_context: {
        Args: { target_assignment_id: string };
        Returns: Array<{
          id: string;
          title: string;
          review_date: string;
          status: PerformanceReviewStatus;
          kind: PerformanceReviewKind;
        }>;
      };
      get_collaborator_lifetime: {
        Args: { target_collaborator_id: string };
        Returns: CollaboratorLifetimeEvent[];
      };
      record_salary_change: {
        Args: {
          target_collaborator_id: string;
          new_amount_minor: number;
          new_currency?: string;
          new_effective_from: string;
          change_reason?: string | null;
        };
        Returns: Database['public']['Tables']['salary_history']['Row'];
      };
      close_performance_review: {
        Args: { target_review_id: string };
        Returns: Database['public']['Tables']['performance_reviews']['Row'];
      };
      submit_review_response: {
        Args: {
          target_assignment_id: string;
          response_comment?: string | null;
          response_items: Json;
        };
        Returns: Database['public']['Tables']['review_responses']['Row'];
      };
    };
    Enums: {
      user_role: UserRole;
      company_plan: CompanyPlan;
    };
    CompositeTypes: Record<string, never>;
  };
};
