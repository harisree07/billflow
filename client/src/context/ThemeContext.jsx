import { createContext, useContext, useEffect, useState } from 'react';

const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('bf_dark') === '1');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('bf_dark', dark ? '1' : '0');
  }, [dark]);
  return <Ctx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>{children}</Ctx.Provider>;
}
