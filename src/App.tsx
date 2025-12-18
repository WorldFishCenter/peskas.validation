import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import Login from './components/Auth/Login';
import ValidationTable from './components/ValidationTable/ValidationTable';
import MainLayout from './components/Layout/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import EnumeratorPerformance from './components/EnumeratorPerformance/EnumeratorPerformance';
import AdminUsers from './components/Admin/AdminUsers';
import HowItWorks from './components/HowItWorks/HowItWorks';

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
      <Route path="/how-it-works" element={
        <ErrorBoundary>
          <HowItWorks />
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
      {isAuthenticated ? <AppRoutes /> : <Login />}
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

export default App; 