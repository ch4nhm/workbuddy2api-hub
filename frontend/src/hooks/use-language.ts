import { useEffect, useState } from "react";
import { i18n, type Language } from "@/lib/i18n";

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(i18n.language);

  useEffect(
    () =>
      i18n.subscribe(() => {
        setLanguage(i18n.language);
      }),
    [],
  );

  return {
    language,
    setLanguage: (next: Language) => i18n.set(next),
  };
}
