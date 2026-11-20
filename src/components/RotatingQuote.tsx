import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface RotatingQuoteProps {
  quotes: string[];
  dir: 'ltr' | 'rtl';
  intervalMs?: number;
  className?: string;
  iconClassName?: string;
}

export const RotatingQuote: React.FC<RotatingQuoteProps> = ({
  quotes,
  dir,
  intervalMs = 3500,
  className = '',
  iconClassName = 'w-4 h-4 text-[#E5B742] shrink-0',
}) => {
  const safeQuotes =
    quotes.length > 0 ? quotes : ['Your effort today is the glory of your tomorrow.'];
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [transitionSeq, setTransitionSeq] = useState(0);
  const [paused, setPaused] = useState(false);
  const clearPrevTimerRef = useRef<number | null>(null);

  const normalizedActiveIndex = activeIndex % safeQuotes.length;

  const advanceQuote = useCallback(() => {
    if (safeQuotes.length <= 1) return;
    setActiveIndex((current) => {
      const currNormalized = current % safeQuotes.length;
      const next = (currNormalized + 1) % safeQuotes.length;
      setPreviousIndex(currNormalized);
      setTransitionSeq((seq) => seq + 1);
      if (clearPrevTimerRef.current !== null) {
        window.clearTimeout(clearPrevTimerRef.current);
      }
      clearPrevTimerRef.current = window.setTimeout(() => {
        setPreviousIndex(null);
        clearPrevTimerRef.current = null;
      }, 440);
      return next;
    });
  }, [safeQuotes.length]);

  useEffect(() => {
    return () => {
      if (clearPrevTimerRef.current !== null) {
        window.clearTimeout(clearPrevTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (paused || safeQuotes.length <= 1) return;
    const timer = window.setInterval(advanceQuote, intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, intervalMs, advanceQuote, safeQuotes.length]);

  const currentQuote = safeQuotes[normalizedActiveIndex];
  const outgoingQuote =
    previousIndex !== null ? safeQuotes[previousIndex % safeQuotes.length] : null;

  return (
    <button
      type="button"
      onClick={advanceQuote}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label={`Motivational quote: ${currentQuote}. Click for next quote.`}
      title={currentQuote}
      className={`group w-full rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-md border border-white/15 px-4 py-2.5 sm:px-5 sm:py-3.5 overflow-hidden flex items-center justify-center gap-2.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B742]/70 cursor-pointer ${
        dir === 'rtl' ? 'not-italic' : 'italic'
      } ${className}`}
    >
      <Sparkles className={iconClassName} aria-hidden="true" />
      <span className="relative inline-grid overflow-hidden align-middle min-w-0">
        {outgoingQuote !== null && (
          <span
            key={`out-${transitionSeq}`}
            aria-hidden="true"
            className="col-start-1 row-start-1 pointer-events-none g9-quote-exit-up"
          >
            “{outgoingQuote}”
          </span>
        )}
        <span
          key={`in-${transitionSeq}`}
          className={`col-start-1 row-start-1 ${
            transitionSeq > 0 ? 'g9-quote-enter-up' : ''
          }`}
        >
          “{currentQuote}”
        </span>
      </span>
    </button>
  );
};
