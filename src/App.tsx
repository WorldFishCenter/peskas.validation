import React from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import Login from './components/Auth/Login';
import ValidationTable from './components/ValidationTable/ValidationTable';
import MainLayout from './components/Layout/MainLayout';

// Remove or fix these imports
// import '@tabler/core/dist/css/tabler.min.css';
// import '@tabler/core/dist/js/tabler.min.js';

// Add a direct link to Tabler CSS in your index.html instead
// Or use these alternative imports if available:
// import '@tabler/core/css/tabler.min.css';

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
      {isAuthenticated ? (
          <div className="card-body">
            <ValidationTable />
        </div>
      ) : (
        <Login />
      )}
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App; 