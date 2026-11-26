"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Locale, type T } from "@/lib/i18n/core";

const Ctx = createContext<{ locale: Locale; t: T }>({ locale: "fr", t: makeT("fr") });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  return useContext(Ctx).t;
}

export function useLocale() {
  return useContext(Ctx).locale;
}
