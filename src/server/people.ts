import { prisma } from "@/lib/db";
import { requireActive, type Viewer } from "@/lib/auth";
import { blockedUserIds } from "./safety";

/** Recherche de membres par pseudo ou nom (pour inviter quelqu'un). Exclut soi-même et les blocages. */
export async function searchPeople(viewerIn: Viewer | null, raw: string | null) {
  const viewer = requireActive(viewerIn);
  const q = (raw ?? "").trim().replace(/^@/, "").slice(0, 40);
  if (q.length < 1) return [];
  // Requêtes séquentielles : la base de production n'accepte qu'une connexion par fonction.
  const blocked = await blockedUserIds(viewer.id);
  const rows = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: "USER",
      id: { notIn: [viewer.id, ...blocked] },
      OR: [
        { username: { startsWith: q.toLowerCase() } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { username: true, name: true, photoUrl: true, city: true },
    orderBy: { username: "asc" },
    take: 6,
  });
  return rows;
}
