/**
 * Diagnostic de connexion à la base, sans afficher de secret.
 *
 *   npm run db:check
 *
 * Affiche l'hôte, la base et les paramètres SSL de DATABASE_URL (mot de passe masqué),
 * tente une requête, et explique les erreurs courantes — dont l'erreur historique
 * « self-signed certificate in certificate chain ».
 */
import { PrismaClient } from "@prisma/client";

function describeUrl(raw: string | undefined) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace("/", ""),
      user: u.username ? `${u.username.slice(0, 2)}***` : "(aucun)",
      password: u.password ? "(défini, masqué)" : "(aucun)",
      sslmode: u.searchParams.get("sslmode") ?? "(non défini)",
      sslaccept: u.searchParams.get("sslaccept") ?? "(non défini)",
      sslrootcert: u.searchParams.get("sslrootcert") ? "(défini)" : "(non défini)",
      pgbouncer: u.searchParams.get("pgbouncer") ?? "(non défini)",
    };
  } catch {
    return { error: "DATABASE_URL n'est pas une URL valide." };
  }
}

async function main() {
  const info = describeUrl(process.env.DATABASE_URL);
  if (!info) {
    console.error("✗ DATABASE_URL n'est pas défini. Copie .env.example vers .env.");
    process.exit(1);
  }
  console.log("Configuration détectée :");
  console.table(info);

  const prisma = new PrismaClient();
  const t0 = Date.now();
  try {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    console.log(`✓ Connexion OK en ${Date.now() - t0} ms — ${rows[0]?.version.split(",")[0]}`);
    const [users, moments] = await Promise.all([prisma.user.count(), prisma.moment.count()]);
    console.log(`  ${users} comptes, ${moments} Moments.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("✗ Connexion impossible :", msg.split("\n").slice(-3).join(" "));
    if (/self[- ]signed certificate/i.test(msg)) {
      console.error(`
Cause probable : la chaîne de certificats du serveur n'est pas reconnue par Prisma.
À faire (ne PAS désactiver la vérification TLS en production) :
  1. Récupérer le certificat racine (CA) fourni par l'hébergeur de la base.
  2. L'ajouter dans DATABASE_URL : ?sslmode=require&sslcert=/chemin/vers/ca.pem
     (ou installer la CA dans le magasin système / NODE_EXTRA_CA_CERTS pour Node).
  3. Si un proxy d'entreprise ou un antivirus intercepte TLS, ajouter sa CA de la même façon.
  4. Uniquement en local et en connaissance de cause : sslaccept=accept_invalid_certs.
Voir docs/DATABASE.md.`);
    } else if (/P1001|Can't reach database server|ECONNREFUSED/i.test(msg)) {
      console.error("\nLe serveur est injoignable : vérifie qu'il tourne (docker compose up -d db) et l'hôte/port.");
    } else if (/P1000|authentication failed/i.test(msg)) {
      console.error("\nIdentifiants refusés : vérifie l'utilisateur et le mot de passe de DATABASE_URL.");
    } else if (/does not exist/i.test(msg)) {
      console.error("\nLa base n'existe pas encore : crée-la puis lance npm run db:migrate.");
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
