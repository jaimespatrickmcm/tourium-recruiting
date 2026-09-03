import { useCollaboratorDevelopment } from '@/hooks/use-collaborator-development';

export type ReturnTypeOfDevelopmentHook = ReturnType<typeof useCollaboratorDevelopment>;
export type PeoplePanelMode = 'admin' | 'self';
