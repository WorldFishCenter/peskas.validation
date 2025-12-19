import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconAlertTriangle } from '@tabler/icons-react';
import { User } from '../../api/admin';
import { getApiBaseUrl } from '../../utils/apiConfig';

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const { t } = useTranslation('admin');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!newPassword.trim() || newPassword.length < 8) {
      setError(t('form.passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('form.passwordsNoMatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('authToken');

      if (!token) {
        setError(t('messages.tokenNotFound'));
        setIsSubmitting(false);
        return;
      }

      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/users/${user._id}/reset-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: t('form.resetPasswordFailed') }));
        if (response.status === 401) {
          setError(t('form.authFailed'));
        } else if (response.status === 403) {
          setError(t('form.permissionDenied'));
        } else {
          setError(errorData.message || errorData.error || t('form.resetPasswordFailed'));
        }
        return;
      }

      const result = await response.json();

      if (result.success) {
        alert(`${t('form.passwordResetSuccess')}${user.username}`);
        onSuccess();
        onClose();
      } else {
        setError(result.message || t('form.resetPasswordFailed'));
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError(t('form.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div className="modal-backdrop fade show" onClick={onClose}></div>

      {/* Modal */}
      <div className="modal modal-blur fade show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{t('modal.resetPasswordFor')}{user.username}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger alert-dismissible">
                    <div className="d-flex">
                      <div>{error}</div>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label required">{t('form.newPassword')}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder={t('form.newPasswordPlaceholder')}
                    required
                  />
                  <small className="form-hint">{t('form.minCharacters')}</small>
                </div>

                <div className="mb-3">
                  <label className="form-label required">{t('form.confirmPassword')}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder={t('form.confirmPasswordPlaceholder')}
                    required
                  />
                </div>

                <div className="alert alert-warning">
                  <IconAlertTriangle className="icon alert-icon" size={24} stroke={2} />
                  <div>
                    {t('modal.resetPasswordWarning', { username: user.username })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-link link-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {t('form.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      {t('form.resetting')}
                    </>
                  ) : (
                    t('form.resetPassword')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPasswordModal;
