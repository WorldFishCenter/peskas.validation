import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { SurveyProvider } from './contexts/SurveyContext';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';

// Login is the first paint for every signed-out visitor, so it ships in the entry bundle.
import Login from './components/Auth/Login';

/** Set while a reload is in flight, so a failing chunk can only ever trigger one. */
const RELOAD_FLAG = 'route-chunk-reloaded';

/**
 * Load a route component on demand, so a visitor only downloads the screens they open.
 *
 * A rejected import is nearly always a stale `index.html` asking for asset filenames from a
 * previous deployment — the hashed names change on every build, and reloading picks up the
 * current ones. The sessionStorage flag caps that at a single attempt, so a rejection with any
 * other cause (offline, blocked request) falls through to the route's ErrorBoundary instead of
 * looping. Any successful load clears the flag.
 */
const lazyRoute = (factory: () => Promise<{ default: React.ComponentType }>) =>
  lazy(() =>
    factory().then(
      module => {
        sessionStorage.removeItem(RELOAD_FLAG);
        return module;
      },
      (error: unknown) => {
        if (sessionStorage.getItem(RELOAD_FLAG)) throw error;
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        // Never settles; the reload replaces the page before React can render anything.
        return new Promise<{ default: React.ComponentType }>(() => {});
      }
    )
  );

const ResetPassword = lazyRoute(() => import('./components/Auth/ResetPassword'));
const ValidationTable = lazyRoute(() => import('./components/ValidationTable/ValidationTable'));
const EnumeratorPerformance = lazyRoute(
  () => import('./components/EnumeratorPerformance/EnumeratorPerformance')
);
const DataDownload = lazyRoute(() => import('./components/DataDownload/DataDownload'));
const DataExplorer = lazyRoute(() => import('./components/DataExplorer/DataExplorer'));
const AdminUsers = lazyRoute(() => import('./components/Admin/AdminUsers'));
const AuditLog = lazyRoute(() => import('./components/Admin/AuditLog'));
const HowItWorks = lazyRoute(() => import('./components/HowItWorks/HowItWorks'));

/** Shown while a route's chunk is in flight. The layout around it stays put. */
const RouteFallback: React.FC = () => (
  <div className="d-flex justify-content-center py-5">
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

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
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
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