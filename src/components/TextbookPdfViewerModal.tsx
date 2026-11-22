import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';
import pdfWorkerSrc from '../vendor/pdfjs/pdf.worker.min.mjs?url';
import { useLanguage } from '../contexts/LanguageContext';
import {
  OFFICIAL_BOOK_CHAPTER_BOOKMARKS,
  OFFICIAL_BOOK_TOTAL_PAGES,
  getOfficialBookChapterTitle,
} from '../lib/textbookCatalog';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface TextbookPdfViewerModalProps {
  url: string;
  title: string;
  fileName?: string | null;
  initialPage?: number;
  isOfficialBook?: boolean;
  onClose: () => void;
}

export const TextbookPdfViewerModal: React.FC<TextbookPdfViewerModalProps> = ({
  url,
  title,
  fileName,
  initialPage = 1,
  isOfficialBook = false,
  onClose,
}) => {
  const { language, t, dir } = useLanguage();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [numPages, setNumPages] = useState<number>(
    isOfficialBook ? OFFICIAL_BOOK_TOTAL_PAGES : 1
  );
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage));
  const [pageInput, setPageInput] = useState<string>(String(Math.max(1, initialPage)));
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 760,
    height: 600,
  });

  const [docLoading, setDocLoading] = useState<boolean>(true);
  const [pageRendering, setPageRendering] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  // Prevent background page scrolling while the textbook reader overlay is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Measure both width and height of the middle stage so the full page fits neatly in one screen
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      const horizPad = el.clientWidth < 640 ? 16 : 24;
      const vertPad = el.clientHeight < 520 ? 12 : 20;
      const nextWidth = Math.max(240, el.clientWidth - horizPad);
      const nextHeight = Math.max(220, el.clientHeight - vertPad);
      setStageSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateSize);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load PDF document lazily via HTTP Range chunks
  useEffect(() => {
    let cancelled = false;
    setDocLoading(true);
    setLoadError(false);

    const loadingTask = pdfjsLib.getDocument({
      url,
      rangeChunkSize: 65536,
      disableAutoFetch: true,
      disableStream: false,
    });

    loadingTask.promise
      .then((pdf) => {
        if (cancelled) {
          void pdf.cleanup();
          return;
        }
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        const safeInitial = Math.min(Math.max(1, initialPage), pdf.numPages);
        setCurrentPage(safeInitial);
        setPageInput(String(safeInitial));
        setDocLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setDocLoading(false);
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
      if (pdfDocRef.current) {
        void pdfDocRef.current.cleanup();
        pdfDocRef.current = null;
      }
      void loadingTask.destroy();
    };
  }, [url, initialPage]);

  // Render active page onto HiDPI canvas scaled to fit BOTH stage width & height cleanly
  useEffect(() => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || docLoading || loadError) return;

    let cancelled = false;
    setPageRendering(true);

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }

    const safePage = Math.min(Math.max(1, currentPage), pdf.numPages);

    pdf
      .getPage(safePage)
      .then((page) => {
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const maxFitWidth = Math.min(stageSize.width, 960);
        const maxFitHeight = stageSize.height;
        const fitWidthScale = maxFitWidth / baseViewport.width;
        const fitHeightScale = maxFitHeight / baseViewport.height;
        const containScale = Math.min(fitWidthScale, fitHeightScale);
        const cssScale = Math.max(0.25, containScale * zoomScale);
        const outputScale = Math.min(window.devicePixelRatio || 1, 2.5);

        const cssViewport = page.getViewport({ scale: cssScale });
        const renderViewport = page.getViewport({ scale: cssScale * outputScale });

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;

        const renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport: renderViewport,
        });
        renderTaskRef.current = renderTask;

        return renderTask.promise;
      })
      .then(() => {
        if (!cancelled) {
          setPageRendering(false);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled && !msg.includes('RenderingCancelledException')) {
          setPageRendering(false);
        }
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [currentPage, zoomScale, stageSize, docLoading, loadError]);

  const goToPage = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(1, Math.round(target)), numPages);
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      if (stageContainerRef.current) {
        stageContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    },
    [numPages]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowRight') {
        goToPage(dir === 'rtl' ? currentPage - 1 : currentPage + 1);
      } else if (e.key === 'ArrowLeft') {
        goToPage(dir === 'rtl' ? currentPage + 1 : currentPage - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, dir, goToPage, onClose]);

  const activeBookmark = useMemo(() => {
    if (!isOfficialBook) return null;
    let active = OFFICIAL_BOOK_CHAPTER_BOOKMARKS[0];
    for (const item of OFFICIAL_BOOK_CHAPTER_BOOKMARKS) {
      if (currentPage >= item.page) {
        active = item;
      }
    }
    return active;
  }, [currentPage, isOfficialBook]);

  const activeBookmarkKey = activeBookmark?.key ?? null;
  const activeChapterTitle = activeBookmark?.chapterNumber
    ? getOfficialBookChapterTitle(activeBookmark.chapterNumber, language)
    : null;

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!Number.isNaN(parsed)) {
      goToPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const isZoomedBeyondFit = zoomScale > 1;

  return (
    <div
      className="fixed inset-0 z-50 h-dvh max-h-dvh overflow-hidden flex flex-col bg-[#1C1917]/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Compact Top Reader Toolbar */}
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#1C1917] px-3 py-2 sm:px-5 text-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            aria-label={t.textbooks.closeReaderBtn}
            className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 p-2 text-white hover:bg-white/15 transition-colors cursor-pointer min-h-[38px] min-w-[38px] shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold truncate text-white">{title}</h3>
            <p className="text-[11px] text-white/70 tabular-nums truncate">
              {t.textbooks.pageLabel} {currentPage} {t.textbooks.ofPagesLabel} {numPages}
              {activeBookmark?.chapterNumber ? (
                <span className="ms-1.5 text-[#E5B742] font-semibold">
                  · {t.textbooks.chapterTabPrefix} {activeBookmark.chapterNumber}
                  {activeChapterTitle ? ` — ${activeChapterTitle}` : ''}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* File Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap min-h-[38px]"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#E5B742]" />
            <span>{t.textbooks.openNewTabBtn}</span>
          </a>

          <a
            href={url}
            download={fileName || 'Science_9_Book.pdf'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B1118] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#82161E] transition-colors whitespace-nowrap min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5 text-[#E5B742]" />
            <span className="hidden xs:inline">{t.textbooks.downloadBtn}</span>
          </a>
        </div>
      </header>

      {/* Quick Chapter Navigation Strip for Official Grade 9 Science Book */}
      {isOfficialBook && (
        <div className="border-b border-white/10 bg-[#24201E] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {OFFICIAL_BOOK_CHAPTER_BOOKMARKS.map((bm) => {
            const active = activeBookmarkKey === bm.key;
            const label =
              bm.kind === 'cover'
                ? t.textbooks.coverLabel
                : bm.kind === 'contents'
                ? t.textbooks.contentsLabel
                : `${t.textbooks.chapterTabPrefix} ${bm.chapterNumber}`;
            const chapterTitle =
              bm.chapterNumber !== null
                ? getOfficialBookChapterTitle(bm.chapterNumber, language)
                : null;
            return (
              <button
                key={bm.key}
                type="button"
                title={chapterTitle ? `${label} — ${chapterTitle}` : label}
                onClick={() => goToPage(bm.page)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[32px] ${
                  active
                    ? 'bg-[#6B1118] text-white border-[#E5B742]/70'
                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{label}</span>
                <span className="ms-1 opacity-70 tabular-nums text-[10px]">p.{bm.page}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Centered Viewport-Fit Stage */}
      <div
        ref={stageContainerRef}
        className={`flex-1 min-h-0 w-full bg-[#24201E] ${
          isZoomedBeyondFit
            ? 'overflow-auto flex items-start justify-center p-2 sm:p-4'
            : 'overflow-hidden flex items-center justify-center p-2 sm:p-3'
        }`}
      >
        {loadError ? (
          <div className="my-auto max-w-md w-full rounded-2xl bg-[#FAF8F5] border border-[#E6DFD5] p-6 text-center space-y-4">
            <p className="text-sm font-medium text-[#1C1917] leading-relaxed">
              {t.textbooks.pdfLoadErrorMsg}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] min-h-[42px]"
              >
                <ExternalLink className="w-4 h-4 text-[#6B1118]" />
                <span>{t.textbooks.openNewTabBtn}</span>
              </a>
              <a
                href={url}
                download={fileName || 'Science_9_Book.pdf'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#530D12] min-h-[42px]"
              >
                <Download className="w-4 h-4 text-[#E5B742]" />
                <span>{t.textbooks.downloadBtn}</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="relative my-auto flex flex-col items-center justify-center">
            {(docLoading || pageRendering) && (
              <div className="pointer-events-none absolute top-2.5 z-10 inline-flex items-center gap-2 rounded-lg bg-[#1C1917]/90 border border-white/15 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#E5B742] border-t-transparent animate-spin" />
                <span>{t.textbooks.loadingPageMsg}</span>
              </div>
            )}
            <div className="rounded-lg shadow-2xl overflow-hidden bg-white">
              <canvas ref={canvasRef} className="block max-w-none" />
            </div>
          </div>
        )}
      </div>

      {/* Pinned Bottom Page & Zoom Navigation Bar */}
      <footer className="border-t border-white/10 bg-[#1C1917] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 flex items-center justify-between gap-2 text-white shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40 cursor-pointer min-h-[40px] whitespace-nowrap"
          >
            {dir === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span>{t.textbooks.prevPageBtn}</span>
          </button>

          <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageJumpSubmit}
              aria-label={t.textbooks.pageLabel}
              className="w-14 sm:w-16 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center text-xs font-bold text-white tabular-nums focus:outline-none focus:border-[#E5B742] min-h-[38px]"
            />
            <span className="text-xs text-white/75 tabular-nums whitespace-nowrap">
              / {numPages}
            </span>
          </form>

          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={() => goToPage(currentPage + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40 cursor-pointer min-h-[40px] whitespace-nowrap"
          >
            <span>{t.textbooks.nextPageBtn}</span>
            {dir === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Unified Zoom Controls (always visible on mobile & desktop without scrolling) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(0.7, Number((z - 0.2).toFixed(2))))}
            aria-label="Zoom out"
            className="p-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-white min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomScale(1)}
            title={t.textbooks.fitWidthBtn}
            aria-label={t.textbooks.fitWidthBtn}
            className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-xs font-semibold text-white tabular-nums min-h-[40px] flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {zoomScale !== 1 ? (
              <RotateCcw className="w-3.5 h-3.5 text-[#E5B742]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-[#E5B742]" />
            )}
            <span>{Math.round(zoomScale * 100)}%</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))}
            aria-label="Zoom in"
            className="p-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-white min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};

