import Image from "next/image";
import type { PersonSummary } from "@/server/types";

const sizes = { xs: 24, sm: 32, md: 40, lg: 56, xl: 96 } as const;

export function Avatar({ person, size = "md", ring = false }: { person: Pick<PersonSummary, "name" | "photoUrl">; size?: keyof typeof sizes; ring?: boolean }) {
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
