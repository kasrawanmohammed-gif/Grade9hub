import React from 'react';
import { BookOpen, Code2, Cpu, GraduationCap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import educatorDeskImg from '../assets/images/educator_science_desk_1794573934293.jpg';

export const AboutView: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-[#E6DFD5] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 bg-[#6B1118] relative min-h-[260px]">
          <img
            src={educatorDeskImg}
            alt="Grade 9 Science Educator Workspace"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#3E080C]/80 via-transparent to-transparent" />
          <div className="absolute bottom-5 start-5 end-5 flex items-center gap-3 text-white">
            <img
              src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
              alt="Grade 9 Hub Logo"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg bg-white p-1 object-contain shrink-0"
            />
            <div>
              <p className="text-sm font-bold">{t.brand.appName}</p>
              <p className="text-xs text-[#FBF4DF]/80">{t.brand.schoolTag}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#6B1118]">{t.about.kicker}</p>
            <h2 className="mt-2 text-3xl font-bold text-[#1C1917]">{t.about.name}</h2>
            <p className="mt-1 text-base font-semibold text-[#6B1118]">{t.about.roleLine}</p>

            <div className="mt-5 space-y-4 text-sm sm:text-base text-[#57534E] leading-relaxed">
              <p>{t.about.bioP1}</p>
              <p>{t.about.bioP2}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-[#E6DFD5]">
            <div className="space-y-1">
              <GraduationCap className="w-5 h-5 text-[#6B1118]" />
              <p className="text-sm font-bold text-[#1C1917]">{t.about.pillar1Title}</p>
              <p className="text-xs text-[#57534E]">{t.about.pillar1Desc}</p>
            </div>
            <div className="space-y-1">
              <Code2 className="w-5 h-5 text-[#D9A62E]" />
              <p className="text-sm font-bold text-[#1C1917]">{t.about.pillar2Title}</p>
              <p className="text-xs text-[#57534E]">{t.about.pillar2Desc}</p>
            </div>
            <div className="space-y-1">
              <Cpu className="w-5 h-5 text-[#6B1118]" />
              <p className="text-sm font-bold text-[#1C1917]">{t.about.pillar3Title}</p>
              <p className="text-xs text-[#57534E]">{t.about.pillar3Desc}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E6DFD5] flex items-center justify-between text-xs text-[#57534E]">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#6B1118]" />
              {t.brand.appName}
            </span>
            <span dir="ltr" className="font-semibold text-[#6B1118]">{t.brand.poweredBy}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
