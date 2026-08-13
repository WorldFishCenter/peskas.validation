import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { SurveyProvider } from './contexts/SurveyContext';
import Login from './components/Auth/Login';
import ResetPassword from './components/Auth/ResetPassword';
import ValidationTable from './components/ValidationTable/ValidationTable';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import EnumeratorPerformance from './components/EnumeratorPerformance/EnumeratorPerformance';
import DataDownload from './components/DataDownload/DataDownload';
import DataExplorer from './components/DataExplorer/DataExplorer';
import AdminUsers from './components/Admin/AdminUsers';
import AuditLog from './components/Admin/AuditLog';
import HowItWorks from './components/HowItWorks/HowItWorks';

/**
 * Gate a route on the admin role.
 *
 * The API already rejects non-admins, so this is not the security boundary — it stops a
 * non-admin who types /admin/users from rendering an admin screen that can only ever show
 * errors. The nav link was hidden, but the route itself was reachable.
 */
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ErrorBoundary>
          <ValidationTable />
        </ErrorBoundary>
      } />
      <Route path="/enumerators" element={
        <ErrorBoundary>
          <EnumeratorPerformance />
        </ErrorBoundary>
      } />
      <Route path="/data-download" element={
        <ErrorBoundary>
          <DataDownload />
        </ErrorBoundary>
      } />
      <Route path="/data-explorer" element={
        <ErrorBoundary>
          <DataExplorer />
        </ErrorBoundary>
      } />
      <Route path="/how-it-works" element={
        <ErrorBoundary>
          <HowItWorks />
        </ErrorBoundary>
      } />
      <Route path="/admin/users" element={
        <ErrorBoundary>
          <RequireAdmin><AdminUsers /></RequireAdmin>
        </ErrorBoundary>
      } />
      <Route path="/admin/audit-logs" element={
        <ErrorBoundary>
          <RequireAdmin><AuditLog /></RequireAdmin>
        </ErrorBoundary>
      } />
      {/* Unknown paths returned an empty layout rather than going anywhere. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="page page-center">
        <div className="container-tight py-4">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status"></div>
            <div className="mt-3">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/reset-password/:token" element={
            <ErrorBoundary>
              <ResetPassword />
            </ErrorBoundary>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <AppRoutes />
      )}
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <SurveyProvider>
            <AppContent />
          </SurveyProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

export default App; 