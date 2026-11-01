import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import enUS from './languages/en-us.json';
import arEG from './languages/ar-eg.json';

/**
 * i18n — English (default) and Arabic (Egyptian for Nahdet Misr).
 * RTL direction is applied in AppRoot.ThemedApp based on i18n.dir().
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      en: { translation: enUS },
      'ar-EG': { translation: arEG },
      ar: { translation: arEG },
    },
    fallbackLng: 'en-US',
    supportedLngs: ['en-US', 'en', 'ar-EG', 'ar'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'repoio-lang',
    },
  });

export default i18n;
