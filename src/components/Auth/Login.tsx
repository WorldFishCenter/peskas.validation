import React, { useState } from 'react';
import { IconAlertTriangle, IconUser, IconLock, IconMail } from '@tabler/icons-react';
import { useAuth } from './AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, loading } = useAuth();

  const handleLogin = async () => {
    // Clear previous errors
    setError(null);

    // Validate inputs
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    // Attempt login
    const result = await login(username.trim(), password);

    // Handle result
    if (!result.success) {
      setError(result.error || 'Invalid username or password');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleLogin();
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
              <div className="alert alert-danger alert-dismissible mb-3" role="alert">
                <div className="d-flex">
                  <div className="me-2">
                    <IconAlertTriangle className="icon alert-icon" size={24} stroke={2} />
                  </div>
                  <div className="flex-fill">
                    <h4 className="alert-title mb-1">Login Failed</h4>
                    <div className="text-muted">{error}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setError(null)}
                  aria-label="close"
                ></button>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Username</label>
              <div className="input-group input-group-flat">
                <span className="input-group-text">
                  <IconUser className="icon" size={24} stroke={2} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Password</label>
              <div className="input-group input-group-flat">
                <span className="input-group-text">
                  <IconLock className="icon" size={24} stroke={2} />
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="form-footer">
              <button
                type="button"
                className="btn btn-blue w-100"
                disabled={loading}
                onClick={handleLogin}
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
          </div>
        </div>

        {/* Help Section */}
        <div className="card card-md mt-3">
          <div className="card-body">
            <div className="d-flex align-items-start">
              <div className="me-3">
                <div className="bg-blue-lt rounded p-2">
                  <IconMail className="icon text-blue" size={28} stroke={2} />
                </div>
              </div>
              <div className="flex-fill">
                <h3 className="h3 mb-2">Need Help?</h3>
                <p className="text-muted mb-3">
                  If you're having trouble logging in or need assistance, please contact:
                </p>
                <a href="mailto:peskas.platform@gmail.com" className="btn btn-outline-blue">
                  <IconMail className="icon me-2" size={20} stroke={2} />
                  peskas.platform@gmail.com
                </a>
              </div>
            </div>
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
