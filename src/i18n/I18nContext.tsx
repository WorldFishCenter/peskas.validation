import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './config'; // Initialize i18n configuration
import axios from 'axios';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

interface I18nContextType {
  language: string;
  changeLanguage: (lang: string) => Promise<void>;
  availableLanguages: Language[];
}

const I18nContext = createContext<I18nContextType | null>(null);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Available languages configuration
export const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' }
];

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<string>(i18n.language || 'en');

  // Sync local state with i18n instance
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  /**
   * Change language with full synchronization:
   * 1. Update i18next instance
   * 2. Update localStorage
   * 3. Update user preference in database (if authenticated)
   */
  const changeLanguage = useCallback(async (lang: string) => {
    try {
      // Validate language code
      if (!AVAILABLE_LANGUAGES.some(l => l.code === lang)) {
        console.error(`Invalid language code: ${lang}`);
        return;
      }

      // Update i18next (will trigger languageChanged event)
      await i18n.changeLanguage(lang);

      // Update localStorage for persistence
      localStorage.setItem('i18n_language', lang);

      // Update user preference in database if authenticated
      const authToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');

      if (authToken && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const userId = user._id || user.id;

          if (userId) {
            // Update user language preference in backend
            await axios.patch(
              `/api/users/${userId}/language`,
              { language: lang },
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            // Update stored user data with new language
            const updatedUser = { ...user, language: lang };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        } catch (error) {
          // Non-critical error: language still changed locally
          console.warn('Failed to update user language preference in database:', error);
        }
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  }, [i18n]);

  const value: I18nContextType = {
    language,
    changeLanguage,
    availableLanguages: AVAILABLE_LANGUAGES
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};
