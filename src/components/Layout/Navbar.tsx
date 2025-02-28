import React from 'react';
import { useAuth } from '../Auth/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="navbar navbar-expand-md navbar-light d-print-none">
      <div className="container-xl">
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu" aria-controls="navbar-menu" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <h1 className="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          <a href=".">
            PESKAS | <span className="text-muted">validation portal</span>
          </a>
        </h1>
        <div className="navbar-nav flex-row order-md-last">
          <div className="nav-item dropdown">
            <a href="#" className="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Open user menu">
              <div className="d-none d-xl-block ps-2">
                <div>{user}</div>
                <div className="mt-1 small text-muted">Administrator</div>
              </div>
            </a>
            <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
              <button className="dropdown-item" onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar; 