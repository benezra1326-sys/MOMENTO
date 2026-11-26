export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pill bg-warn-soft text-warn ${className}`}
      title="Profil ou Moment fictif, créé pour la démonstration"
    >
      Démo
    </span>
  );
}
