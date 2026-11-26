import type { MomentMembership, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { invitationSchema, joinRequestSchema } from "@/lib/validation";
import { isBlockedBetween } from "./safety";
import { notify } from "./notifications";
import { momentPhase, personSelect, toPerson } from "./mappers";
import { toCards } from "./moments";

type Tx = Prisma.TransactionClient;

/**
 * Verrouille la ligne du Moment (SELECT … FOR UPDATE) pour sérialiser toutes les
 * opérations qui consomment une place : deux acceptations simultanées ne peuvent
 * jamais dépasser la capacité.
 */
async function lockMoment(tx: Tx, momentId: string) {
  await tx.$queryRaw`SELECT id FROM "Moment" WHERE id = ${momentId} FOR UPDATE`;
  const m = await tx.moment.findUnique({ where: { id: momentId } });
  if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
  return m;
}

async function assertSeatAvailable(tx: Tx, momentId: string, capacity: number) {
  const accepted = await tx.momentMembership.count({ where: { momentId, status: "ACCEPTED" } });
  if (accepted >= capacity) throw new AppError("MOMENT_FULL", "Ce Moment est complet.");
}

function assertOpen(m: { status: string; startsAt: Date; endsAt: Date | null }) {
  const phase = momentPhase(m as never);
  if (phase === "cancelled") throw new AppError("MOMENT_NOT_OPEN", "Ce Moment a été annulé.");
  if (phase === "draft") throw new AppError("MOMENT_NOT_OPEN", "Ce Moment n'est pas encore publié.");
  if (phase === "ended") throw new AppError("MOMENT_NOT_OPEN", "Ce Moment est terminé.");
}

async function assertRate(initiatorId: string, kind: "REQUEST" | "INVITE") {
  const limit = kind === "INVITE" ? productConfig.limits.invitesPerHour : productConfig.limits.requestsPerHour;
  const n = await prisma.momentMembership.count({
    where: { initiatorId, kind, updatedAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (n >= limit) {
    throw new AppError(
      "RATE_LIMITED",
      kind === "INVITE" ? "Trop d'invitations envoyées en une heure. Réessaie plus tard." : "Trop de demandes en une heure. Réessaie plus tard.",
    );
  }
}

/**
 * Demander à rejoindre.
 * - « Ouvert » : place confirmée immédiatement s'il en reste.
 * - « Sur demande » / « Privé » : demande en attente, l'hôte décide.
 * - « Sur invitation » : impossible sans invitation (répondre à l'invitation à la place).
 * Après un refus de l'hôte, pas de nouvelle demande : un refus ne génère aucune relance.
 */
export async function requestToJoin(viewerIn: Viewer | null, momentId: string, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = joinRequestSchema.parse(raw ?? {});
  await assertRate(viewer.id, "REQUEST");

  const result = await prisma.$transaction(async (tx) => {
    const m = await lockMoment(tx, momentId);
    if (m.hostId === viewer.id) throw new AppError("CONFLICT", "Tu es l'hôte de ce Moment.");
    assertOpen(m);
    if (await isBlockedBetween(viewer.id, m.hostId, tx)) throw new AppError("NOT_FOUND", "Moment introuvable.");

    const existing = await tx.momentMembership.findUnique({ where: { momentId_userId: { momentId, userId: viewer.id } } });
    if (existing) {
      if (existing.status === "ACCEPTED") throw new AppError("CONFLICT", "Ta place est déjà confirmée.");
      if (existing.status === "PENDING") {
        throw new AppError(
          "CONFLICT",
          existing.kind === "INVITE" ? "Tu as déjà une invitation : réponds-y depuis tes invitations." : "Ta demande est déjà envoyée.",
        );
      }
      if (existing.status === "DECLINED" && existing.kind === "REQUEST") {
        throw new AppError("CONFLICT", "L'hôte a déjà répondu à ta demande pour ce Moment.");
      }
    }
    if (m.visibility === "INVITE_ONLY") throw new AppError("FORBIDDEN", "Ce Moment est sur invitation uniquement.");

    await assertSeatAvailable(tx, momentId, m.capacity);
    const instant = m.visibility === "PUBLIC";
    const data = {
      kind: "REQUEST" as const,
      initiatorId: viewer.id,
      status: instant ? ("ACCEPTED" as const) : ("PENDING" as const),
      message: input.message || null,
      showOnMoment: input.showOnMoment,
      respondedAt: instant ? new Date() : null,
    };
    const membership = existing
      ? await tx.momentMembership.update({ where: { id: existing.id }, data })
      : await tx.momentMembership.create({ data: { ...data, momentId, userId: viewer.id } });

    await notify(tx, {
      userId: m.hostId,
      type: "JOIN_REQUEST",
      momentId,
      actorId: viewer.id,
      body: instant
        ? `${viewer.name} a rejoint « ${m.title} ».`
        : `${viewer.name} demande à rejoindre « ${m.title} ».`,
    });
    return membership;
  });
  return { id: result.id, status: result.status };
}

/** L'hôte invite une personne par son pseudo. */
export async function inviteUser(viewerIn: Viewer | null, momentId: string, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = invitationSchema.parse(raw ?? {});
  await assertRate(viewer.id, "INVITE");
  const target = await prisma.user.findUnique({ where: { username: input.username.replace(/^@/, "") } });
  if (!target || target.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Aucun profil actif avec ce pseudo.");
  if (target.id === viewer.id) throw new AppError("VALIDATION", "Tu ne peux pas t'inviter toi-même.");

  const result = await prisma.$transaction(async (tx) => {
    const m = await lockMoment(tx, momentId);
    if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Seul l'hôte peut inviter.");
    assertOpen(m);
    if (await isBlockedBetween(viewer.id, target.id, tx)) {
      throw new AppError("BLOCKED", "Impossible d'inviter cette personne.");
    }
    const existing = await tx.momentMembership.findUnique({ where: { momentId_userId: { momentId, userId: target.id } } });
    if (existing) {
      if (existing.status === "ACCEPTED") throw new AppError("CONFLICT", "Cette personne participe déjà.");
      if (existing.status === "PENDING") {
        throw new AppError(
          "CONFLICT",
          existing.kind === "REQUEST" ? "Cette personne a déjà demandé à venir : accepte sa demande." : "Invitation déjà envoyée.",
        );
      }
      if (existing.status === "DECLINED" && existing.kind === "INVITE") {
        throw new AppError("CONFLICT", "Cette personne a déjà décliné une invitation pour ce Moment.");
      }
    }
    await assertSeatAvailable(tx, momentId, m.capacity);
    const data = {
      kind: "INVITE" as const,
      initiatorId: viewer.id,
      status: "PENDING" as const,
      message: input.message || null,
      respondedAt: null,
    };
    const membership = existing
      ? await tx.momentMembership.update({ where: { id: existing.id }, data })
      : await tx.momentMembership.create({ data: { ...data, momentId, userId: target.id } });
    await notify(tx, {
      userId: target.id,
      type: "INVITATION",
      momentId,
      actorId: viewer.id,
      body: `${viewer.name} t'invite à « ${m.title} ».`,
    });
    return membership;
  });
  return { id: result.id, status: result.status, user: toPerson(target) };
}

/**
 * Répondre à une demande (hôte) ou à une invitation (invité).
 * L'acceptation réserve la place de façon transactionnelle.
 */
export async function respondToMembership(viewerIn: Viewer | null, membershipId: string, decision: "accept" | "decline") {
  const viewer = requireActive(viewerIn);
  const pre = await prisma.momentMembership.findUnique({ where: { id: membershipId } });
  if (!pre) throw new AppError("NOT_FOUND", "Demande introuvable.");

  return prisma.$transaction(async (tx) => {
    const m = await lockMoment(tx, pre.momentId);
    const ms = await tx.momentMembership.findUnique({ where: { id: membershipId } });
    if (!ms) throw new AppError("NOT_FOUND", "Demande introuvable.");

    const actorIsHost = m.hostId === viewer.id;
    const allowed = ms.kind === "REQUEST" ? actorIsHost : ms.userId === viewer.id;
    if (!allowed) {
      throw new AppError(
        "FORBIDDEN",
        ms.kind === "REQUEST" ? "Seul l'hôte peut répondre à une demande." : "Seule la personne invitée peut répondre.",
      );
    }
    if (ms.status !== "PENDING") throw new AppError("CONFLICT", "Cette demande a déjà reçu une réponse ou a été retirée.");

    if (decision === "accept") {
      assertOpen(m);
      await assertSeatAvailable(tx, m.id, m.capacity);
    }
    const updated = await tx.momentMembership.update({
      where: { id: ms.id },
      data: { status: decision === "accept" ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
    });

    if (ms.kind === "REQUEST") {
      await notify(tx, {
        userId: ms.userId,
        type: decision === "accept" ? "REQUEST_ACCEPTED" : "REQUEST_DECLINED",
        momentId: m.id,
        actorId: viewer.id,
        body:
          decision === "accept"
            ? `Ta place pour « ${m.title} » est confirmée.`
            : `L'hôte n'a pas pu accepter ta demande pour « ${m.title} ».`,
      });
    } else {
      await notify(tx, {
        userId: m.hostId,
        type: decision === "accept" ? "INVITATION_ACCEPTED" : "INVITATION_DECLINED",
        momentId: m.id,
        actorId: viewer.id,
        body:
          decision === "accept"
            ? `${viewer.name} a accepté ton invitation à « ${m.title} ».`
            : `${viewer.name} a décliné ton invitation à « ${m.title} ».`,
      });
    }
    return { id: updated.id, status: updated.status };
  });
}

/**
 * Retirer : le participant retire sa demande ou quitte le Moment ;
 * l'hôte retire une invitation en attente.
 */
export async function cancelMembership(viewerIn: Viewer | null, membershipId: string) {
  const viewer = requireActive(viewerIn);
  const ms = await prisma.momentMembership.findUnique({ where: { id: membershipId }, include: { moment: true } });
  if (!ms) throw new AppError("NOT_FOUND", "Demande introuvable.");
  const isUser = ms.userId === viewer.id;
  const isHost = ms.moment.hostId === viewer.id;

  if (isUser) {
    if (ms.status !== "PENDING" && ms.status !== "ACCEPTED") throw new AppError("CONFLICT", "Rien à retirer.");
    if (ms.status === "PENDING" && ms.kind === "INVITE") {
      // Une invitation se décline, elle ne se « retire » pas côté invité.
      return respondToMembership(viewer, membershipId, "decline");
    }
    const wasAccepted = ms.status === "ACCEPTED";
    await prisma.$transaction(async (tx) => {
      await tx.momentMembership.update({ where: { id: ms.id }, data: { status: "CANCELLED", respondedAt: new Date() } });
      if (wasAccepted) {
        await notify(tx, {
          userId: ms.moment.hostId,
          type: "MEMBER_LEFT",
          momentId: ms.momentId,
          actorId: viewer.id,
          body: `${viewer.name} ne pourra plus venir à « ${ms.moment.title} ». Une place s'est libérée.`,
        });
      }
    });
    return { id: ms.id, status: "CANCELLED" as const };
  }

  if (isHost) {
    if (!(ms.kind === "INVITE" && ms.status === "PENDING")) {
      throw new AppError("FORBIDDEN", "L'hôte peut seulement retirer une invitation en attente.");
    }
    await prisma.momentMembership.update({ where: { id: ms.id }, data: { status: "CANCELLED", respondedAt: new Date() } });
    return { id: ms.id, status: "CANCELLED" as const };
  }
  throw new AppError("FORBIDDEN", "Action non autorisée.");
}

// ——— Écran « Invitations » ———

function row(ms: MomentMembership & { user: Parameters<typeof toPerson>[0] }) {
  return {
    id: ms.id,
    kind: ms.kind,
    status: ms.status,
    message: ms.message,
    createdAt: ms.createdAt.toISOString(),
    respondedAt: ms.respondedAt?.toISOString() ?? null,
    user: toPerson(ms.user),
  };
}

const momentWithCard = {
  host: { select: personSelect },
  memberships: {
    where: { status: "ACCEPTED" as const },
    take: 8,
    select: { status: true, showOnMoment: true, user: { select: personSelect } },
  },
} satisfies Prisma.MomentInclude;

export async function myInvitations(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);

  // Ce qui me concerne en tant que participant
  const mine = await prisma.momentMembership.findMany({
    where: { userId: viewer.id },
    include: { user: { select: personSelect }, moment: { include: momentWithCard } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const cards = await toCards(mine.map((x) => x.moment), viewer.id);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const asGuest = mine.map((x) => ({ ...row(x), moment: cardById.get(x.momentId)! }));

  // Ce qui arrive sur mes Moments en tant qu'hôte
  const hosting = await prisma.momentMembership.findMany({
    where: { moment: { hostId: viewer.id } },
    include: { user: { select: personSelect }, moment: { include: momentWithCard } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const hostCards = await toCards(
    [...new Map(hosting.map((x) => [x.momentId, x.moment])).values()],
    viewer.id,
  );
  const hostCardById = new Map(hostCards.map((c) => [c.id, c]));
  const asHost = hosting.map((x) => ({ ...row(x), moment: hostCardById.get(x.momentId)! }));

  return {
    invitationsReceived: asGuest.filter((x) => x.kind === "INVITE"),
    requestsSent: asGuest.filter((x) => x.kind === "REQUEST"),
    requestsToReview: asHost.filter((x) => x.kind === "REQUEST" && x.status === "PENDING"),
    hostActivity: asHost.filter((x) => !(x.kind === "REQUEST" && x.status === "PENDING")),
    upcoming: asGuest.filter((x) => x.status === "ACCEPTED" && (x.moment.phase === "upcoming" || x.moment.phase === "ongoing")),
  };
}
