import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { utcToZonedLocal } from "@/lib/time";
import { MomentForm } from "@/components/MomentForm";
import { PageTitle } from "@/components/States";

export const metadata = { title: "Créer un Moment" };
export const dynamic = "force-dynamic";

export default async function NewMomentPage() {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/moments/nouveau");
  const tz = productConfig.defaultTimezone;
  const tomorrow = utcToZonedLocal(new Date(Date.now() + 86400_000), tz).slice(0, 10);
  return (
    <>
      <PageTitle eyebrow="Nouveau" title="Crée ton Moment" />
      <MomentForm
        mode="create"
        host={{ id: viewer.id, name: viewer.name, username: viewer.username, photoUrl: viewer.photoUrl, isDemo: viewer.isDemo }}
        initial={{
          title: "",
          description: "",
          category: "drinks",
          vibeTags: [],
          mediaType: "TEXT",
          mediaUrl: null,
          posterUrl: null,
          textTheme: "dusk",
          city: viewer.city || productConfig.pilotCity,
          area: "",
          placeName: "",
          address: "",
          addressMembersOnly: true,
          startsAtLocal: `${tomorrow}T19:00`,
          endsAtLocal: "",
          timezone: tz,
          capacity: 6,
          visibility: "REQUEST",
          showAttendees: true,
        }}
      />
    </>
  );
}
