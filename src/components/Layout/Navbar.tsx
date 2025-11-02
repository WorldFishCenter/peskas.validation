import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../Auth/AuthContext';
import AlertGuideModal from '../ValidationTable/AlertGuideModal';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showAlertGuide, setShowAlertGuide] = React.useState(false);
  
  return (
    <header className="navbar navbar-expand-md navbar-light d-print-none">
      <div className="container-xl">
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu" aria-controls="navbar-menu" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <h1 className="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          <Link to="/">
            🇹🇿 PESKAS | <span className="text-muted">validation portal</span>
          </Link>
        </h1>
        <div className="collapse navbar-collapse" id="navbar-menu">
          <div className="d-flex flex-column flex-md-row flex-fill align-items-stretch align-items-md-center">
            <ul className="navbar-nav">
              <li className="nav-item">
                <Link to="/" className={`nav-link px-3 ${location.pathname === '/' ? 'active font-weight-bold' : ''}`}>
                  <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-checkbox" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M9 11l3 3l8 -8"></path>
                      <path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9"></path>
                    </svg>
                  </span>
                  <span className="nav-link-title">Validation</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/enumerators" className={`nav-link px-3 ${location.pathname === '/enumerators' ? 'active font-weight-bold' : ''}`}>
                  <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-chart-bar" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                      <path d="M3 12m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>
                      <path d="M9 8m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>
                      <path d="M15 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>
                    </svg>
                  </span>
                  <span className="nav-link-title">Enumerator Performance</span>
                </Link>
              </li>
              {/* Admin-only Users Management Link */}
              {user?.role === 'admin' && (
                <li className="nav-item">
                  <Link to="/admin/users" className={`nav-link px-3 ${location.pathname === '/admin/users' ? 'active font-weight-bold' : ''}`}>
                    <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-users" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        <path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path>
                      </svg>
                    </span>
                    <span className="nav-link-title">Users</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="navbar-nav flex-row order-md-last align-items-center">
          {/* Alert Codes Button */}
          <button
            className="btn btn-outline-warning me-3"
            style={{ fontWeight: 500 }}
            onClick={() => setShowAlertGuide(true)}
            title="View Alert Codes Reference"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-alert-circle" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}>
              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Alert Codes
          </button>
          {/* User Dropdown */}
          <div className="nav-item dropdown">
            <a href="#" className="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Open user menu">
              <div className="d-none d-xl-block ps-2">
                <div>{user?.username}</div>
                <div className="mt-1 small text-muted">{user?.role === 'admin' ? 'Administrator' : 'User'}</div>
              </div>
            </a>
            <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
              <button className="dropdown-item" onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      </div>
      {/* Alert Guide Modal */}
      {showAlertGuide && (
        <AlertGuideModal onClose={() => setShowAlertGuide(false)} />
      )}
    </header>
  );
};

export default Navbar; 