import type { MomentCardDTO } from "@/server/types";
import type { T } from "@/lib/i18n/core";

export function spotsLabel(m: Pick<MomentCardDTO, "spotsLeft" | "capacity" | "phase">, t: T) {
  if (m.phase === "cancelled") return t("Annulé");
  if (m.phase === "ended") return t("Terminé");
  if (m.spotsLeft === 0) return t("Complet");
  if (m.spotsLeft === 1) return t("Dernière place");
  return t("{n} places sur {total}", { n: m.spotsLeft, total: m.capacity });
}

export function statusTone(m: Pick<MomentCardDTO, "spotsLeft" | "phase">): "neutral" | "full" | "off" | "hot" {
  if (m.phase === "cancelled" || m.phase === "ended") return "off";
  if (m.spotsLeft === 0) return "full";
  if (m.spotsLeft <= 2) return "hot";
  return "neutral";
}

export function membershipLabel(ms: MomentCardDTO["viewerMembership"], t: T): string | null {
  if (!ms) return null;
  if (ms.status === "ACCEPTED") return t("Place confirmée");
  if (ms.status === "PENDING") return ms.kind === "INVITE" ? t("Invitation reçue") : t("Demande envoyée");
  if (ms.status === "DECLINED") return ms.kind === "INVITE" ? t("Invitation déclinée") : t("Demande non retenue");
  return null;
}

/** Ce que la personne peut faire, en deux mots (affiché sur la carte). */
export function accessLabel(visibility: MomentCardDTO["visibility"], t: T): string {
  if (visibility === "PUBLIC") return t("Accès direct");
  if (visibility === "INVITE_ONLY") return t("Sur invitation");
  return t("Sur demande");
}
