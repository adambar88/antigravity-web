import { useEffect, useState } from 'react';

export type Theme = 'warm-light' | 'dark';

const STORAGE_KEY = 'antigravity_theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'warm-light') {
      return saved;
    }
    // Default to warm-light as specified in requirements
    return 'warm-light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update meta theme-color for mobile address bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'warm-light' ? '#f0e9df' : '#0d1117');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'warm-light' ? 'dark' : 'warm-light'));
  };

  return { theme, setTheme, toggleTheme };
}
