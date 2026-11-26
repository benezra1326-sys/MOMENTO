import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { reportSchema } from "@/lib/validation";

type Db = PrismaClient | Prisma.TransactionClient;

/** Vrai si l'une des deux personnes a bloqué l'autre. */
export async function isBlockedBetween(a: string, b: string, db: Db = prisma): Promise<boolean> {
  if (a === b) return false;
  const n = await db.block.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return n > 0;
}

/** Identifiants des personnes avec qui le viewer a un blocage (dans un sens ou l'autre). */
export async function blockedUserIds(viewerId: string | null, db: Db = prisma): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId));
}

/**
 * Bloquer : la personne bloquée ne peut plus inviter, demander à rejoindre ni voir
 * les Moments de l'autre. Les demandes/invitations en attente entre les deux sont annulées.
 */
export async function blockUser(viewerIn: Viewer | null, username: string) {
  const viewer = requireActive(viewerIn);
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target || target.status === "DELETED") throw new AppError("NOT_FOUND", "Profil introuvable.");
  if (target.id === viewer.id) throw new AppError("VALIDATION", "Tu ne peux pas te bloquer toi-même.");
  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: target.id } },
      create: { blockerId: viewer.id, blockedId: target.id },
      update: {},
    });
    await tx.momentMembership.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { userId: target.id, moment: { hostId: viewer.id } },
          { userId: viewer.id, moment: { hostId: target.id } },
        ],
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
  });
  return { blocked: true };
}

export async function unblockUser(viewerIn: Viewer | null, username: string) {
  const viewer = requireActive(viewerIn);
  const target = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target) throw new AppError("NOT_FOUND", "Profil introuvable.");
  await prisma.block.deleteMany({ where: { blockerId: viewer.id, blockedId: target.id } });
  return { blocked: false };
}

export async function listMyBlocks(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  const rows = await prisma.block.findMany({
    where: { blockerId: viewer.id },
    include: { blocked: { select: { username: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ username: r.blocked.username, name: r.blocked.name, since: r.createdAt.toISOString() }));
}

export async function createReport(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = reportSchema.parse(raw);
  const recent = await prisma.report.count({
    where: { reporterId: viewer.id, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= productConfig.limits.reportsPerHour) {
    throw new AppError("RATE_LIMITED", "Trop de signalements en peu de temps. Réessaie plus tard.");
  }
  let targetUserId: string | null = null;
  if (input.targetUsername) {
    const t = await prisma.user.findUnique({ where: { username: input.targetUsername } });
    if (!t) throw new AppError("NOT_FOUND", "Profil introuvable.");
    targetUserId = t.id;
  }
  if (input.momentId) {
    const m = await prisma.moment.findUnique({ where: { id: input.momentId }, select: { id: true } });
    if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
  }
  const report = await prisma.report.create({
    data: {
      reporterId: viewer.id,
      targetUserId,
      momentId: input.momentId ?? null,
      reason: input.reason,
      details: input.details,
    },
  });
  return { id: report.id };
}

// ——— Administration (rôle ADMIN uniquement) ———

function requireAdmin(viewerIn: Viewer | null): Viewer {
  const viewer = requireActive(viewerIn);
  if (viewer.role !== "ADMIN") throw new AppError("FORBIDDEN", "Accès réservé à la modération.");
  return viewer;
}

export async function listReports(viewerIn: Viewer | null, status: "OPEN" | "RESOLVED" | "DISMISSED" = "OPEN") {
  requireAdmin(viewerIn);
  const reports = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      reporter: { select: { username: true, name: true } },
      moment: { select: { id: true, title: true, status: true, hostId: true } },
    },
  });
  const targetIds = reports.map((r) => r.targetUserId).filter(Boolean) as string[];
  const targets = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, username: true, name: true, status: true },
  });
  const byId = new Map(targets.map((t) => [t.id, t]));
  return reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reporter: r.reporter,
    target: r.targetUserId ? byId.get(r.targetUserId) ?? null : null,
    moment: r.moment,
  }));
}

export async function resolveReport(
  viewerIn: Viewer | null,
  reportId: string,
  action: "dismiss" | "suspend_user" | "cancel_moment" | "resolve",
  note = "",
) {
  const admin = requireAdmin(viewerIn);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new AppError("NOT_FOUND", "Signalement introuvable.");
  await prisma.$transaction(async (tx) => {
    if (action === "suspend_user") {
      if (!report.targetUserId) throw new AppError("VALIDATION", "Ce signalement ne vise pas un profil.");
      await tx.user.update({ where: { id: report.targetUserId }, data: { status: "SUSPENDED" } });
      await tx.session.deleteMany({ where: { userId: report.targetUserId } });
      await tx.auditEvent.create({
        data: { actorId: admin.id, action: "user.suspend", targetType: "User", targetId: report.targetUserId, note },
      });
    }
    if (action === "cancel_moment") {
      if (!report.momentId) throw new AppError("VALIDATION", "Ce signalement ne vise pas un Moment.");
      await tx.moment.update({
        where: { id: report.momentId },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Retiré par la modération." },
      });
      await tx.auditEvent.create({
        data: { actorId: admin.id, action: "moment.remove", targetType: "Moment", targetId: report.momentId, note },
      });
    }
    await tx.report.update({
      where: { id: reportId },
      data: {
        status: action === "dismiss" ? "DISMISSED" : "RESOLVED",
        resolvedById: admin.id,
        resolution: `${action}${note ? `: ${note}` : ""}`,
        resolvedAt: new Date(),
      },
    });
  });
  return { ok: true };
}
