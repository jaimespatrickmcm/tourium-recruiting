import { Award, ChartNoAxesColumnIncreasing, Clock3, Target, UserRound, UsersRound } from 'lucide-react';
import { DevelopmentTab } from '@/components/people/development-tab';
import { LifetimeTab } from '@/components/people/lifetime-tab';
import { OverviewTab } from '@/components/people/overview-tab';
import { ProfileTab } from '@/components/people/profile-tab';
import { ReviewsTab } from '@/components/people/reviews-tab';
import { SkillsTab } from '@/components/people/skills-tab';
import { EmptyState, ErrorState, LoadingState } from '@/components/people/shared';
import type { PeoplePanelMode } from '@/components/people/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollaboratorDevelopment } from '@/hooks/use-collaborator-development';

export type CollaboratorDevelopmentPanelProps = {
  collaboratorId: string;
  mode: PeoplePanelMode;
};

const TAB_ITEMS = [
  { value: 'overview', label: 'Visão geral', icon: ChartNoAxesColumnIncreasing },
  { value: 'profile', label: 'Perfil', icon: UserRound },
  { value: 'reviews', label: 'Avaliações', icon: UsersRound },
  { value: 'skills', label: 'Skills', icon: Award },
  { value: 'lifetime', label: 'Lifetime', icon: Clock3 },
  { value: 'development', label: 'Desenvolvimento', icon: Target },
] as const;

export function CollaboratorDevelopmentPanel({ collaboratorId, mode }: CollaboratorDevelopmentPanelProps) {
  const model = useCollaboratorDevelopment(collaboratorId);

  if (model.loading) return <LoadingState />;
  if (model.error && !model.collaborator) return <ErrorState message={model.error} onRetry={() => void model.refetch()} />;
  if (!model.collaborator) return <EmptyState title="Pessoa não encontrada" description="Confira o vínculo ou peça ao Admin para revisar seu acesso." />;

  return (
    <section className="min-w-0" aria-labelledby="people-panel-title">
      <div className="mb-6 min-w-0">
        <p className="text-eyebrow font-bold uppercase text-brand">Pessoas</p>
        <h1 id="people-panel-title" className="mt-2 break-words text-title-1 font-bold text-ink">
          {mode === 'self' ? 'Minha jornada' : model.collaborator.full_name}
        </h1>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">
          {mode === 'self'
            ? 'Seus dados, avaliações e próximos passos reunidos no mesmo lugar.'
            : 'Acompanhe o histórico, as conquistas e o desenvolvimento desta pessoa.'}
        </p>
      </div>

      {model.error && <div className="mb-5"><ErrorState message={model.error} onRetry={() => void model.refetch()} /></div>}

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-card border border-line-soft bg-surface p-1.5 sm:grid-cols-3 xl:grid-cols-6" aria-label="Áreas da jornada">
          {TAB_ITEMS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="min-h-11 min-w-0 cursor-pointer gap-2 rounded-control px-2 text-caption font-semibold data-[state=active]:bg-brand-tint data-[state=active]:text-brand-hover data-[state=active]:shadow-none sm:text-footnote">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5 min-w-0"><OverviewTab model={model} /></TabsContent>
        <TabsContent value="profile" className="mt-5 min-w-0"><ProfileTab model={model} /></TabsContent>
        <TabsContent value="reviews" className="mt-5 min-w-0"><ReviewsTab model={model} /></TabsContent>
        <TabsContent value="skills" className="mt-5 min-w-0"><SkillsTab model={model} /></TabsContent>
        <TabsContent value="lifetime" className="mt-5 min-w-0"><LifetimeTab model={model} /></TabsContent>
        <TabsContent value="development" className="mt-5 min-w-0"><DevelopmentTab model={model} /></TabsContent>
      </Tabs>
    </section>
  );
}

export default CollaboratorDevelopmentPanel;
