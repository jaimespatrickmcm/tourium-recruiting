import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Landing } from '@/pages/Landing';
import { Signup } from '@/pages/Signup';
import { Login } from '@/pages/Login';
import { VerifyOtp } from '@/pages/VerifyOtp';
import { PublicCareer } from '@/pages/PublicCareer';
import { ApplicationForm } from '@/pages/ApplicationForm';
import { ProfileAssessment } from '@/pages/ProfileAssessment';
import { AppLayout } from '@/components/app-layout';
import { Dashboard } from '@/pages/app/Dashboard';
import { Empresa } from '@/pages/app/Empresa';
import { Dna } from '@/pages/app/Dna';
import { Questions } from '@/pages/app/Questions';
import { Jobs } from '@/pages/app/Jobs';
import { JobDetail } from '@/pages/app/JobDetail';
import { Candidates } from '@/pages/app/Candidates';
import { Team } from '@/pages/app/Team';
import { TeamDetail } from '@/pages/app/TeamDetail';
import { EmployeeDevelopment } from '@/pages/employee/Development';
import { ReviewAssignment } from '@/pages/ReviewAssignment';
import { CandidateAccess } from '@/pages/candidate/Access';
import { CandidateTokenArea } from '@/pages/candidate/TokenArea';
import { ProtectedRoute } from '@/components/protected-route';
import { PublicOnlyRoute } from '@/components/public-only-route';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/careers/:companySlug/:jobSlug', element: <PublicCareer /> },
  { path: '/careers/:companySlug/:jobSlug/form', element: <ApplicationForm /> },
  // Teste de perfil comportamental (benefício pós-candidatura, público)
  { path: '/perfil/analise', element: <ProfileAssessment /> },
  {
    path: '/signup',
    element: (
      <PublicOnlyRoute>
        <Signup />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <Login />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/verify-otp',
    element: (
      <PublicOnlyRoute>
        <VerifyOtp />
      </PublicOnlyRoute>
    ),
  },

  // Candidate area — acesso por token (magic link), não OAuth.
  // Login por LinkedIn desligado por enquanto (não funcional): a rota antiga
  // redireciona pro acesso por código.
  { path: '/candidato/login', element: <Navigate to="/candidato/acesso" replace /> },
  { path: '/candidato/acesso', element: <CandidateAccess /> },
  { path: '/candidato', element: <CandidateTokenArea /> },

  // Área pessoal do colaborador. O vínculo é ativado pela Edge Function e a
  // autorização dos dados é aplicada por RLS, sem papel corporativo no JWT.
  {
    path: '/pessoa',
    element: (
      <ProtectedRoute redirectTo="/app" allowCandidate>
        <EmployeeDevelopment />
      </ProtectedRoute>
    ),
  },

  // Formulário individual de avaliação. A RLS limita o conteúdo à assignment
  // ligada ao auth.uid() do participante.
  {
    path: '/avaliacao/360',
    element: (
      <ProtectedRoute allowCandidate>
        <ReviewAssignment />
      </ProtectedRoute>
    ),
  },

  // Company/HR area
  {
    path: '/app',
    element: (
      <ProtectedRoute allowedRoles={['owner', 'recruiter', 'viewer']}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'empresa', element: <Empresa /> },
      { path: 'dna', element: <Dna /> },
      { path: 'perguntas', element: <Questions /> },
      { path: 'jobs', element: <Jobs /> },
      { path: 'jobs/:id', element: <JobDetail /> },
      { path: 'candidatos', element: <Candidates /> },
      {
        path: 'time',
        element: (
          <ProtectedRoute allowedRoles={['owner']} redirectTo="/app">
            <Team />
          </ProtectedRoute>
        ),
      },
      {
        path: 'time/:id',
        element: (
          <ProtectedRoute allowedRoles={['owner']} redirectTo="/app">
            <TeamDetail />
          </ProtectedRoute>
        ),
      },
      { path: 'company', element: <Navigate to="/app/empresa" replace /> },
      { path: 'jobs/new', element: <Navigate to="/app/jobs" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
