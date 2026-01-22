import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconMail, IconArrowLeft } from '@tabler/icons-react';
import LanguageSwitcher from '../Layout/LanguageSwitcher';
import { requestPasswordReset } from '../../api/auth';

const ForgotPassword: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError(t('forgotPassword.validationError'));
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(identifier);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || t('errors.emailSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="page page-center">
        <div className="container container-tight py-4">
          <div className="text-center mb-4">
            <Link to="/">
              <img src="https://upload.wikimedia.org/wikipedia/en/9/9e/WorldFish_logo.svg" height="36" alt="WorldFish" />
            </Link>
          </div>
          <div className="card card-md">
            <div className="card-body text-center">
              <div className="text-success mb-3">
                <IconMail size={48} />
              </div>
              <h2 className="card-title mb-3">{t('forgotPassword.successTitle')}</h2>
              <p className="text-secondary">{t('forgotPassword.successMessage')}</p>
              <div className="mt-4">
                <Link to="/" className="btn btn-primary w-100">
                  <IconArrowLeft size={16} className="me-2" />
                  {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-center">
      <div className="container container-tight py-4">
        <div className="text-center mb-4">
          <Link to="/">
            <img src="https://upload.wikimedia.org/wikipedia/en/9/9e/WorldFish_logo.svg" height="36" alt="WorldFish" />
          </Link>
        </div>
        <div className="card card-md">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="card-title">{t('forgotPassword.title')}</h2>
              <LanguageSwitcher />
            </div>
            <p className="text-secondary mb-4">{t('forgotPassword.subtitle')}</p>

            {error && (
              <div className="alert alert-danger alert-dismissible" role="alert">
                <div className="d-flex">
                  <div>{error}</div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setError(null)}
                    aria-label="Close"
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">{t('forgotPassword.identifier')}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('forgotPassword.identifierPlaceholder')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                  disabled={loading}
                />
              </div>
              <div className="form-footer">
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                  {loading ? t('forgotPassword.sending') : t('forgotPassword.sendInstructions')}
                </button>
              </div>
            </form>

            <div className="text-center text-secondary mt-3">
              <Link to="/" className="link-secondary">
                <IconArrowLeft size={16} className="me-1" />
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
