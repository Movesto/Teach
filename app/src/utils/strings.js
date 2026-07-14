// Bilingual (English / Somali) strings for core UI chrome. Beginner students
// may read only Somali — every message a learner can hit should carry both.
export const STRINGS = {
  offline: { en: 'No internet connection', so: 'Internet ma jiro — hubi xiriirkaaga' },
  loadFailed: { en: 'Could not load this page', so: 'Boggan lama soo rari karin' },
  checkConnection: { en: 'Check your connection and try again.', so: 'Hubi xiriirkaaga oo isku day mar kale.' },
  retry: { en: 'Retry', so: 'Isku day mar kale' },
  sessionExpired: { en: 'Your session has expired. Please log in again.', so: 'Fadhigaagu wuu dhacay. Fadlan mar kale soo gal.' },
  logIn: { en: 'Log in', so: 'Soo gal' },
  somethingWrong: { en: 'Something went wrong', so: 'Khalad ayaa dhacay' },
  reloadPage: { en: 'Reload page', so: 'Dib u rar bogga' },
  question: { en: 'Question', so: "Su'aal" },
  of: { en: 'of', so: 'ee' },
  searchLessons: { en: 'Search lessons...', so: 'Raadi casharrada...' },
  retakeConfirm: {
    en: 'Retake the placement test? Your level may change based on the new result.',
    so: 'Ma dooneysaa inaad dib u qaadato imtixaanka heerka? Heerkaagu wuu isbeddeli karaa.',
  },
  saving: { en: 'Saving...', so: 'Waa la kaydinayaa...' },
};

// "English / Somali" on one line — matches the app's existing inline style.
export function bi(key) {
  const s = STRINGS[key];
  return s ? `${s.en} / ${s.so}` : key;
}
