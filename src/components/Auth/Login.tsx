import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="page page-center">
      <div className="container-tight py-4">
        <div className="text-center mb-4">
          <h1 className="navbar-brand navbar-brand-autodark">
            <img src="https://upload.wikimedia.org/wikipedia/en/9/9e/WorldFish_logo.svg" height="36" alt="Peskas" />
          </h1>
        </div>
        <div className="card card-md">
          <div className="card-body">
            <h2 className="h2 text-center mb-4">Login to your account</h2>
            {error && (
              <div className="alert alert-danger alert-dismissible" role="alert">
                <div className="d-flex">
                  <div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon alert-icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M12 9v2m0 4v.01"></path>
                      <path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"></path>
                    </svg>
                  </div>
                  <div>{error}</div>
                </div>
                <a className="btn-close" onClick={() => setError(null)} data-bs-dismiss="alert" aria-label="close"></a>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Username</label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path>
                      <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
                    </svg>
                  </span>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Your username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">
                  Password
                </label>
                <div className="input-group input-group-flat">
                  <span className="input-group-text">
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z"></path>
                      <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"></path>
                      <path d="M8 11v-4a4 4 0 1 1 8 0v4"></path>
                    </svg>
                  </span>
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="Your password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <div className="form-footer">
                <button 
                  type="submit" 
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="text-center text-muted mt-3">
          <a href="https://www.worldfishcenter.org/" className="text-muted" target="_blank" rel="noopener noreferrer">
            WorldFish Center © 2025
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login; 