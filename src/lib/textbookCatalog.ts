export const OFFICIAL_BOOK_PDF_URL = '/assets/aistudio/Science_9_Book_2409ed82.pdf';
export const OFFICIAL_BOOK_FILENAME = 'Science_9_Book.pdf';
export const OFFICIAL_BOOK_TOTAL_PAGES = 306;

export interface BookChapterBookmark {
  key: string;
  chapterNumber: number | null;
  page: number;
  kind: 'cover' | 'contents' | 'chapter';
}

export const OFFICIAL_BOOK_CHAPTER_BOOKMARKS: BookChapterBookmark[] = [
  { key: 'cover', chapterNumber: null, page: 1, kind: 'cover' },
  { key: 'contents', chapterNumber: null, page: 2, kind: 'contents' },
  { key: 'ch-1', chapterNumber: 1, page: 6, kind: 'chapter' },
  { key: 'ch-2', chapterNumber: 2, page: 44, kind: 'chapter' },
  { key: 'ch-3', chapterNumber: 3, page: 77, kind: 'chapter' },
  { key: 'ch-4', chapterNumber: 4, page: 103, kind: 'chapter' },
  { key: 'ch-5', chapterNumber: 5, page: 133, kind: 'chapter' },
  { key: 'ch-6', chapterNumber: 6, page: 160, kind: 'chapter' },
  { key: 'ch-7', chapterNumber: 7, page: 191, kind: 'chapter' },
  { key: 'ch-8', chapterNumber: 8, page: 218, kind: 'chapter' },
  { key: 'ch-9', chapterNumber: 9, page: 239, kind: 'chapter' },
  { key: 'ch-10', chapterNumber: 10, page: 256, kind: 'chapter' },
  { key: 'ch-11', chapterNumber: 11, page: 285, kind: 'chapter' },
];

export function getOfficialBookChapterPage(chapterNumber: number | null | undefined): number {
  if (typeof chapterNumber !== 'number') return 1;
  const match = OFFICIAL_BOOK_CHAPTER_BOOKMARKS.find(
    (item) => item.chapterNumber === chapterNumber
  );
  return match ? match.page : 1;
}

export function isPdfAttachment(mime?: string | null, url?: string | null): boolean {
  const mimeLower = (mime || '').toLowerCase();
  const urlLower = (url || '').toLowerCase();
  return mimeLower.includes('pdf') || urlLower.endsWith('.pdf');
}

export function getAttachmentPreviewUrl(url: string): string {
  return url;
}

export function getAttachmentDownloadHref(url: string, name?: string | null): string {
  if (url.startsWith('/uploads/')) {
    const filePart = url.split('/').pop() || 'attachment';
    const qs = name ? `?name=${encodeURIComponent(name)}` : '';
    return `/api/uploads/download/${filePart}${qs}`;
  }
  return url;
}
