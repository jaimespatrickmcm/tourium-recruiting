import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Landing } from '@/pages/Landing';
import { Signup } from '@/pages/Signup';
import { Login } from '@/pages/Login';
import { VerifyOtp } from '@/pages/VerifyOtp';
import { PublicCareer } from '@/pages/PublicCareer';
import { AppLayout } from '@/components/app-layout';
import { Dashboard } from '@/pages/app/Dashboard';
import { Empresa } from '@/pages/app/Empresa';
import { Dna } from '@/pages/app/Dna';
import { Jobs } from '@/pages/app/Jobs';
import { JobDetail } from '@/pages/app/JobDetail';
import { Team } from '@/pages/app/Team';
import { TeamDetail } from '@/pages/app/TeamDetail';
import { CandidateLogin } from '@/pages/candidate/Login';
import { CandidateProfile } from '@/pages/candidate/Profile';
import { CandidateApplications } from '@/pages/candidate/Applications';
import { CandidateJourney } from '@/pages/candidate/Journey';
import { CandidateLayout } from '@/components/candidate-layout';
import { CandidateProtectedRoute } from '@/components/candidate-protected-route';
import { ProtectedRoute } from '@/components/protected-route';
import { PublicOnlyRoute } from '@/components/public-only-route';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/careers/:companySlug/:jobSlug', element: <PublicCareer /> },
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

  // Candidate area
  { path: '/candidato/login', element: <CandidateLogin /> },
  {
    path: '/candidato',
    element: (
      <CandidateProtectedRoute>
        <CandidateLayout />
      </CandidateProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/candidato/candidaturas" replace /> },
      { path: 'perfil', element: <CandidateProfile /> },
      { path: 'candidaturas', element: <CandidateApplications /> },
      { path: 'jornada', element: <CandidateJourney /> },
    ],
  },

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
