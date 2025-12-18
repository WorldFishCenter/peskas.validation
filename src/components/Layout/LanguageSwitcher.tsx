import React from 'react';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useI18n } from '../../i18n/I18nContext';

/**
 * LanguageSwitcher Component
 *
 * Tabler-styled dropdown for switching application language.
 * Follows Tabler's standard navbar dropdown pattern.
 * - Desktop: Shows icon + language name
 * - Mobile: Shows icon only
 * - Updates instantly without page reload
 */
const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const { changeLanguage, availableLanguages } = useI18n();

  // Find current language configuration
  const currentLang = availableLanguages.find(l => l.code === i18n.language) || availableLanguages[0];

  return (
    <div className="nav-item dropdown">
      <a
        href="#"
        className="nav-link d-flex lh-1 text-reset p-0"
        data-bs-toggle="dropdown"
        aria-label="Select language"
        aria-expanded="false"
      >
        <div className="d-flex align-items-center px-2">
          <IconLanguage className="icon" size={24} stroke={2} />
          <span className="ms-2 d-none d-lg-inline">{currentLang.nativeName}</span>
        </div>
      </a>
      <div className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
        <h6 className="dropdown-header">Select Language</h6>
        {availableLanguages.map(lang => {
          const isActive = i18n.language === lang.code;
          return (
            <button
              key={lang.code}
              className={`dropdown-item ${isActive ? 'active' : ''}`}
              onClick={() => !isActive && changeLanguage(lang.code)}
              type="button"
            >
              {lang.nativeName}
              {isActive && (
                <IconCheck className="icon ms-auto text-primary" size={20} stroke={2} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
