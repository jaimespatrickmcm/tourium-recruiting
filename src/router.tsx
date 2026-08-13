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
import { Team } from '@/pages/app/Team';
import { TeamDetail } from '@/pages/app/TeamDetail';
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

  // Company/HR area
  {
    path: '/app',
    element: (
      <ProtectedRoute>
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
      { path: 'time', element: <Team /> },
      { path: 'time/:id', element: <TeamDetail /> },
      { path: 'company', element: <Navigate to="/app/empresa" replace /> },
      { path: 'jobs/new', element: <Navigate to="/app/jobs" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
