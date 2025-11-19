import React, { useState, useEffect } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';
import { createUser, updateUser, CreateUserPayload, User } from '../../api/admin';

interface UserModalProps {
  mode: 'create' | 'edit';
  user?: User;
  onClose: () => void;
  onSuccess: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ mode, user, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with user data when editing
  useEffect(() => {
    if (mode === 'edit' && user) {
      setUsername(user.username);
      setName(user.name || '');
      setCountry(user.country || []);
      setRole(user.role);
    }
  }, [mode, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (mode === 'create' && !password.trim()) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const payload: CreateUserPayload = {
          username: username.trim(),
          password: password.trim(),
          name: name.trim() || undefined,
          country: country.length > 0 ? country : undefined,
          role
        };

        const result = await createUser(payload);

        if (result.success) {
          onSuccess();
          onClose();
        } else {
          setError(result.message);
        }
      } else if (mode === 'edit' && user) {
        const result = await updateUser(user._id, {
          name: name.trim() || undefined,
          country: country.length > 0 ? country : undefined,
          role
        });

        if (result.success) {
          onSuccess();
          onClose();
        } else {
          setError(result.message);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
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
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {mode === 'create' ? 'Create New User' : `Edit User: ${user?.username}`}
              </h5>
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

                <div className="row">
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label required">Username</label>
                      <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={mode === 'edit' || isSubmitting}
                        placeholder="Enter username"
                        required
                      />
                      {mode === 'edit' && (
                        <small className="form-hint">Username cannot be changed</small>
                      )}
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Enter full name"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Country/Countries</label>
                  <input
                    type="text"
                    className="form-control"
                    value={country.join(', ')}
                    onChange={(e) => setCountry(e.target.value.split(',').map(c => c.trim()).filter(c => c.length > 0))}
                    disabled={isSubmitting}
                    placeholder="Enter country codes separated by commas (e.g., ZZ, MZ)"
                  />
                  <small className="form-hint">Enter one or more country codes separated by commas</small>
                </div>

                {mode === 'create' && (
                  <div className="mb-3">
                    <label className="form-label required">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      placeholder="Enter password"
                      required
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label required">Role</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                    disabled={isSubmitting}
                  >
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <small className="form-hint">
                    Administrators have access to all surveys and can manage users
                  </small>
                </div>

                <div className="alert alert-info">
                  <IconInfoCircle className="icon alert-icon" size={24} stroke={2} />
                  <div>
                    <strong>Survey Permissions:</strong> Survey assignments are managed through Airtable and synced automatically.
                    {role === 'admin' && ' Administrators have access to all surveys.'}
                    {role === 'user' && ' Regular users are assigned surveys in Airtable.'}
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
                      {mode === 'create' ? 'Creating...' : 'Updating...'}
                    </>
                  ) : (
                    mode === 'create' ? 'Create User' : 'Update User'
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

export default UserModal;
