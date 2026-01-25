import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconCheck, IconChartBar, IconDownload, IconUsers, IconHelp } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../Auth/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { t } = useTranslation('navigation');

  return (
    <header className="navbar navbar-expand-md navbar-light d-print-none">
      <div className="container-xl">
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu" aria-controls="navbar-menu" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <h1 className="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          <Link to="/">
            {t('brand').split('|')[0]} | <span className="text-muted">{t('brand').split('|')[1]?.trim()}</span>
          </Link>
        </h1>
        <div className="navbar-nav flex-row order-md-last">
          <LanguageSwitcher />
          <div className="nav-item dropdown ms-2">
            <a href="#" className="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-label="Open user menu">
              <div className="d-none d-xl-block ps-2">
                <div>{user?.username}</div>
                <div className="mt-1 small text-muted">{user?.role === 'admin' ? t('role.admin') : t('role.user')}</div>
              </div>
            </a>
            <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
              <button className="dropdown-item" onClick={logout}>{t('logout')}</button>
            </div>
          </div>
        </div>
        <div className="collapse navbar-collapse" id="navbar-menu">
          <div className="d-flex flex-column flex-md-row flex-fill align-items-stretch align-items-md-center">
            <ul className="navbar-nav">
              <li className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                <Link to="/" className="nav-link">
                  <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                    <IconCheck className="icon" size={24} stroke={2} />
                  </span>
                  <span className="nav-link-title">{t('validation')}</span>
                </Link>
              </li>
              <li className={`nav-item ${location.pathname === '/enumerators' ? 'active' : ''}`}>
                <Link to="/enumerators" className="nav-link">
                  <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                    <IconChartBar className="icon" size={24} stroke={2} />
                  </span>
                  <span className="nav-link-title">{t('enumeratorPerformance')}</span>
                </Link>
              </li>
              <li className={`nav-item ${location.pathname === '/data-download' ? 'active' : ''}`}>
                <Link to="/data-download" className="nav-link">
                  <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                    <IconDownload className="icon" size={24} stroke={2} />
                  </span>
                  <span className="nav-link-title">{t('dataDownload')}</span>
                </Link>
              </li>
              <li className={`nav-item ${location.pathname === '/how-it-works' ? 'active' : ''}`}>
                <Link to="/how-it-works" className="nav-link">
                  <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                    <IconHelp className="icon" size={24} stroke={2} />
                  </span>
                  <span className="nav-link-title">{t('howItWorks')}</span>
                </Link>
              </li>
              {/* Admin-only Users Management Link */}
              {user?.role === 'admin' && (
                <li className={`nav-item ${location.pathname === '/admin/users' ? 'active' : ''}`}>
                  <Link to="/admin/users" className="nav-link">
                    <span className="nav-link-icon d-md-none d-lg-inline-block me-1">
                      <IconUsers className="icon" size={24} stroke={2} />
                    </span>
                    <span className="nav-link-title">{t('users')}</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar; 