import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { availabilitySlots, categories, productConfig } from "@/config/product";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { MomentForm, type Invitee } from "@/components/MomentForm";
import { PageTitle } from "@/components/States";
import { getLocale, getT, pageTitle } from "@/lib/i18n/server";
import { getAvailability, type AvailabilityDTO } from "@/server/availability";
import { canSeeAdult } from "@/server/moments";
import { availabilityWhen } from "@/lib/availability-labels";

export const generateMetadata = pageTitle("Créer un Moment");
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Raccourcis de date dans le fuseau du lieu : ce soir, demain soir, samedi. */
function quickDates(tz: string, t: (s: string) => string) {
  const now = new Date();
  const ymd = (d: Date) => utcToZonedLocal(d, tz).slice(0, 10);
  const out: { label: string; value: string }[] = [];
  const tonight = `${ymd(now)}T20:00`;
  if (zonedLocalToUtc(tonight, tz) > new Date(now.getTime() + 3600_000)) out.push({ label: t("Ce soir 20 h"), value: tonight });
  out.push({ label: t("Demain 19 h"), value: `${ymd(new Date(now.getTime() + 86400_000))}T19:00` });
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const toSat = (6 - idx + 7) % 7 || 7;
  if (toSat > 1) out.push({ label: t("Samedi 18 h"), value: `${ymd(new Date(now.getTime() + toSat * 86400_000))}T18:00` });
  const toSun = (7 - idx) % 7 || 7;
  if (toSun > 1) out.push({ label: t("Dimanche 11 h"), value: `${ymd(new Date(now.getTime() + toSun * 86400_000))}T11:00` });
  return out;
}

export default async function NewMomentPage({ searchParams }: { searchParams: SP }) {
  const viewer = await getViewerSafe();
  const sp = await searchParams;
  const dispoId = typeof sp.dispo === "string" ? sp.dispo : null;
  if (!viewer) redirect(`/connexion?suite=${encodeURIComponent(dispoId ? `/moments/nouveau?dispo=${dispoId}` : "/moments/nouveau")}`);
  const t = await getT();
  const locale = await getLocale();

  let dispo: AvailabilityDTO | null = null;
  if (dispoId && productConfig.features.availability) {
    dispo = await getAvailability(viewer, dispoId).catch(() => null);
    if (dispo?.isMine) dispo = null;
  }
  const tz = dispo?.timezone ?? productConfig.defaultTimezone;
  const tomorrow = utcToZonedLocal(new Date(Date.now() + 86400_000), tz).slice(0, 10);
  const slot = dispo ? availabilitySlots.find((s) => s.id === dispo.slot) : null;
  const slotStart = slot?.id === "day" ? "18:00" : slot?.start;
  const invitee: Invitee | null = dispo ? { ...dispo.person, slotLabel: availabilityWhen(dispo, locale, t) } : null;
  // Pré-remplissage depuis l'assistant de création (/creer) : tout reste modifiable avant publication.
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const okCat = (c: string) => categories.some((x) => x.id === c) ? c : "";
  const pre = {
    title: str("titre").slice(0, 80),
    description: str("description").slice(0, 1000),
    category: okCat(str("cat")),
    city: str("ville"),
    area: str("quartier"),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str("date")) ? str("date") : "",
    time: /^\d{2}:\d{2}$/.test(str("heure")) ? str("heure") : "",
    capacity: Math.min(50, Math.max(2, Number(str("places")) || 0)) || 0,
    vibes: str("vibes").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5),
  };
  const category = dispo?.categories[0] ?? (pre.category || "drinks");
  const isAdultCat = category === "adult";

  return (
    <>
      <PageTitle eyebrow={t("Nouveau")} title={invitee ? t("Propose un Moment à {name}", { name: invitee.name.split(" ")[0] }) : t("Crée ton Moment")} />
      <MomentForm
        mode="create"
        host={{ id: viewer.id, name: viewer.name, username: viewer.username, photoUrl: viewer.photoUrl, isDemo: viewer.isDemo }}
        invitee={invitee}
        quickDates={dispo ? [] : quickDates(tz, t)}
        memberVideos={productConfig.features.memberVideos}
        showAdult={canSeeAdult(viewer)}
        initial={{
          title: pre.title,
          description: pre.description,
          category,
          vibeTags: pre.vibes,
          mediaType: "TEXT",
          mediaUrl: null,
          posterUrl: null,
          textTheme: "dusk",
          city: dispo?.city || pre.city || viewer.city || productConfig.pilotCity,
          area: dispo?.area ?? pre.area,
          placeName: "",
          address: "",
          addressMembersOnly: true,
          startsAtLocal: dispo && slotStart ? `${dispo.date}T${slotStart}` : `${pre.date || tomorrow}T${pre.time || "19:00"}`,
          endsAtLocal: "",
          timezone: tz,
          capacity: dispo ? 3 : pre.capacity || 6,
          visibility: dispo ? "INVITE_ONLY" : "REQUEST",
          showAttendees: !isAdultCat,
        }}
      />
    </>
  );
}
