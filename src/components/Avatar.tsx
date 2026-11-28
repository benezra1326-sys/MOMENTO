import Image from "next/image";
import type { PersonSummary } from "@/server/types";

const sizes = { xs: 24, sm: 32, md: 40, lg: 56, xl: 96 } as const;

/**
 * Badge « photo certifiée » : le symbole Upclose posé en bas à droite de l'avatar.
 * La photo a été comparée à un selfie pris en direct avec la caméra.
 */
export function VerifiedMark({ px, title = "Photo certifiée" }: { px: number; title?: string }) {
  const d = Math.max(14, Math.round(px * 0.34));
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.35)] ring-2 ring-surface"
      style={{ width: d, height: d }}
      title={title}
      aria-label={title}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/upclose-symbol.svg" alt="" style={{ width: Math.round(d * 0.62), height: Math.round(d * 0.62) }} />
    </span>
  );
}

export function Avatar({ person, size = "md", ring = false }: { person: Pick<PersonSummary, "name" | "photoUrl"> & { verified?: boolean }; size?: keyof typeof sizes; ring?: boolean }) {
  const px = sizes[size];
  if (person.verified && person.photoUrl && size !== "xs") {
    return (
      <span className="relative inline-flex shrink-0" style={{ width: px, height: px }}>
        <AvatarCore person={person} size={size} ring={ring} />
        <VerifiedMark px={px} />
      </span>
    );
  }
  return <AvatarCore person={person} size={size} ring={ring} />;
}

function AvatarCore({ person, size = "md", ring = false }: { person: Pick<PersonSummary, "name" | "photoUrl">; size?: keyof typeof sizes; ring?: boolean }) {
  const px = sizes[size];
  const initials = person.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .replace(/[^\p{L}]/gu, "")
    .slice(0, 2)
    .toUpperCase();
  const cls = `relative inline-flex shrink-0 overflow-hidden rounded-full bg-lilac/10 ${ring ? "ring-2 ring-surface" : ""}`;
  if (person.photoUrl) {
    return (
      <span className={cls} style={{ width: px, height: px }}>
        <Image src={person.photoUrl} alt="" width={px} height={px} className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={`${cls} items-center justify-center font-semibold text-accent`}
      style={{ width: px, height: px, fontSize: Math.max(10, px * 0.38) }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: PersonSummary[]; max?: number; size?: keyof typeof sizes }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  return (
    <span className="flex -space-x-2" aria-label={`${people.length} participant${people.length > 1 ? "s" : ""} visible${people.length > 1 ? "s" : ""}`}>
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} ring />
      ))}
    </span>
  );
}
