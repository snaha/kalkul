import storageKeys from '$lib/storage-keys'

export type Theme = 'light' | 'dark' | 'system'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

function withThemeStore() {
  let theme = $state<Theme>('system')

  function apply(t: Theme) {
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia(DARK_QUERY).matches)
    document.documentElement.classList.toggle('dark', isDark)
  }

  return {
    get theme() {
      return theme
    },
    set(t: Theme) {
      theme = t
      localStorage.setItem(storageKeys.THEME, t)
      apply(t)
    },
    /**
     * Read the stored choice, apply it, and follow OS changes while on
     * 'system'. Returns a cleanup for the media-query listener.
     */
    init(): () => void {
      const stored = localStorage.getItem(storageKeys.THEME)
      theme = isTheme(stored) ? stored : 'system'
      apply(theme)

      const mql = window.matchMedia(DARK_QUERY)
      const onChange = () => {
        if (theme === 'system') apply('system')
      }
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
  }
}

export const themeStore = withThemeStore()
