import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import Login from './components/Auth/Login';
import ValidationTable from './components/ValidationTable/ValidationTable';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import EnumeratorPerformance from './components/EnumeratorPerformance/EnumeratorPerformance';
import AdminUsers from './components/Admin/AdminUsers';

// Remove or fix these imports
// import '@tabler/core/dist/css/tabler.min.css';
// import '@tabler/core/dist/js/tabler.min.js';

// Add a direct link to Tabler CSS in your index.html instead
// Or use these alternative imports if available:
// import '@tabler/core/css/tabler.min.css';

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
      <Route path="/admin/users" element={
        <ErrorBoundary>
          <AdminUsers />
        </ErrorBoundary>
      } />
    </Routes>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="page page-center">
        <div className="container container-slim py-4">
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
      {isAuthenticated ? <AppRoutes /> : <Login />}
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App; 