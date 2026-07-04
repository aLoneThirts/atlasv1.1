import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import type { SurfaceMode } from '@/constants/atlas-theme';

const STORAGE_KEY = 'atlas-surface-mode';

type ThemeState = { mode: SurfaceMode; toggle: () => void };

const ThemeModeContext = createContext<ThemeState>({ mode: 'light', toggle: () => {} });

async function readStored(): Promise<SurfaceMode | null> {
  try {
    const raw = Platform.OS === 'web' ? window.localStorage?.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);
    return raw === 'dark' || raw === 'light' ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(mode: SurfaceMode) {
  try {
    if (Platform.OS === 'web') window.localStorage?.setItem(STORAGE_KEY, mode);
    else AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  } catch {
    /* depolama yoksa sessizce yut — tema yalnızca oturum boyunca kalır */
  }
}

/** Uygulama genelinde açık/koyu yüzey tercihi — cihaz/tarayıcı depolamasında kalıcı. */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SurfaceMode>('light');

  useEffect(() => {
    readStored().then((saved) => {
      if (saved) setMode(saved);
    });
  }, []);

  const toggle = () => {
    setMode((prev) => {
      const next: SurfaceMode = prev === 'light' ? 'dark' : 'light';
      writeStored(next);
      return next;
    });
  };

  return <ThemeModeContext.Provider value={{ mode, toggle }}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
