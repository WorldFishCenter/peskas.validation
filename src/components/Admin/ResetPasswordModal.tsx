import React, { useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { User } from '../../api/admin';
import { getApiBaseUrl } from '../../utils/apiConfig';

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!newPassword.trim() || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('authToken');

      if (!token) {
        setError('Authentication token not found. Please log in again.');
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
        const errorData = await response.json().catch(() => ({ message: 'Failed to reset password' }));
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          setError('You do not have permission to reset passwords.');
        } else {
          setError(errorData.message || errorData.error || 'Failed to reset password');
        }
        return;
      }

      const result = await response.json();

      if (result.success) {
        alert(`Password reset successfully for ${user.username}`);
        onSuccess();
        onClose();
      } else {
        setError(result.message || 'Failed to reset password');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('An unexpected error occurred. Please try again.');
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
              <h5 className="modal-title">Reset Password for {user.username}</h5>
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
                  <label className="form-label required">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Enter new password"
                    required
                  />
                  <small className="form-hint">Minimum 8 characters</small>
                </div>

                <div className="mb-3">
                  <label className="form-label required">Confirm Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                <div className="alert alert-warning">
                  <IconAlertTriangle className="icon alert-icon" size={24} stroke={2} />
                  <div>
                    <strong>Warning:</strong> This will immediately reset the password for {user.username}.
                    Make sure to communicate the new password securely to the user.
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
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
