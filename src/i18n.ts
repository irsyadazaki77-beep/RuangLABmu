import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import idTranslation from './locales/id.json';
import enTranslation from './locales/en.json';

export const LANGUAGE_STORAGE_KEY = 'ruanglab:language';

function getInitialLanguage(): 'id' | 'en' {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'id') {
        return saved;
      }
    }
  } catch {
    // ignore storage errors
  }
  return 'id';
}

void i18n.use(initReactI18next).init({
  resources: {
    id: { translation: idTranslation },
    en: { translation: enTranslation },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'id',
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLanguage(lang: 'id' | 'en'): void {
  void i18n.changeLanguage(lang);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  } catch {
    // ignore storage errors
  }
}

export default i18n;
