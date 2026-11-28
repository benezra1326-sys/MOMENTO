import { cookies } from "next/headers";
import { tierOf } from "@/lib/premium";

/** Thème « Black » : choix du membre Upclose Black (cookie), appliqué seulement tant que l'offre est active. */
export const THEME_COOKIE = "upclose_theme";

export async function blackThemeOn(viewer: Parameters<typeof tierOf>[0]): Promise<boolean> {
  if (tierOf(viewer) !== "black") return false;
  return (await cookies()).get(THEME_COOKIE)?.value === "black";
}
