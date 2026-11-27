/**
 * Produit le SQL du jeu de démonstration (le même que prisma/seed.ts) pour la base de production,
 * à exécuter dans l'éditeur SQL Supabase quand la base n'est pas joignable par Prisma.
 *
 *   npx tsx scripts/demo-sql.ts <dossier-de-sortie>
 *
 * Écrit 01-users.sql, 02-moments.sql, 03-memberships.sql, 04-notifications.sql : chaque fichier
 * est une transaction autonome, sous le rôle momento_app, dans le schéma momento.
 * Ne touche QUE les comptes @demo.momento.app (isDemo) et leurs Moments : les vrais comptes,
 * leurs Moments et leurs participations ne sont jamais modifiés.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "../src/lib/password";
import { buildDemoDataset } from "../src/server/demo-dataset";

const out = process.argv[2] ?? "demo-sql";
mkdirSync(out, { recursive: true });

const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const ts = (d: Date | null | undefined) => (d ? `'${d.toISOString().replace("T", " ").replace("Z", "")}'::timestamp` : "NULL::timestamp");
const arr = (a: string[]) => (a.length ? `ARRAY[${a.map(q).join(",")}]::text[]` : "'{}'::text[]");
const wrap = (body: string) => `BEGIN;\nSET LOCAL ROLE momento_app;\nSET LOCAL search_path TO momento;\n${body}\nCOMMIT;\n`;
const demoUsers = `SELECT id, username FROM "User" WHERE "isDemo" AND email LIKE '%@demo.momento.app'`;

async function main() {
  const data = buildDemoDataset();
  const hash = await hashPassword("momento-demo");
  const now = ts(new Date());

  // 1. Profils : création ou mise à jour (seulement si le compte existant est un compte démo).
  const users = data.users
    .map((u) => `(${q(`du_${u.username}`)},${q(u.email)},${q(hash)},${q(u.name)},${q(u.username)},${q(u.bio)},${q(u.photoUrl)},${q(u.city)},${arr(u.interests)},${q(u.role)}::"UserRole",'ACTIVE'::"AccountStatus",true,${ts(u.createdAt)},${now})`)
    .join(",\n");
  writeFileSync(
    path.join(out, "01-users.sql"),
    wrap(`INSERT INTO "User" (id,email,"passwordHash",name,username,bio,"photoUrl",city,interests,role,status,"isDemo","createdAt","updatedAt") VALUES
${users}
ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, username=EXCLUDED.username, bio=EXCLUDED.bio, "photoUrl"=EXCLUDED."photoUrl", city=EXCLUDED.city,
  interests=EXCLUDED.interests, role=EXCLUDED.role, status='ACTIVE', "passwordHash"=EXCLUDED."passwordHash", "updatedAt"=EXCLUDED."updatedAt"
WHERE "User"."isDemo";`),
  );

  // 2. Moments : on repart de zéro pour les seuls Moments de démo (participations en cascade).
  const moments = data.moments
    .map((m) => `(${q(m.id)},${q(m.host)},${q(m.title)},${q(m.description)},${q(m.category)},${arr(m.vibeTags)},${q(m.mediaType)},${q(m.mediaUrl)},${q(m.posterUrl)},${q(m.textTheme)},${q(m.city)},${q(m.area)},${q(m.placeName)},${q(m.address)},${ts(m.startsAt)},${ts(m.endsAt)},${m.capacity},${q(m.status)},${q(m.visibility)},${ts(m.publishedAt)},${ts(m.cancelledAt)},${q(m.cancelReason)},${ts(m.createdAt)})`)
    .join(",\n");
  writeFileSync(
    path.join(out, "02-moments.sql"),
    wrap(`DELETE FROM "Moment" WHERE "isDemo" AND "hostId" IN (SELECT id FROM (${demoUsers}) d);
DELETE FROM "Notification" WHERE "userId" IN (SELECT id FROM (${demoUsers}) d);
DELETE FROM "Report" WHERE "reporterId" IN (SELECT id FROM (${demoUsers}) d);
DELETE FROM "Block" WHERE "blockerId" IN (SELECT id FROM (${demoUsers}) d) AND "blockedId" IN (SELECT id FROM (${demoUsers}) d);
INSERT INTO "Moment" (id,"hostId",title,description,category,"vibeTags","mediaType","mediaUrl","posterUrl","textTheme",city,area,"placeName",address,"addressMembersOnly","startsAt","endsAt",timezone,capacity,status,visibility,"showAttendees","isDemo","publishedAt","cancelledAt","cancelReason","createdAt","updatedAt")
SELECT v.id,u.id,v.title,v.description,v.category,v.tags,v.media::"MediaType",v.url,v.poster,v.theme,v.city,v.area,v.place,v.address,true,v.starts,v.ends,'Europe/Madrid',v.cap,v.status::"MomentStatus",v.vis::"MomentVisibility",true,true,v.pub,v.canc,v.reason,v.created,${now}
FROM (VALUES
${moments}
) AS v(id,host,title,description,category,tags,media,url,poster,theme,city,area,place,address,starts,ends,cap,status,vis,pub,canc,reason,created)
JOIN (${demoUsers}) u ON u.username = v.host;`),
  );

  // 3. Participations.
  const ms = data.memberships
    .map((m, i) => `(${q(`dms_${i}`)},${q(m.momentId)},${q(m.user)},${q(m.initiator)},${q(m.kind)},${q(m.status)},${q(m.message)},${ts(m.createdAt)},${ts(m.respondedAt)})`)
    .join(",\n");
  writeFileSync(
    path.join(out, "03-memberships.sql"),
    wrap(`INSERT INTO "MomentMembership" (id,"momentId","userId","initiatorId",kind,status,message,"showOnMoment","createdAt","updatedAt","respondedAt")
SELECT v.id,v.moment,u.id,i.id,v.kind::"MembershipKind",v.status::"MembershipStatus",v.message,true,v.created,${now},v.responded
FROM (VALUES
${ms}
) AS v(id,moment,username,initiator,kind,status,message,created,responded)
JOIN (${demoUsers}) u ON u.username = v.username
JOIN (${demoUsers}) i ON i.username = v.initiator;`),
  );

  // 4. Notifications et signalements.
  const ns = data.notifications
    .map((n, i) => `(${q(`dn_${i}`)},${q(n.user)},${q(n.type)},${q(n.momentId)},${q(n.actor)},${q(n.body)},${ts(n.createdAt)},${ts(n.readAt)})`)
    .join(",\n");
  const rs = data.reports
    .map((x, i) => `(${q(`dr_${i}`)},${q(x.reporter)},${q(x.targetUser)},${q(x.momentId)},${q(x.reason)},${q(x.details)},${ts(x.createdAt)})`)
    .join(",\n");
  writeFileSync(
    path.join(out, "04-notifications.sql"),
    wrap(`INSERT INTO "Notification" (id,"userId",type,"momentId","actorId",body,"createdAt","readAt")
SELECT v.id,u.id,v.type::"NotificationType",v.moment,a.id,v.body,v.created,v.read
FROM (VALUES
${ns}
) AS v(id,username,type,moment,actor,body,created,read)
JOIN (${demoUsers}) u ON u.username = v.username
LEFT JOIN (${demoUsers}) a ON a.username = v.actor;
INSERT INTO "Report" (id,"reporterId","targetUserId","momentId",reason,details,status,"createdAt")
SELECT v.id,r.id,t.id,v.moment,v.reason,v.details,'OPEN'::"ReportStatus",v.created
FROM (VALUES
${rs}
) AS v(id,reporter,target,moment,reason,details,created)
JOIN (${demoUsers}) r ON r.username = v.reporter
LEFT JOIN (${demoUsers}) t ON t.username = v.target;`),
  );
  console.log(`SQL écrit dans ${out} : ${data.users.length} profils, ${data.moments.length} Moments, ${data.memberships.length} participations, ${data.notifications.length} notifications.`);
}

main();
