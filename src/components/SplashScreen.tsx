import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface SplashScreenProps {
  visible: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ visible }) => {
  const { t } = useLanguage();

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#FAF8F5] px-6 py-10">
      <div />
      <div className="g9-animate-modal-pop flex flex-col items-center text-center">
        <div className="w-28 h-28 rounded-2xl bg-white border border-[#E6DFD5] shadow-sm flex items-center justify-center p-3">
          <img
            src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
            alt="Grade 9 Hub Logo"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain rounded-lg"
          />
        </div>
        <h1 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-[#6B1118]">
          {t.brand.appName}
        </h1>
        <p className="mt-1.5 text-sm text-[#57534E]">{t.brand.splashSubtitle}</p>
        <div className="mt-6 h-1 w-32 overflow-hidden rounded-full bg-[#E6DFD5]">
          <div className="g9-animate-progress-fill h-full w-full bg-gradient-to-r from-[#6B1118] to-[#D9A62E]" />
        </div>
      </div>
      <p className="text-xs font-medium tracking-wide text-[#57534E]">
        {t.brand.poweredBy}
      </p>
    </div>
  );
};
