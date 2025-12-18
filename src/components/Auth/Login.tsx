import React, { useState } from 'react';
import { IconAlertTriangle, IconUser, IconLock, IconMail, IconLanguage, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { useI18n } from '../../i18n/I18nContext';

const Login: React.FC = () => {
  const { t } = useTranslation('auth');
  const { i18n } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, loading } = useAuth();
  const { changeLanguage, availableLanguages } = useI18n();
  
  // Find current language configuration
  const currentLang = availableLanguages.find(l => l.code === i18n.language) || availableLanguages[0];

  const handleLogin = async () => {
    // Clear previous errors
    setError(null);

    // Validate inputs
    if (!username.trim() || !password.trim()) {
      setError(t('login.validationError'));
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
          <a href="." className="navbar-brand navbar-brand-autodark">
            <img src="https://upload.wikimedia.org/wikipedia/en/9/9e/WorldFish_logo.svg" height="36" alt="Peskas" />
          </a>
        </div>
        <div className="card card-md" tabIndex={-1} style={{ outline: 'none' }}>
          <div className="card-body">
            {/* Header with title and language switcher */}
            <div className="d-flex justify-content-between align-items-start mb-4">
              <h2 className="card-title mb-0">{t('login.title')}</h2>
              <div className="dropdown">
                <button
                  className="btn btn-secondary d-flex align-items-center"
                  type="button"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="true"
                  aria-label="Select language"
                  aria-expanded="false"
                  onFocus={(e) => {
                    e.stopPropagation();
                    // Prevent card from getting focus outline
                    const cardBody = e.currentTarget.closest('.card-body') as HTMLElement;
                    if (cardBody) {
                      cardBody.setAttribute('tabindex', '-1');
                      cardBody.style.outline = 'none';
                    }
                  }}
                  onBlur={(e) => {
                    const cardBody = e.currentTarget.closest('.card-body') as HTMLElement;
                    if (cardBody) {
                      cardBody.removeAttribute('tabindex');
                    }
                  }}
                >
                  <IconLanguage className="icon" size={20} stroke={2} />
                  <span className="ms-2">{currentLang.nativeName}</span>
                </button>
                <div className="dropdown-menu dropdown-menu-end">
                  <h6 className="dropdown-header">Select Language</h6>
                  {availableLanguages.map(lang => {
                    const isActive = i18n.language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        className={`dropdown-item d-flex align-items-center ${isActive ? 'active' : ''}`}
                        onClick={() => !isActive && changeLanguage(lang.code)}
                        type="button"
                      >
                        <span>{lang.nativeName}</span>
                        {isActive && (
                          <IconCheck className="icon ms-auto text-primary" size={20} stroke={2} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger alert-dismissible mb-3" role="alert">
                <div className="d-flex">
                  <div className="me-2">
                    <IconAlertTriangle className="icon alert-icon" size={24} stroke={2} />
                  </div>
                  <div className="flex-fill">
                    <h4 className="alert-title mb-1">{t('login.loginFailed')}</h4>
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
              <label className="form-label">{t('login.username')}</label>
              <div className="input-group input-group-flat">
                <span className="input-group-text">
                  <IconUser className="icon" size={24} stroke={2} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('login.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">{t('login.password')}</label>
              <div className="input-group input-group-flat">
                <span className="input-group-text">
                  <IconLock className="icon" size={24} stroke={2} />
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder={t('login.passwordPlaceholder')}
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
                className="btn btn-primary w-100"
                disabled={loading}
                onClick={handleLogin}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {t('login.signingIn')}
                  </>
                ) : (
                  t('login.signIn')
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
                <div className="bg-primary-lt rounded p-2">
                  <IconMail className="icon text-primary" size={28} stroke={2} />
                </div>
              </div>
              <div className="flex-fill">
                <h3 className="h3 mb-2">{t('login.needHelp')}</h3>
                <p className="text-muted mb-3">
                  {t('login.helpText')}
                </p>
                <a href={`mailto:${t('login.contactEmail')}`} className="btn btn-outline-primary">
                  <IconMail className="icon me-2" size={20} stroke={2} />
                  {t('login.contactEmail')}
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
