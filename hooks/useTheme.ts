'use client';

import { useTheme as useNextTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

// Subscribe function for useSyncExternalStore (no-op since we just need mount detection)
const emptySubscribe = () => () => {};

/**
 * Hook to access theme from next-themes
 * 
 * Uses useSyncExternalStore to safely detect client-side mounting
 * and avoid hydration mismatches.
 * 
 * @returns Theme object with current theme, setTheme, and toggle function
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, toggleTheme } = useTheme();
 *   
 *   return (
 *     <button onClick={toggleTheme}>
 *       Current theme: {theme}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme() {
  const { theme, setTheme, systemTheme, resolvedTheme } = useNextTheme();
  
  // Use useSyncExternalStore to safely detect if we're on the client
  // This avoids hydration mismatch by returning false on server, true on client
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client value
    () => false  // Server value
  );

  // Get the actual theme (resolve 'system' to actual theme)
  const currentTheme = resolvedTheme || (theme === 'system' ? systemTheme : theme);

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return {
    theme: (mounted ? currentTheme : 'light') as 'light' | 'dark',
    setTheme,
    toggleTheme,
    mounted,
  };
}
