import Link from "next/link";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Confidentialité");

/** Page publique exigée par Google et Facebook : politique de confidentialité et suppression des données. */
export default async function PrivacyPage() {
  const t = await getT();
  const sections: [string, string[]][] = [
    [
      "Ce que nous collectons",
      [
        "Les informations de ton compte : nom, pseudo, adresse e-mail, ville, centres d'intérêt, photo et texte de présentation que tu choisis d'ajouter.",
        "Si tu te connectes avec Google ou Facebook, nous recevons seulement ton nom, ton adresse e-mail et un identifiant propre à Upclose. Nous ne publions rien sur ces comptes.",
        "Les Moments que tu crées ou rejoins, tes demandes, invitations, messages de signalement et notifications.",
      ],
    ],
    [
      "Pourquoi",
      [
        "Pour faire fonctionner l'app : te connecter, afficher les Moments, mettre en relation hôtes et participants, assurer la sécurité et la modération.",
        "Tes données ne sont jamais vendues ni utilisées pour de la publicité.",
      ],
    ],
    [
      "Où elles sont stockées",
      ["Sur des serveurs situés dans l'Union européenne (Paris). Seuls les services nécessaires au fonctionnement de l'app y ont accès."],
    ],
    [
      "Supprimer tes données",
      [
        "Tu peux supprimer ton compte à tout moment : Profil → Réglages → « Supprimer mon compte ». Ton profil, tes Moments et tes participations sont alors effacés.",
        "Si tu t'es connecté avec Facebook, tu peux aussi retirer Upclose dans Facebook → Paramètres → Applications et sites web ; supprime ensuite ton compte Upclose comme indiqué ci-dessus.",
      ],
    ],
  ];
  return (
    <article className="card mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t("Confidentialité")}</h1>
      <p className="mt-1 text-muted">{t("Comment Upclose utilise tes données, et comment les supprimer.")}</p>
      {sections.map(([title, paragraphs]) => (
        <section key={title} id={title === "Supprimer tes données" ? "suppression" : undefined} className="mt-6">
          <h2 className="text-lg font-semibold">{t(title)}</h2>
          {paragraphs.map((p) => (
            <p key={p} className="mt-2 text-[15px] leading-relaxed text-ink/85">
              {t(p)}
            </p>
          ))}
        </section>
      ))}
      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/connexion" className="font-semibold text-accent underline-offset-2 hover:underline">{t("Retour à la connexion")}</Link>
      </p>
    </article>
  );
}
