import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  CollaboratorAddress,
  CollaboratorLifetimeEvent,
  CollaboratorSkillStatus,
  Database,
  DevelopmentActionKind,
  DevelopmentActionStatus,
  DevelopmentGoalStatus,
  DevelopmentPlanStatus,
  Json,
  PerformanceReviewKind,
  PerformanceReviewStatus,
  ReviewRelationship,
} from '@/types/database';

type Tables = Database['public']['Tables'];

export type Collaborator = Tables['collaborators']['Row'];
export type CollaboratorPrivateProfile = Tables['collaborator_private_profiles']['Row'];
export type SalaryHistoryEntry = Tables['salary_history']['Row'];
export type PerformanceReview = Tables['performance_reviews']['Row'];
export type ReviewDimension = Tables['review_dimensions']['Row'];
export type ReviewAssignment = Tables['review_assignments']['Row'];
export type ReviewResponse = Tables['review_responses']['Row'];
export type ReviewResponseItem = Tables['review_response_items']['Row'];
export type Skill = Tables['skills']['Row'];
export type CollaboratorSkill = Tables['collaborator_skills']['Row'];
export type DevelopmentPlan = Tables['development_plans']['Row'];
export type DevelopmentPlanGoal = Tables['development_plan_goals']['Row'];
export type DevelopmentAction = Tables['development_actions']['Row'];
export type DevelopmentCheckin = Tables['development_checkins']['Row'];

export type CollaboratorDevelopmentData = {
  collaborator: Collaborator | null;
  privateProfile: CollaboratorPrivateProfile | null;
  salaryHistory: SalaryHistoryEntry[];
  reviews: PerformanceReview[];
  reviewDimensions: ReviewDimension[];
  reviewAssignments: ReviewAssignment[];
  reviewResponses: ReviewResponse[];
  reviewResponseItems: ReviewResponseItem[];
  skills: Skill[];
  collaboratorSkills: CollaboratorSkill[];
  plans: DevelopmentPlan[];
  goals: DevelopmentPlanGoal[];
  actions: DevelopmentAction[];
  checkins: DevelopmentCheckin[];
  lifetime: CollaboratorLifetimeEvent[];
};

const EMPTY_DATA: CollaboratorDevelopmentData = {
  collaborator: null,
  privateProfile: null,
  salaryHistory: [],
  reviews: [],
  reviewDimensions: [],
  reviewAssignments: [],
  reviewResponses: [],
  reviewResponseItems: [],
  skills: [],
  collaboratorSkills: [],
  plans: [],
  goals: [],
  actions: [],
  checkins: [],
  lifetime: [],
};

type PrivateProfileInput = {
  birth_date?: string | null;
  address?: CollaboratorAddress | null;
  shirt_size?: string | null;
  food_preferences?: string[];
  dietary_restrictions?: string[];
  personal_data?: Json;
};

type SalaryChangeInput = {
  amountMinor: number;
  currency?: string;
  effectiveFrom: string;
  reason?: string | null;
};

type ReviewInput = {
  kind?: PerformanceReviewKind;
  title: string;
  reviewDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: PerformanceReviewStatus;
  summary?: string | null;
};

type ReviewDimensionInput = {
  skillId?: string | null;
  name: string;
  description?: string | null;
  weight?: number;
  position?: number;
};

type ReviewAssignmentInput = {
  evaluatorUserId?: string | null;
  evaluatorEmail?: string | null;
  relationship: ReviewRelationship;
};

type ReviewResponseItemInput = {
  dimension_id: string;
  score: number;
  comment?: string | null;
};

type SkillInput = {
  name: string;
  description?: string | null;
  category?: string | null;
  active?: boolean;
};

type CollaboratorSkillInput = {
  level?: number;
  status?: CollaboratorSkillStatus;
  unlockedAt?: string | null;
  evidence?: string | null;
  sourceReviewId?: string | null;
};

type PlanInput = {
  title: string;
  description?: string | null;
  status?: DevelopmentPlanStatus;
  startsAt?: string | null;
  targetDate?: string | null;
};

type GoalInput = {
  skillId?: string | null;
  title: string;
  description?: string | null;
  targetLevel?: number | null;
  successCriteria?: string | null;
  dueDate?: string | null;
  status?: DevelopmentGoalStatus;
  progressPercent?: number;
  position?: number;
};

type ActionInput = {
  title: string;
  description?: string | null;
  kind?: DevelopmentActionKind;
  dueDate?: string | null;
  status?: DevelopmentActionStatus;
  resourceUrl?: string | null;
  position?: number;
};

type CheckinInput = {
  goalId?: string | null;
  occurredAt?: string;
  progressPercent?: number | null;
  note?: string | null;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return 'Não foi possível carregar os dados de desenvolvimento.';
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/**
 * Carrega e altera toda a jornada pós-contratação de uma pessoa.
 *
 * O hook não decide autorização. Cada consulta passa pelo cliente autenticado
 * e depende das policies owner + self do banco. IDs invariantes de tenant e da
 * pessoa são derivados do colaborador carregado, nunca recebidos da tela.
 */
export function useCollaboratorDevelopment(collaboratorId: string | null) {
  const [data, setData] = useState<CollaboratorDevelopmentData>(EMPTY_DATA);
  const [loading, setLoading] = useState(Boolean(collaboratorId));
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!collaboratorId) {
      setData(EMPTY_DATA);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      const { data: collaborator, error: collaboratorError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('id', collaboratorId)
        .maybeSingle();
      throwIfError(collaboratorError);

      if (!collaborator) {
        throw new Error('Pessoa não encontrada ou sem acesso.');
      }

      const [
        profileResult,
        salaryResult,
        reviewsResult,
        skillsResult,
        collaboratorSkillsResult,
        plansResult,
        lifetimeResult,
      ] = await Promise.all([
        supabase
          .from('collaborator_private_profiles')
          .select('*')
          .eq('collaborator_id', collaboratorId)
          .maybeSingle(),
        supabase
          .from('salary_history')
          .select('*')
          .eq('collaborator_id', collaboratorId)
          .order('effective_from', { ascending: false }),
        supabase
          .from('performance_reviews')
          .select('*')
          .eq('collaborator_id', collaboratorId)
          .order('review_date', { ascending: false }),
        supabase.from('skills').select('*').eq('company_id', collaborator.company_id).order('name'),
        supabase
          .from('collaborator_skills')
          .select('*')
          .eq('collaborator_id', collaboratorId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('development_plans')
          .select('*')
          .eq('collaborator_id', collaboratorId)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_collaborator_lifetime', { target_collaborator_id: collaboratorId }),
      ]);

      for (const result of [
        profileResult,
        salaryResult,
        reviewsResult,
        skillsResult,
        collaboratorSkillsResult,
        plansResult,
        lifetimeResult,
      ]) {
        throwIfError(result.error);
      }

      const reviews = reviewsResult.data ?? [];
      const plans = plansResult.data ?? [];
      const reviewIds = reviews.map((review) => review.id);
      const planIds = plans.map((plan) => plan.id);

      let reviewDimensions: ReviewDimension[] = [];
      let reviewAssignments: ReviewAssignment[] = [];
      let goals: DevelopmentPlanGoal[] = [];
      let checkins: DevelopmentCheckin[] = [];

      const relationQueries: Promise<void>[] = [];

      if (reviewIds.length > 0) {
        relationQueries.push(
          (async () => {
            const [dimensionsResult, assignmentsResult] = await Promise.all([
              supabase
                .from('review_dimensions')
                .select('*')
                .in('review_id', reviewIds)
                .order('position'),
              supabase
                .from('review_assignments')
                .select('*')
                .in('review_id', reviewIds)
                .order('created_at'),
            ]);
            throwIfError(dimensionsResult.error);
            throwIfError(assignmentsResult.error);
            reviewDimensions = dimensionsResult.data ?? [];
            reviewAssignments = assignmentsResult.data ?? [];
          })(),
        );
      }

      if (planIds.length > 0) {
        relationQueries.push(
          (async () => {
            const [goalsResult, checkinsResult] = await Promise.all([
              supabase
                .from('development_plan_goals')
                .select('*')
                .in('plan_id', planIds)
                .order('position'),
              supabase
                .from('development_checkins')
                .select('*')
                .in('plan_id', planIds)
                .order('occurred_at', { ascending: false }),
            ]);
            throwIfError(goalsResult.error);
            throwIfError(checkinsResult.error);
            goals = goalsResult.data ?? [];
            checkins = checkinsResult.data ?? [];
          })(),
        );
      }

      await Promise.all(relationQueries);

      let reviewResponses: ReviewResponse[] = [];
      let reviewResponseItems: ReviewResponseItem[] = [];
      let actions: DevelopmentAction[] = [];
      const leafQueries: Promise<void>[] = [];

      if (reviewAssignments.length > 0) {
        leafQueries.push(
          (async () => {
            const responsesResult = await supabase
              .from('review_responses')
              .select('*')
              .in(
                'assignment_id',
                reviewAssignments.map((assignment) => assignment.id),
              );
            throwIfError(responsesResult.error);
            reviewResponses = responsesResult.data ?? [];

            if (reviewResponses.length > 0) {
              const itemsResult = await supabase
                .from('review_response_items')
                .select('*')
                .in(
                  'response_id',
                  reviewResponses.map((response) => response.id),
                );
              throwIfError(itemsResult.error);
              reviewResponseItems = itemsResult.data ?? [];
            }
          })(),
        );
      }

      if (goals.length > 0) {
        leafQueries.push(
          (async () => {
            const actionsResult = await supabase
              .from('development_actions')
              .select('*')
              .in(
                'goal_id',
                goals.map((goal) => goal.id),
              )
              .order('position');
            throwIfError(actionsResult.error);
            actions = actionsResult.data ?? [];
          })(),
        );
      }

      await Promise.all(leafQueries);

      setData({
        collaborator,
        privateProfile: profileResult.data,
        salaryHistory: salaryResult.data ?? [],
        reviews,
        reviewDimensions,
        reviewAssignments,
        reviewResponses,
        reviewResponseItems,
        skills: skillsResult.data ?? [],
        collaboratorSkills: collaboratorSkillsResult.data ?? [],
        plans,
        goals,
        actions,
        checkins,
        lifetime: lifetimeResult.data ?? [],
      });
      setError(null);
    } catch (fetchError) {
      setData(EMPTY_DATA);
      setError(errorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [collaboratorId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const requireContext = useCallback(() => {
    if (!collaboratorId || !data.collaborator) {
      throw new Error('Carregue uma pessoa antes de alterar seus dados.');
    }
    return { collaboratorId, companyId: data.collaborator.company_id };
  }, [collaboratorId, data.collaborator]);

  const runMutation = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      setMutating(true);
      try {
        const result = await operation();
        await fetchAll();
        setError(null);
        return result;
      } catch (mutationError) {
        const message = errorMessage(mutationError);
        setError(message);
        throw mutationError instanceof Error ? mutationError : new Error(message);
      } finally {
        setMutating(false);
      }
    },
    [fetchAll],
  );

  const savePrivateProfile = useCallback(
    (input: PrivateProfileInput) =>
      runMutation(async () => {
        const { collaboratorId: id, companyId } = requireContext();
        const result = await supabase
          .from('collaborator_private_profiles')
          .upsert({ collaborator_id: id, company_id: companyId, ...input }, { onConflict: 'collaborator_id' })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const recordSalaryChange = useCallback(
    (input: SalaryChangeInput) =>
      runMutation(async () => {
        const { collaboratorId: id } = requireContext();
        const result = await supabase.rpc('record_salary_change', {
          target_collaborator_id: id,
          new_amount_minor: input.amountMinor,
          new_currency: input.currency ?? 'BRL',
          new_effective_from: input.effectiveFrom,
          change_reason: input.reason ?? null,
        });
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const createReview = useCallback(
    (input: ReviewInput) =>
      runMutation(async () => {
        const { collaboratorId: id, companyId } = requireContext();
        const result = await supabase
          .from('performance_reviews')
          .insert({
            company_id: companyId,
            collaborator_id: id,
            kind: input.kind ?? 'standard',
            title: input.title,
            review_date: input.reviewDate,
            period_start: input.periodStart ?? null,
            period_end: input.periodEnd ?? null,
            status: input.status ?? 'draft',
            summary: input.summary ?? null,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const updateReview = useCallback(
    (reviewId: string, updates: Tables['performance_reviews']['Update']) =>
      runMutation(async () => {
        const { collaboratorId: id } = requireContext();
        const result = await supabase
          .from('performance_reviews')
          .update(updates)
          .eq('id', reviewId)
          .eq('collaborator_id', id)
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const addReviewDimension = useCallback(
    (reviewId: string, input: ReviewDimensionInput) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('review_dimensions')
          .insert({
            company_id: companyId,
            review_id: reviewId,
            skill_id: input.skillId ?? null,
            name: input.name,
            description: input.description ?? null,
            weight: input.weight ?? 1,
            position: input.position ?? 0,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const addReviewAssignment = useCallback(
    (reviewId: string, input: ReviewAssignmentInput) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('review_assignments')
          .insert({
            company_id: companyId,
            review_id: reviewId,
            evaluator_user_id: input.evaluatorUserId ?? null,
            evaluator_email: input.evaluatorEmail ?? null,
            relationship: input.relationship,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const submitReviewResponse = useCallback(
    (assignmentId: string, overallComment: string | null, items: ReviewResponseItemInput[]) =>
      runMutation(async () => {
        const result = await supabase.rpc('submit_review_response', {
          target_assignment_id: assignmentId,
          response_comment: overallComment,
          response_items: items as unknown as Json,
        });
        throwIfError(result.error);
        return result.data;
      }),
    [runMutation],
  );

  const closeReview = useCallback(
    (reviewId: string) =>
      runMutation(async () => {
        const result = await supabase.rpc('close_performance_review', {
          target_review_id: reviewId,
        });
        throwIfError(result.error);
        return result.data;
      }),
    [runMutation],
  );

  const createSkill = useCallback(
    (input: SkillInput) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('skills')
          .insert({ company_id: companyId, ...input })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const updateSkill = useCallback(
    (skillId: string, updates: Tables['skills']['Update']) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('skills')
          .update(updates)
          .eq('id', skillId)
          .eq('company_id', companyId)
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const saveCollaboratorSkill = useCallback(
    (skillId: string, input: CollaboratorSkillInput) =>
      runMutation(async () => {
        const { collaboratorId: id, companyId } = requireContext();
        const result = await supabase
          .from('collaborator_skills')
          .upsert(
            {
              collaborator_id: id,
              company_id: companyId,
              skill_id: skillId,
              level: input.level ?? 1,
              status: input.status ?? 'in_progress',
              unlocked_at: input.unlockedAt ?? null,
              evidence: input.evidence ?? null,
              source_review_id: input.sourceReviewId ?? null,
            },
            { onConflict: 'collaborator_id,skill_id' },
          )
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const createPlan = useCallback(
    (input: PlanInput) =>
      runMutation(async () => {
        const { collaboratorId: id, companyId } = requireContext();
        const result = await supabase
          .from('development_plans')
          .insert({
            company_id: companyId,
            collaborator_id: id,
            title: input.title,
            description: input.description ?? null,
            status: input.status ?? 'draft',
            starts_at: input.startsAt ?? null,
            target_date: input.targetDate ?? null,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const updatePlan = useCallback(
    (planId: string, updates: Tables['development_plans']['Update']) =>
      runMutation(async () => {
        const { collaboratorId: id } = requireContext();
        const result = await supabase
          .from('development_plans')
          .update(updates)
          .eq('id', planId)
          .eq('collaborator_id', id)
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const createGoal = useCallback(
    (planId: string, input: GoalInput) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('development_plan_goals')
          .insert({
            company_id: companyId,
            plan_id: planId,
            skill_id: input.skillId ?? null,
            title: input.title,
            description: input.description ?? null,
            target_level: input.targetLevel ?? null,
            success_criteria: input.successCriteria ?? null,
            due_date: input.dueDate ?? null,
            status: input.status ?? 'not_started',
            progress_percent: input.progressPercent ?? 0,
            position: input.position ?? 0,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const updateGoal = useCallback(
    (goalId: string, updates: Tables['development_plan_goals']['Update']) =>
      runMutation(async () => {
        requireContext();
        const result = await supabase
          .from('development_plan_goals')
          .update(updates)
          .eq('id', goalId)
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const createAction = useCallback(
    (goalId: string, input: ActionInput) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('development_actions')
          .insert({
            company_id: companyId,
            goal_id: goalId,
            title: input.title,
            description: input.description ?? null,
            kind: input.kind ?? 'other',
            due_date: input.dueDate ?? null,
            status: input.status ?? 'not_started',
            resource_url: input.resourceUrl ?? null,
            position: input.position ?? 0,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const updateAction = useCallback(
    (actionId: string, updates: Tables['development_actions']['Update']) =>
      runMutation(async () => {
        requireContext();
        const result = await supabase
          .from('development_actions')
          .update(updates)
          .eq('id', actionId)
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  const addCheckin = useCallback(
    (planId: string, input: CheckinInput) =>
      runMutation(async () => {
        const { companyId } = requireContext();
        const result = await supabase
          .from('development_checkins')
          .insert({
            company_id: companyId,
            plan_id: planId,
            goal_id: input.goalId ?? null,
            occurred_at: input.occurredAt ?? new Date().toISOString(),
            progress_percent: input.progressPercent ?? null,
            note: input.note ?? null,
          })
          .select('*')
          .single();
        throwIfError(result.error);
        return result.data;
      }),
    [requireContext, runMutation],
  );

  return {
    ...data,
    loading,
    mutating,
    error,
    refetch: fetchAll,
    savePrivateProfile,
    recordSalaryChange,
    createReview,
    updateReview,
    addReviewDimension,
    addReviewAssignment,
    submitReviewResponse,
    closeReview,
    createSkill,
    updateSkill,
    saveCollaboratorSkill,
    createPlan,
    updatePlan,
    createGoal,
    updateGoal,
    createAction,
    updateAction,
    addCheckin,
  };
}
