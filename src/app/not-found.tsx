import { EmptyState } from "@/components/States";

export default function NotFound() {
  return (
    <div className="mx-auto mt-6 max-w-lg">
      <EmptyState title="Page introuvable" text="Ce Moment ou ce profil n'existe pas, ou n'est plus disponible." action={{ href: "/", label: "Retour au feed" }} />
    </div>
  );
}
