import type { MomentCardDTO } from "@/server/types";

export function spotsLabel(m: Pick<MomentCardDTO, "spotsLeft" | "capacity" | "phase">) {
  if (m.phase === "cancelled") return "Annulé";
  if (m.phase === "ended") return "Terminé";
  if (m.spotsLeft === 0) return "Complet";
  if (m.spotsLeft === 1) return "Dernière place";
  return `${m.spotsLeft} places sur ${m.capacity}`;
}

export function statusTone(m: Pick<MomentCardDTO, "spotsLeft" | "phase">): "neutral" | "full" | "off" | "hot" {
  if (m.phase === "cancelled" || m.phase === "ended") return "off";
  if (m.spotsLeft === 0) return "full";
  if (m.spotsLeft <= 2) return "hot";
  return "neutral";
}

export function membershipLabel(ms: MomentCardDTO["viewerMembership"]): string | null {
  if (!ms) return null;
  if (ms.status === "ACCEPTED") return "Place confirmée";
  if (ms.status === "PENDING") return ms.kind === "INVITE" ? "Invitation reçue" : "Demande envoyée";
  if (ms.status === "DECLINED") return ms.kind === "INVITE" ? "Invitation déclinée" : "Demande non retenue";
  return null;
}
