import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLoading from './pages/DashboardLoading';
import AnalyticsLoading from './pages/AnalyticsLoading';

const Index = lazy(() => import('./pages/Index'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Leaves = lazy(() => import('./pages/Leaves'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Plans = lazy(() => import('./pages/Plans'));
const Reports = lazy(() => import('./pages/Reports'));
const Documents = lazy(() => import('./pages/Documents'));
const Files = lazy(() => import('./pages/Files'));
const EmployeeDatabase = lazy(() => import('./pages/EmployeeDatabase'));
const Team = lazy(() => import('./pages/Team'));
const Holidays = lazy(() => import('./pages/Holidays'));
const Departments = lazy(() => import('./pages/Departments'));
const Users = lazy(() => import('./pages/Users'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Logs = lazy(() => import('./pages/Logs'));
const Security = lazy(() => import('./pages/Security'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotFound = lazy(() => import('./pages/NotFound'));

function withSuspense(element: ReactNode, fallback: ReactNode = null) {
  return <Suspense fallback={fallback}>{element}</Suspense>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={withSuspense(<Index />)} />
      <Route path="/login" element={withSuspense(<Login />)} />
      <Route path="/forgot-password" element={withSuspense(<ForgotPassword />)} />
      <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />
      <Route path="/dashboard" element={withSuspense(<Dashboard />, <DashboardLoading />)} />
      <Route path="/attendance" element={withSuspense(<Attendance />)} />
      <Route path="/leaves" element={withSuspense(<Leaves />)} />
      <Route path="/tasks" element={withSuspense(<Tasks />)} />
      <Route path="/plans" element={withSuspense(<Plans />)} />
      <Route path="/reports" element={withSuspense(<Reports />)} />
      <Route path="/documents" element={withSuspense(<Documents />)} />
      <Route path="/files" element={withSuspense(<Files />)} />
      <Route path="/employee-database" element={withSuspense(<EmployeeDatabase />)} />
      <Route path="/team" element={withSuspense(<Team />)} />
      <Route path="/holidays" element={withSuspense(<Holidays />)} />
      <Route path="/departments" element={withSuspense(<Departments />)} />
      <Route path="/users" element={withSuspense(<Users />)} />
      <Route path="/analytics" element={withSuspense(<Analytics />, <AnalyticsLoading />)} />
      <Route path="/logs" element={withSuspense(<Logs />)} />
      <Route path="/security" element={withSuspense(<Security />)} />
      <Route path="/profile" element={withSuspense(<Profile />)} />
      <Route path="/notifications" element={withSuspense(<Notifications />)} />
      <Route path="*" element={withSuspense(<NotFound />)} />
    </Routes>
  );
}
