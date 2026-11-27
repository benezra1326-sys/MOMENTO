/**
 * Données de démonstration (fictives), partagées par le seed et par le repli DEMO_MODE.
 * Les dates sont exprimées en jours relatifs (day) + heure locale Europe/Madrid.
 */
import type { MediaType, MembershipStatus, MomentVisibility } from "@prisma/client";
import crowd from "./demo-crowd.json";
import media from "./demo-media.json";

export const DEMO_TZ = "Europe/Madrid";

export type Person = { slug: string; name: string; city: string; bio: string; interests: string[]; admin?: boolean; guestOnly?: boolean; joinedDaysAgo?: number };

const scriptedPeople: Person[] = [
  { slug: "lea", name: "Léa M.", city: "Marbella", bio: "Designer, toujours partante pour un sunset ou une expo.", interests: ["design", "sunset", "vin nature"] },
  { slug: "karim", name: "Karim B.", city: "Marbella", bio: "Entrepreneur. Je cuisine pour mes amis le jeudi.", interests: ["cuisine", "startups", "padel"] },
  { slug: "sofia", name: "Sofía R.", city: "Marbella", bio: "Photographe. Café le matin, mer le soir.", interests: ["photo", "café", "voile"] },
  { slug: "noah", name: "Noah K.", city: "Marbella", bio: "Coureur du dimanche, DJ du samedi.", interests: ["running", "musique", "brunch"] },
  { slug: "ines", name: "Inès D.", city: "Málaga", bio: "Curatrice indépendante. J'adore faire découvrir des galeries.", interests: ["art", "galeries", "balades"] },
  { slug: "marco", name: "Marco T.", city: "Marbella", bio: "Skipper. Places libres sur le bateau certains week-ends.", interests: ["voile", "mer", "apéro"] },
  { slug: "yael", name: "Yaël S.", city: "Marbella", bio: "Nouvelle en ville, envie de rencontrer du monde.", interests: ["yoga", "brunch", "lecture"] },
  { slug: "lucas", name: "Lucas P.", city: "Madrid", bio: "Dev le jour, cinéphile la nuit.", interests: ["cinéma", "tech", "tapas"] },
  { slug: "amira", name: "Amira H.", city: "Marbella", bio: "Coach sportive. Séances en plein air ouvertes à tous niveaux.", interests: ["sport", "plage", "nutrition"] },
  { slug: "hugo", name: "Hugo L.", city: "Paris", bio: "Architecte de passage en Andalousie.", interests: ["architecture", "vin", "marche"] },
  { slug: "elena", name: "Elena V.", city: "Marbella", bio: "Sommelière. Dégustations entre curieux.", interests: ["vin", "gastronomie", "musique"] },
  { slug: "tom", name: "Tom W.", city: "Marbella", bio: "Voyageur, télétravailleur, amateur de rooftops.", interests: ["voyage", "rooftop", "coworking"] },
  { slug: "nadia", name: "Nadia Z.", city: "Málaga", bio: "Danseuse. Toujours une soirée en tête.", interests: ["danse", "soirées", "musique"] },
  { slug: "jules", name: "Jules F.", city: "Marbella", bio: "Étudiant en Erasmus, partant pour tout.", interests: ["foot", "plage", "langues"] },
  { slug: "maya", name: "Maya C.", city: "Marbella", bio: "Illustratrice. Carnet à la main, partout.", interests: ["dessin", "café", "expos"] },
  { slug: "david", name: "David A.", city: "Tel Aviv", bio: "Fondateur d'une app de voyage. Brunchs et networking.", interests: ["startups", "brunch", "voyage"] },
  // Participants uniquement : aucun Moment créé, pour tester l'expérience de celui qui rejoint.
  { slug: "clara", name: "Clara B.", city: "Marbella", bio: "Arrivée il y a un mois, je cherche des sorties sympas.", interests: ["plage", "brunch", "expos"], guestOnly: true },
  { slug: "sam", name: "Sam O.", city: "Marbella", bio: "En télétravail, je découvre la ville.", interests: ["running", "café", "tapas"], guestOnly: true },
  { slug: "rafael", name: "Rafael G.", city: "Málaga", bio: "Étudiant, curieux de tout.", interests: ["musique", "foot", "cinéma"], guestOnly: true },
  { slug: "moderation", name: "Équipe modération (démo)", city: "Marbella", bio: "Compte de démonstration avec le rôle administrateur.", interests: [], admin: true },
];

export type SeedMoment = {
  /** Clé stable (identifiant de la photo de couverture et de l'id en base). */
  key?: string;
  host: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  media: MediaType;
  mediaUrl?: string;
  posterUrl?: string;
  textTheme?: string;
  city: string;
  area: string;
  placeName: string;
  address?: string;
  day: number;
  start: string;
  end?: string;
  capacity: number;
  visibility?: MomentVisibility;
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED";
  cancelReason?: string;
  members?: [string, MembershipStatus, ("REQUEST" | "INVITE")?, string?][];
};

const img = (n: string) => `/demo/moments/${n}.webp`;

const scriptedMoments: SeedMoment[] = [
  {
    host: "lea", title: "Sunset + verre sur la plage", description: "On se retrouve pour regarder le soleil se coucher, un verre à la main. Ambiance détendue, on apporte chacun quelque chose à partager.",
    category: "sunset", tags: ["chill", "en plein air", "rencontres"], media: "VIDEO", mediaUrl: "/demo/video/sunset-1.mp4", posterUrl: "/demo/video/sunset-1-poster.webp",
    city: "Marbella", area: "Playa de la Fontanilla", placeName: "Plage de la Fontanilla", address: "Paseo Marítimo, près du poste de secours n°3", day: 0, start: "19:30", end: "21:30", capacity: 6,
    members: [["sofia", "ACCEPTED"], ["jules", "ACCEPTED"], ["yael", "PENDING", "REQUEST", "Je viens d'arriver à Marbella, ça me ferait plaisir !"]],
  },
  {
    host: "karim", title: "Dîner maison : cuisine libanaise", description: "Je cuisine mezze, kebbé et taboulé pour 6 personnes. Apporte juste ta bonne humeur (et une bouteille si tu veux). Adresse donnée aux personnes acceptées.",
    category: "dinner", tags: ["gourmand", "intimiste", "rencontres"], media: "IMAGE", mediaUrl: img("dinner-1"),
    city: "Marbella", area: "Centre historique", placeName: "Chez Karim", address: "Calle Ancha 12, 2ºB", day: 1, start: "20:30", end: "23:30", capacity: 5,
    members: [["elena", "ACCEPTED"], ["tom", "ACCEPTED"], ["noah", "PENDING", "REQUEST", "Fan de cuisine libanaise, je peux apporter le dessert."], ["maya", "PENDING", "REQUEST"]],
  },
  {
    host: "sofia", title: "Café de travail au calme", description: "Session de travail partagée : 2 heures concentrées, puis on discute de nos projets. Wifi correct, bons flat whites.",
    category: "coffee", tags: ["networking", "lent", "créatif"], media: "IMAGE", mediaUrl: img("coffee-1"),
    city: "Marbella", area: "Centre", placeName: "Café du marché", day: 1, start: "09:30", end: "12:00", capacity: 4, visibility: "PUBLIC",
    members: [["tom", "ACCEPTED"], ["maya", "ACCEPTED"]],
  },
  {
    host: "ines", title: "Galerie + verre : nouvelle expo céramique", description: "Visite guidée d'une jeune galerie, puis on prolonge autour d'un verre. Je présente les artistes, aucune connaissance requise.",
    category: "gallery", tags: ["créatif", "lent", "rencontres"], media: "IMAGE", mediaUrl: img("gallery-1"),
    city: "Málaga", area: "Soho", placeName: "Galerie du quartier Soho", day: 2, start: "18:00", end: "20:30", capacity: 8,
    members: [["hugo", "ACCEPTED"], ["maya", "ACCEPTED"], ["lea", "PENDING", "REQUEST"]],
  },
  {
    host: "noah", title: "Course matinale 7 km + café", description: "Footing tranquille (6 min/km) le long du front de mer, puis café. Tous niveaux bienvenus, personne n'est laissé derrière.",
    category: "sport", tags: ["sportif", "en plein air"], media: "IMAGE", mediaUrl: img("sport-1"),
    city: "Marbella", area: "Paseo Marítimo", placeName: "Départ devant le phare", day: 2, start: "07:30", end: "09:00", capacity: 10, visibility: "PUBLIC",
    members: [["amira", "ACCEPTED"], ["jules", "ACCEPTED"], ["david", "ACCEPTED"]],
  },
  {
    host: "tom", title: "Apéro sur un rooftop", description: "Un rooftop avec vue sur la baie, des cocktails et des gens sympas. Idéal pour élargir son cercle quand on est nouveau en ville.",
    category: "drinks", tags: ["festif", "rencontres", "musique"], media: "IMAGE", mediaUrl: img("drinks-1"),
    city: "Marbella", area: "Golden Mile", placeName: "Rooftop du Golden Mile", day: 3, start: "19:00", end: "22:00", capacity: 8,
    members: [["lea", "ACCEPTED"], ["nadia", "ACCEPTED"], ["jules", "PENDING", "REQUEST"]],
  },
  {
    host: "yael", title: "Brunch des nouveaux arrivants", description: "Tu viens d'arriver à Marbella ? Moi aussi. Brunch simple pour se rencontrer et partager les bons plans.",
    category: "brunch", tags: ["rencontres", "chill", "gourmand"], media: "IMAGE", mediaUrl: img("brunch-1"),
    city: "Marbella", area: "Nueva Andalucía", placeName: "Brunch spot de Nueva Andalucía", day: 3, start: "11:00", end: "13:00", capacity: 6,
    members: [["sofia", "ACCEPTED"], ["david", "PENDING", "REQUEST"]],
  },
  {
    host: "marco", title: "Journée en voilier", description: "4 places à bord pour une journée de navigation. Pas besoin d'expérience, je m'occupe de tout. On partage les frais de port.",
    category: "boat", tags: ["en plein air", "spontané", "chill"], media: "IMAGE", mediaUrl: img("boat-1"),
    city: "Marbella", area: "Puerto Banús", placeName: "Ponton C, Puerto Banús", address: "Puerto Banús, ponton C, place 41", day: 4, start: "10:00", end: "17:00", capacity: 4,
    members: [["sofia", "ACCEPTED"], ["lea", "ACCEPTED"], ["noah", "ACCEPTED"], ["tom", "ACCEPTED"], ["jules", "DECLINED", "REQUEST"]],
  },
  {
    host: "amira", title: "Workout sur la plage", description: "Circuit training de 45 minutes, au poids du corps, adapté à tous les niveaux. On finit par une baignade si l'eau le permet.",
    category: "sport", tags: ["sportif", "en plein air"], media: "IMAGE", mediaUrl: img("sport-2"),
    city: "Marbella", area: "Playa de Venus", placeName: "Plage de Venus", day: 4, start: "08:30", end: "09:30", capacity: 12, visibility: "PUBLIC",
    members: [["yael", "ACCEPTED"], ["jules", "ACCEPTED"]],
  },
  {
    host: "elena", title: "Dégustation de vins andalous", description: "Six vins de la région, expliqués simplement, avec quelques tapas. Pour curieux, pas besoin d'être expert.",
    category: "drinks", tags: ["gourmand", "intimiste"], media: "IMAGE", mediaUrl: img("dinner-2"),
    city: "Marbella", area: "Centre historique", placeName: "Cave à vins du centre", day: 5, start: "19:30", end: "21:30", capacity: 8,
    members: [["karim", "ACCEPTED"], ["hugo", "ACCEPTED"], ["lea", "ACCEPTED"]],
  },
  {
    host: "hugo", title: "Balade architecture dans la vieille ville", description: "Une heure et demie de marche pour lire les façades, les patios et l'histoire de la ville. Rythme tranquille.",
    category: "walk", tags: ["lent", "créatif", "en plein air"], media: "IMAGE", mediaUrl: img("walk-1"),
    city: "Marbella", area: "Casco Antiguo", placeName: "Plaza de los Naranjos", day: 5, start: "10:30", end: "12:00", capacity: 10, visibility: "PUBLIC",
    members: [["maya", "ACCEPTED"], ["ines", "ACCEPTED"]],
  },
  {
    host: "nadia", title: "Soirée salsa pour débutants", description: "Cours d'initiation d'une heure, puis soirée. Viens seul·e ou à plusieurs, on tourne les partenaires.",
    category: "party", tags: ["festif", "musique", "rencontres"], media: "VIDEO", mediaUrl: "/demo/video/party-1.mp4", posterUrl: "/demo/video/party-1-poster.webp",
    city: "Málaga", area: "Centre", placeName: "Salle de danse du centre", day: 6, start: "21:00", end: "01:00", capacity: 20,
    members: [["tom", "ACCEPTED"], ["jules", "ACCEPTED"], ["lucas", "PENDING", "REQUEST"]],
  },
  {
    host: "maya", title: "Croquis au café", description: "On dessine ce qu'on voit pendant une heure, sans pression ni niveau requis. J'apporte du papier en plus.",
    category: "coffee", tags: ["créatif", "lent", "chill"], media: "TEXT", textTheme: "citrus",
    city: "Marbella", area: "Centre", placeName: "Café de la place", day: 6, start: "16:00", end: "18:00", capacity: 5,
    members: [["lea", "ACCEPTED"]],
  },
  {
    host: "david", title: "Petit-déj fondateurs & freelances", description: "Chacun présente son projet en 2 minutes, puis on échange librement. Bienveillance obligatoire, pitchs commerciaux interdits.",
    category: "brunch", tags: ["networking", "rencontres"], media: "IMAGE", mediaUrl: img("brunch-2"),
    city: "Marbella", area: "Puerto Banús", placeName: "Café du port", day: 7, start: "09:00", end: "10:30", capacity: 10,
    members: [["karim", "ACCEPTED"], ["tom", "ACCEPTED"], ["sofia", "PENDING", "REQUEST"]],
  },
  {
    host: "jules", title: "Foot 5 contre 5", description: "Il nous manque des joueurs pour un match amical sur terrain synthétique. Niveau détente, on partage la location.",
    category: "sport", tags: ["sportif", "spontané"], media: "TEXT", textTheme: "forest",
    city: "Marbella", area: "San Pedro", placeName: "Terrain municipal de San Pedro", day: 2, start: "19:00", end: "20:30", capacity: 9, visibility: "PUBLIC",
    members: [["noah", "ACCEPTED"], ["lucas", "ACCEPTED"], ["david", "ACCEPTED"], ["marco", "ACCEPTED"]],
  },
  {
    host: "sofia", title: "Sunset photo walk", description: "Balade photo à l'heure dorée. Téléphone ou appareil, peu importe : je partage quelques astuces de cadrage.",
    category: "sunset", tags: ["créatif", "en plein air"], media: "IMAGE", mediaUrl: img("sunset-2"),
    city: "Marbella", area: "Cabopino", placeName: "Dunes de Cabopino", day: 8, start: "18:45", end: "20:30", capacity: 6,
    members: [["maya", "ACCEPTED"], ["hugo", "PENDING", "REQUEST"]],
  },
  {
    host: "lucas", title: "Ciné en plein air + tapas", description: "Projection d'un classique en VO sous-titrée, puis tapas dans le quartier.",
    category: "other", tags: ["chill", "rencontres"], media: "TEXT", textTheme: "ink",
    city: "Madrid", area: "Lavapiés", placeName: "Terrasse de cinéma de Lavapiés", day: 4, start: "21:30", end: "00:30", capacity: 6,
    members: [["hugo", "ACCEPTED"]],
  },
  {
    host: "karim", title: "Padel en double", description: "Match amical, niveau intermédiaire. Raquettes à prêter si besoin.",
    category: "sport", tags: ["sportif"], media: "TEXT", textTheme: "ocean",
    city: "Marbella", area: "Nueva Andalucía", placeName: "Club de padel", day: 9, start: "18:00", end: "19:30", capacity: 3,
    members: [["noah", "ACCEPTED"]],
  },
  {
    host: "lea", title: "Atelier céramique entre amis", description: "Deux heures pour façonner un bol ou une tasse avec une céramiste du quartier. Matériel fourni.",
    category: "gallery", tags: ["créatif", "intimiste"], media: "IMAGE", mediaUrl: img("gallery-2"),
    city: "Marbella", area: "Centre", placeName: "Atelier de céramique", day: 10, start: "17:00", end: "19:00", capacity: 6,
    members: [["maya", "ACCEPTED"], ["ines", "ACCEPTED"], ["yael", "ACCEPTED"], ["elena", "ACCEPTED"], ["sofia", "ACCEPTED"], ["amira", "ACCEPTED"]],
  },
  {
    host: "tom", title: "Soirée jeux de société", description: "Jeux faciles à apprendre, snacks et bonne ambiance. Apporte ton jeu préféré si tu veux.",
    category: "party", tags: ["chill", "rencontres"], media: "IMAGE", mediaUrl: img("party-2"),
    city: "Marbella", area: "Centre", placeName: "Bar à jeux du centre", day: 11, start: "20:00", end: "23:30", capacity: 8,
    members: [["jules", "ACCEPTED"], ["yael", "PENDING", "REQUEST"]],
  },
  {
    host: "marco", title: "Paddle au lever du soleil", description: "Une heure de paddle sur une mer calme, location sur place. Débutants bienvenus.",
    category: "boat", tags: ["sportif", "en plein air", "lent"], media: "IMAGE", mediaUrl: img("boat-2"),
    city: "Marbella", area: "Playa del Cable", placeName: "Plage del Cable", day: 12, start: "07:45", end: "09:00", capacity: 6,
    members: [],
  },
  {
    host: "elena", title: "Balade botanique et pique-nique", description: "Promenade dans les collines puis pique-nique partagé. Chacun apporte un plat.",
    category: "walk", tags: ["en plein air", "chill", "gourmand"], media: "IMAGE", mediaUrl: img("walk-2"),
    city: "Marbella", area: "Sierra Blanca", placeName: "Départ du sentier de Juanar", day: 13, start: "10:00", end: "14:00", capacity: 10,
    members: [["hugo", "ACCEPTED"]],
  },
  {
    host: "yael", title: "Yoga doux au parc", description: "Séance de yoga accessible à tous, une heure, en plein air. Tapis non fourni.",
    category: "sport", tags: ["lent", "en plein air"], media: "TEXT", textTheme: "plum",
    city: "Marbella", area: "Parque de la Alameda", placeName: "Parc de la Alameda", day: 5, start: "09:00", end: "10:00", capacity: 8, visibility: "PUBLIC",
    members: [["amira", "ACCEPTED"], ["sofia", "ACCEPTED"]],
  },
  // États particuliers, pour montrer les écrans correspondants
  {
    host: "karim", title: "Dîner sur invitation : anniversaire", description: "Dîner privé pour l'anniversaire d'une amie. Visible seulement par les personnes invitées.",
    category: "dinner", tags: ["intimiste", "festif"], media: "IMAGE", mediaUrl: img("dinner-2"),
    city: "Marbella", area: "Sierra Blanca", placeName: "Chez Karim", address: "Urbanización Sierra Blanca, villa 8", day: 6, start: "20:00", end: "23:30", capacity: 8, visibility: "INVITE_ONLY",
    members: [["lea", "ACCEPTED", "INVITE"], ["elena", "PENDING", "INVITE"], ["sofia", "DECLINED", "INVITE"]],
  },
  {
    host: "noah", title: "Mix house sur un toit (annulé)", description: "Session DJ au coucher du soleil.",
    category: "party", tags: ["musique", "festif"], media: "IMAGE", mediaUrl: img("party-1"),
    city: "Marbella", area: "Centre", placeName: "Toit-terrasse", day: 3, start: "19:00", capacity: 15, status: "CANCELLED", cancelReason: "Météo annoncée trop venteuse, on reporte.",
    members: [["tom", "ACCEPTED"], ["nadia", "ACCEPTED"]],
  },
  {
    host: "lea", title: "Brunch du dimanche dernier", description: "Un brunch déjà passé, pour montrer l'état « terminé ».",
    category: "brunch", tags: ["chill"], media: "IMAGE", mediaUrl: img("brunch-1"),
    city: "Marbella", area: "Centre", placeName: "Brunch du centre", day: -5, start: "11:00", end: "13:00", capacity: 6,
    members: [["sofia", "ACCEPTED"], ["yael", "ACCEPTED"], ["maya", "ACCEPTED"]],
  },
  {
    host: "lea", title: "Pique-nique au phare (brouillon)", description: "Idée en préparation, pas encore publiée.",
    category: "walk", tags: ["chill"], media: "TEXT", textTheme: "dusk",
    city: "Marbella", area: "Paseo Marítimo", placeName: "Phare de Marbella", day: 14, start: "13:00", capacity: 8, status: "DRAFT",
  },
];


/**
 * Profils mis en avant sur la page de connexion (toujours les mêmes, quel que soit le volume
 * de la foule) : 6 organisateurs, 3 participants sans Moment, la modération.
 */
export const FEATURED_DEMO = ["lea", "karim", "sofia", "noah", "tom", "marco", "clara", "sam", "rafael", "moderation"];

/** Foule de démonstration générée par scripts/make-crowd.ts (profils et Moments fictifs). */
export const people: Person[] = [...scriptedPeople, ...(crowd.people as Person[])];
const avatars = media.avatars as Record<string, string>;
const covers = media.covers as Record<string, string>;
/** Visuels de la galerie proposée à la création d'un Moment et des tuiles Explorer (photos sous licence libre). */
export const demoGallery = ((media as { gallery?: Record<string, string> }).gallery ?? {}) as Record<string, string>;

/** Un Moment qui a une photo de couverture devient un Moment « image » (les autres restent texte). */
const withPhoto = (m: SeedMoment): SeedMoment =>
  m.key && covers[m.key] && m.media !== "IMAGE" ? { ...m, media: "IMAGE", mediaUrl: undefined, posterUrl: undefined, textTheme: undefined } : m;

export const moments: SeedMoment[] = [
  ...scriptedMoments.map((m, i) => ({ ...m, key: m.key ?? `s${String(i + 1).padStart(3, "0")}` })),
  ...(crowd.moments as SeedMoment[]),
].map(withPhoto);

/** Photo de profil : visage généré (personne qui n'existe pas) si disponible, sinon illustration locale. */
export function demoPhoto(p: Person): string | null {
  if (p.admin) return null;
  if (avatars[p.slug]) return avatars[p.slug];
  return scriptedPeople.includes(p) && !p.guestOnly ? `/demo/people/${p.slug}.webp` : null;
}

/** Visuel du Moment : photo libre de droits si disponible, sinon illustration locale par catégorie. */
export function demoCover(m: SeedMoment): string | null {
  if (m.media === "TEXT") return null;
  if (m.media === "IMAGE" && m.key && covers[m.key]) return covers[m.key];
  if (m.mediaUrl) return m.mediaUrl;
  const n = m.key ? (m.key.charCodeAt(m.key.length - 1) % 2) + 1 : 1;
  return img(`${m.category}-${n}`);
}
