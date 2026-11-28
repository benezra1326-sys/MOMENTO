import type { MediaType, MembershipKind, MembershipStatus, MomentStatus, MomentVisibility } from "@prisma/client";

export type PersonSummary = {
  id: string;
  name: string;
  username: string;
  photoUrl: string | null;
  isDemo: boolean;
};

/** Phase calculée côté serveur, pour des libellés cohérents partout. */
export type MomentPhase = "draft" | "cancelled" | "ended" | "ongoing" | "upcoming";

export type ViewerMembership = {
  id: string;
  kind: MembershipKind;
  status: MembershipStatus;
  initiatedByViewer: boolean;
} | null;

export type MomentCardDTO = {
  id: string;
  title: string;
  description: string;
  category: string;
  vibeTags: string[];
  mediaType: MediaType;
  mediaUrl: string | null;
  posterUrl: string | null;
  textTheme: string | null;
  city: string;
  area: string;
  placeName: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  capacity: number;
  acceptedCount: number;
  spotsLeft: number;
  status: MomentStatus;
  visibility: MomentVisibility;
  phase: MomentPhase;
  isAdult: boolean;
  isDemo: boolean;
  /** Publié il y a moins de 48 h. */
  isNew?: boolean;
  /** Note moyenne de l'hôte (null tant qu'il n'a pas assez d'avis). */
  hostRating?: { avg: number; count: number } | null;
  /** Pourquoi ce Moment est suggéré (radar personnalisé). */
  reasons?: string[];
  host: PersonSummary;
  /** Participants visibles : seulement si l'hôte et chaque participant l'acceptent. */
  attendeesPreview: PersonSummary[];
  viewerMembership: ViewerMembership;
  isHost: boolean;
};

export type MemberRow = {
  id: string;
  kind: MembershipKind;
  status: MembershipStatus;
  message: string | null;
  createdAt: string;
  user: PersonSummary;
  /** Membre Upclose+ (sa demande passe en premier). */
  premium?: boolean;
};

export type MomentDetailDTO = MomentCardDTO & {
  /** null si l'adresse est réservée aux participants et que le viewer n'y a pas accès. */
  address: string | null;
  addressHidden: boolean;
  addressMembersOnly: boolean;
  showAttendees: boolean;
  cancelReason: string | null;
  attendees: PersonSummary[];
  /** Liste complète des demandes et invitations : uniquement pour l'hôte. */
  members: MemberRow[] | null;
  pendingCount: number;
  /** Hôte uniquement : fin du boost Upclose+ en cours. */
  boostedUntil?: string | null;
};

export type FeedPage = { items: MomentCardDTO[]; nextCursor: string | null; source: "database" | "demo-fallback" };
