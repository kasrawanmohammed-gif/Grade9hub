import React from 'react';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

type BoundaryLang = 'en' | 'ku' | 'ar';

interface BoundaryCopy {
  dir: 'ltr' | 'rtl';
  title: string;
  subtitle: string;
  reloadBtn: string;
  resetSessionBtn: string;
  permissionHint: string;
}

const BOUNDARY_COPY: Record<BoundaryLang, BoundaryCopy> = {
  en: {
    dir: 'ltr',
    title: 'Grade 9 Hub — Recovery Notice',
    subtitle: 'Something interrupted this screen. You can reload safely or reset local cached session data if the issue persists.',
    reloadBtn: 'Reload Grade 9 Hub',
    resetSessionBtn: 'Reset Cached Session & Reload',
    permissionHint: 'Cloud sync permission error',
  },
  ku: {
    dir: 'rtl',
    title: 'ناوەندی پۆلی ٩ — ئاگاداری چاککردنەوە',
    subtitle: 'کێشەیەک لەم پەڕەیەدا ڕوویدا. دەتوانیت بە سەلامەتی نوێی بکەیتەوە یان داتای کاش و دانیشتن ڕێکبخەیتەوە.',
    reloadBtn: 'نوێکردنەوەی ناوەندی پۆلی ٩',
    resetSessionBtn: 'پاککردنەوەی کاشی دانیشتن و نوێکردنەوە',
    permissionHint: 'هەڵەی مۆڵەتی هاوکاتکردنی هەور',
  },
  ar: {
    dir: 'rtl',
    title: 'منصة الصف التاسع — إشعار الاسترداد',
    subtitle: 'حدث خلل مؤقت في هذه الشاشة. يمكنك إعادة التحميل بأمان أو إعادة ضبط الجلسة المحلية إذا استمرت المشكلة.',
    reloadBtn: 'إعادة تحميل منصة الصف التاسع',
    resetSessionBtn: 'إعادة ضبط الجلسة المحلية والتحميل',
    permissionHint: 'خطأ في أذونات المزامنة السحابية',
  },
};

function detectBoundaryLang(): BoundaryLang {
  try {
    const saved = window.localStorage?.getItem('grade9hub_lang');
    if (saved === 'ku' || saved === 'ar' || saved === 'en') {
      return saved;
    }
    const htmlLang = document.documentElement?.lang;
    if (htmlLang === 'ku' || htmlLang === 'ar' || htmlLang === 'en') {
      return htmlLang;
    }
  } catch {
    // ignore storage restriction
  }
  return 'en';
}

interface Props {
  children: React.ReactNode;
  resetKey?: string | number;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  message: string;
}

export class FirestoreErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error.',
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  private handleResetAndReload = () => {
    try {
      const keysToClear = [
        'grade9hub_token',
        'grade9hub_user',
        'grade9hub_login_ts',
        'grade9hub_session_notice',
      ];
      for (const key of keysToClear) {
        window.localStorage?.removeItem(key);
        window.sessionStorage?.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const lang = detectBoundaryLang();
      const copy = BOUNDARY_COPY[lang];
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed?.error) {
          friendly = `${copy.permissionHint} (${parsed.operationType || 'read/write'}): ${parsed.error}`;
        }
      } catch {
        // use raw message
      }

      return (
        <div
          dir={copy.dir}
          className={`${
            this.props.compact ? 'min-h-[360px] rounded-2xl' : 'min-h-screen'
          } flex items-center justify-center bg-[#FAF8F5] dark:bg-[#121110] text-[#1C1917] dark:text-[#F5F2ED] p-6`}
        >
          <div className="max-w-md w-full bg-white dark:bg-[#1C1A17] border border-[#E6DFD5] dark:border-[#302B25] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-[#6B1118] dark:text-[#F2A7AE]">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold">{copy.title}</h2>
            </div>
            <p className="text-sm text-[#57534E] dark:text-[#C7BEB4] leading-relaxed">
              {copy.subtitle}
            </p>
            {friendly && (
              <p className="text-xs text-[#78716C] dark:text-[#9E958C] bg-[#FAF8F5] dark:bg-[#151311] border border-[#E6DFD5] dark:border-[#302B25] rounded-xl p-3 break-words">
                {friendly}
              </p>
            )}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{copy.reloadBtn}</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] dark:border-[#3A342D] bg-[#FAF8F5] dark:bg-[#24211D] px-4 py-2.5 text-xs font-semibold text-[#57534E] dark:text-[#D6CEC5] hover:border-[#6B1118] hover:text-[#6B1118] dark:hover:text-[#F2A7AE] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{copy.resetSessionBtn}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
