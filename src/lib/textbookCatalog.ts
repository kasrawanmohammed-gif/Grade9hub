export const OFFICIAL_BOOK_PDF_URL = '/assets/aistudio/Science_9_Book_2409ed82.pdf';
export const OFFICIAL_BOOK_FILENAME = 'Science_9_Book.pdf';
export const OFFICIAL_BOOK_TOTAL_PAGES = 306;

export interface BookChapterBookmark {
  key: string;
  chapterNumber: number | null;
  page: number;
  kind: 'cover' | 'contents' | 'chapter';
}

export interface BookChapterMetadata {
  chapterNumber: number;
  startPage: number;
  endPage: number;
  titleEn: string;
  titleKu: string;
  titleAr: string;
}

export const OFFICIAL_BOOK_CHAPTERS: BookChapterMetadata[] = [
  {
    chapterNumber: 1,
    startPage: 6,
    endPage: 43,
    titleEn: 'Work and Machines',
    titleKu: 'ئیش و ئامێرەکان',
    titleAr: 'الشغل والآلات',
  },
  {
    chapterNumber: 2,
    startPage: 44,
    endPage: 76,
    titleEn: 'Energy',
    titleKu: 'وزە',
    titleAr: 'الطاقة',
  },
  {
    chapterNumber: 3,
    startPage: 77,
    endPage: 102,
    titleEn: 'Heat',
    titleKu: 'گەرمی',
    titleAr: 'الحرارة',
  },
  {
    chapterNumber: 4,
    startPage: 103,
    endPage: 132,
    titleEn: 'Light',
    titleKu: 'ڕووناکی',
    titleAr: 'الضوء',
  },
  {
    chapterNumber: 5,
    startPage: 133,
    endPage: 159,
    titleEn: 'Astronomy',
    titleKu: 'ئەستێرەناسی',
    titleAr: 'علم الفلك',
  },
  {
    chapterNumber: 6,
    startPage: 160,
    endPage: 190,
    titleEn: 'Mendel and the Principles of Genetics',
    titleKu: 'مەندڵ و بنەماکانی بۆماوەزانی',
    titleAr: 'مندل ومبادئ علم الوراثة',
  },
  {
    chapterNumber: 7,
    startPage: 191,
    endPage: 217,
    titleEn: 'Body Organization and Structure',
    titleKu: 'ڕێکخستن و پێکهاتەی لەش',
    titleAr: 'تنظيم الجسم وبنيته',
  },
  {
    chapterNumber: 8,
    startPage: 218,
    endPage: 238,
    titleEn: 'The Urinary System and the Nervous Systems',
    titleKu: 'کۆئەندامی میز و کۆئەندامی دەمار',
    titleAr: 'الجهاز البولي والجهاز العصبي',
  },
  {
    chapterNumber: 9,
    startPage: 239,
    endPage: 255,
    titleEn: 'Reproduction and Development',
    titleKu: 'زۆربوون و گەشەکردن',
    titleAr: 'التكاثر والنمو',
  },
  {
    chapterNumber: 10,
    startPage: 256,
    endPage: 284,
    titleEn: 'Acids and Bases',
    titleKu: 'ترش و تفتەکان',
    titleAr: 'الأحماض والقواعد',
  },
  {
    chapterNumber: 11,
    startPage: 285,
    endPage: 305,
    titleEn: 'Atomic Energy',
    titleKu: 'وزەی ئەتۆمی',
    titleAr: 'الطاقة الذرية',
  },
];

export const OFFICIAL_BOOK_CHAPTER_BOOKMARKS: BookChapterBookmark[] = [
  { key: 'cover', chapterNumber: null, page: 1, kind: 'cover' },
  { key: 'contents', chapterNumber: null, page: 2, kind: 'contents' },
  ...OFFICIAL_BOOK_CHAPTERS.map((ch) => ({
    key: `ch-${ch.chapterNumber}`,
    chapterNumber: ch.chapterNumber,
    page: ch.startPage,
    kind: 'chapter' as const,
  })),
];

export function getOfficialBookChapterMeta(
  chapterNumber: number | null | undefined
): BookChapterMetadata | null {
  if (typeof chapterNumber !== 'number') return null;
  return OFFICIAL_BOOK_CHAPTERS.find((item) => item.chapterNumber === chapterNumber) || null;
}

export function getOfficialBookChapterPage(chapterNumber: number | null | undefined): number {
  const match = getOfficialBookChapterMeta(chapterNumber);
  return match ? match.startPage : 1;
}

export function getOfficialBookChapterTitle(
  chapterNumber: number | null | undefined,
  lang: 'en' | 'ku' | 'ar' = 'en'
): string | null {
  const match = getOfficialBookChapterMeta(chapterNumber);
  if (!match) return null;
  if (lang === 'ku') return match.titleKu;
  if (lang === 'ar') return match.titleAr;
  return match.titleEn;
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
