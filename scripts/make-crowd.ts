/**
 * Génère la « foule » de démonstration (profils et Moments fictifs supplémentaires) :
 *
 *   npx tsx scripts/make-crowd.ts faces.json > src/server/demo-crowd.json
 *
 * faces.json : { "<faceId>": { "g": "man" | "woman", "age": "...", "url"?: string } } (visages
 * générés par IA, personnes qui n'existent pas). Le résultat est déterministe (graine fixe) :
 * relancer le script avec le même fichier redonne exactement les mêmes données.
 */
import { readFileSync } from "node:fs";

type Face = { g: string; age: string; url?: string };
const faces: Record<string, Face> = JSON.parse(readFileSync(process.argv[2], "utf8"));

let s = 20261127;
const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const women = ["Camille", "Lucía", "Chloé", "Sara", "Emma", "Valentina", "Laura", "Alba", "Nina", "Zoé", "Manon", "Julia", "Carmen", "Olivia", "Mia", "Leila", "Rania", "Hannah", "Ana", "Paula", "Charlotte", "Marta", "Elisa", "Giulia", "Anouk", "Salomé", "Noémie", "Rose", "Lina", "Mathilde", "Pilar", "Irene", "Sophie", "Freya", "Lola", "Adèle", "Margaux", "Ingrid", "Alicia", "Jade"];
const men = ["Antoine", "Pablo", "Mathis", "Alejandro", "Louis", "Diego", "Javier", "Théo", "Nicolás", "Adrien", "Mateo", "Raphaël", "Álvaro", "Gabriel", "Sergio", "Maxime", "Daniel", "Ethan", "Bruno", "Omar", "Yanis", "Lorenzo", "Felix", "Samuel", "Victor", "Carlos", "Arthur", "Iván", "Oscar", "Léo", "Thomas", "Marc", "Rémi", "Andrés", "Nathan", "Elias", "Simon", "Benjamin", "Enzo", "Hugo"];
const olderW = ["Isabel", "Françoise", "Catherine", "Rosa", "Brigitte", "Mercedes", "Sylvie", "Dolores"];
const olderM = ["Jean-Pierre", "Michel", "Antonio", "Philippe", "Manuel", "Alain", "Francisco", "Gérard"];
const initials = "ABCDEFGHJKLMNOPRSTVZ";

const cityAreas: Record<string, string[]> = {
  Marbella: ["Casco Antiguo", "Puerto Banús", "Nueva Andalucía", "Golden Mile", "San Pedro", "Elviria", "Cabopino", "Puerto Deportivo", "Paseo Marítimo", "Sierra Blanca", "La Cañada", "El Ángel"],
  "Málaga": ["Soho", "Centre historique", "La Malagueta", "Pedregalejo", "El Palo", "Muelle Uno", "El Limonar", "Teatinos"],
  Estepona: ["Vieille ville", "Port d'Estepona", "Playa de la Rada", "El Padrón"],
};
const cityOf = () => { const x = r(); return x < 0.68 ? "Marbella" : x < 0.9 ? "Málaga" : "Estepona"; };

const bios: [string, string[]][] = [
  ["Je viens d'arriver sur la côte, envie de rencontrer des gens sympas.", ["rencontres", "plage", "brunch"]],
  ["Graphiste freelance. Café, carnet et longues balades.", ["design", "café", "balades"]],
  ["Prof d'espagnol le jour, salsa le soir.", ["danse", "langues", "musique"]],
  ["Toujours partant·e pour un sunset improvisé.", ["sunset", "apéro", "photo"]],
  ["Je cuisine trop pour une seule personne, alors j'invite.", ["cuisine", "vin", "dîners"]],
  ["Runner du matin, lecteur du soir.", ["running", "lecture", "café"]],
  ["Développeuse en télétravail, je cherche des coworkings et des gens.", ["tech", "coworking", "café"]],
  ["Passionné de voile, je partage le bateau quand il y a de la place.", ["voile", "mer", "pêche"]],
  ["Architecte. J'aime les vieilles villes et les nouvelles adresses.", ["architecture", "balades", "expos"]],
  ["Infirmière de nuit, dispo en journée pour du sport et des brunchs.", ["sport", "brunch", "plage"]],
  ["Photographe amateur, toujours à la recherche de la bonne lumière.", ["photo", "sunset", "randonnée"]],
  ["Étudiant en master, curieux de tout.", ["cinéma", "foot", "soirées"]],
  ["Sommelier en devenir. Je goûte, je note, je partage.", ["vin", "gastronomie", "dîners"]],
  ["Yoga le matin, padel l'après-midi.", ["yoga", "padel", "nutrition"]],
  ["Retraité·e actif·ve, jamais contre une bonne table.", ["gastronomie", "marche", "histoire"]],
  ["Musicien. Guitare dans le sac, toujours.", ["musique", "concerts", "apéro"]],
  ["Je monte ma startup et j'adore rencontrer d'autres fondateurs.", ["startups", "networking", "brunch"]],
  ["Illustratrice, je dessine dans tous les cafés de la ville.", ["dessin", "café", "expos"]],
  ["Plongeur, kitesurfeur, et toujours dans l'eau.", ["kitesurf", "plongée", "plage"]],
  ["Libraire. Je lance des clubs de lecture partout où je passe.", ["lecture", "café", "balades"]],
  ["Chef de cuisine en pause, je teste des recettes avec qui veut.", ["cuisine", "marchés", "vin"]],
  ["Coach de vie, fan de randonnées au lever du soleil.", ["randonnée", "méditation", "nature"]],
  ["Expat depuis 3 ans, je connais les bons plans et j'aime les partager.", ["bons plans", "tapas", "rencontres"]],
  ["Danseuse contemporaine, toujours une soirée en tête.", ["danse", "soirées", "musique"]],
  ["Ingénieur, joueur d'échecs et de jeux de société.", ["jeux", "échecs", "tech"]],
  ["Amoureuse des marchés et des petites terrasses.", ["marchés", "café", "tapas"]],
  ["Moniteur de surf, horaires flexibles.", ["surf", "plage", "sport"]],
  ["Je reprends le sport après une longue pause, motivé·e !", ["sport", "running", "nutrition"]],
  ["Cinéphile. Je préfère la VO et les petites salles.", ["cinéma", "séries", "tapas"]],
  ["Créatrice de bijoux, je cherche des ateliers et des gens créatifs.", ["artisanat", "expos", "céramique"]],
];


const used = new Set(["lea", "karim", "sofia", "noah", "ines", "marco", "yael", "lucas", "amira", "hugo", "elena", "tom", "nadia", "jules", "maya", "david", "clara", "sam", "rafael", "moderation"]);
const slugify = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

const faceIds = shuffle(Object.keys(faces).filter((k) => faces[k].g === "man" || faces[k].g === "woman"));
const peopleCount = faceIds.length || 84;
const people: { slug: string; name: string; city: string; bio: string; interests: string[]; face?: string; joinedDaysAgo: number }[] = [];
const wPool = shuffle([...women]); const mPool = shuffle([...men]);
const owPool = shuffle([...olderW]); const omPool = shuffle([...olderM]);
for (let i = 0; i < peopleCount; i++) {
  const face = faceIds[i];
  const f = face ? faces[face] : { g: r() < 0.5 ? "woman" : "man", age: "" };
  const older = /older|elderly/.test(f.age);
  const first = f.g === "woman" ? (older ? owPool.pop() : undefined) ?? wPool.pop() ?? pick(women) : (older ? omPool.pop() : undefined) ?? mPool.pop() ?? pick(men);
  let slug = slugify(first);
  let ini = pick([...initials]);
  while (used.has(slug)) { slug = slugify(first) + "." + ini.toLowerCase() + (used.has(slugify(first) + "." + ini.toLowerCase()) ? int(2, 99) : ""); ini = pick([...initials]); }
  used.add(slug);
  const [bio, interests] = bios[i % bios.length];
  const fixedBio = bio.replace(/·e|·ve/g, (m) => (f.g === "woman" ? (m === "·ve" ? "ve" : "e") : "")).replace(/actif ve/, "active");
  people.push({ slug, name: `${first} ${ini}.`, city: cityOf(), bio: fixedBio, interests, face, joinedDaysAgo: int(3, 120) });
}

type Tpl = [cat: string, title: string, desc: string, tags: string[], cap: [number, number], place: string];
const T: Tpl[] = [
  ["sunset", "Coucher de soleil au mirador", "On monte au mirador une heure avant le coucher du soleil, avec de quoi grignoter. Vue imprenable, ambiance tranquille.", ["chill", "en plein air"], [4, 10], "Mirador de la colline"],
  ["sunset", "Sunset & guitare sur la plage", "J'apporte ma guitare, vous apportez vos voix (même fausses). On reste jusqu'à la nuit.", ["musique", "chill", "rencontres"], [6, 12], "Plage du centre"],
  ["sunset", "Apéro sunset sur les rochers", "Petit spot secret sur les rochers, vue sur la mer et sur le soleil qui plonge. Chaussures confortables conseillées.", ["en plein air", "spontané"], [4, 8], "Rochers du phare"],
  ["sunset", "Pique-nique au coucher du soleil", "Chacun apporte un plat ou une boisson, on partage tout. Plaid fourni.", ["gourmand", "chill"], [6, 14], "Pelouse du front de mer"],
  ["sunset", "Sunset en kayak", "Sortie kayak tranquille d'une heure, retour à la plage à la tombée de la nuit. Location sur place.", ["sportif", "en plein air"], [4, 8], "Club nautique"],
  ["dinner", "Dîner italien fait maison", "Pâtes fraîches roulées à la main, tiramisu maison. On cuisine ensemble les 30 premières minutes.", ["gourmand", "intimiste"], [4, 6], "Chez moi"],
  ["dinner", "Paella du dimanche", "Grande paella au feu de bois pour ceux qui aiment les longues tablées. Participation aux courses.", ["gourmand", "rencontres"], [6, 10], "Patio de la maison"],
  ["dinner", "Dîner végétarien entre curieux", "Menu 100 % végétal, de saison, sans prise de tête. Parfait pour découvrir de nouvelles saveurs.", ["gourmand", "lent"], [4, 8], "Appartement avec terrasse"],
  ["dinner", "Table d'hôtes : cuisine marocaine", "Tajine, couscous et thé à la menthe, comme chez ma grand-mère. Ambiance familiale.", ["gourmand", "intimiste"], [4, 8], "Chez moi"],
  ["dinner", "Dîner de nouveaux arrivants", "Tu viens de t'installer ? On se retrouve dans un resto simple pour faire connaissance.", ["rencontres", "chill"], [6, 10], "Restaurant du port"],
  ["dinner", "Soirée sushis maison", "On apprend à rouler des makis ensemble. Tout le matériel est fourni, il suffit d'avoir faim.", ["gourmand", "créatif"], [4, 6], "Cuisine partagée"],
  ["drinks", "Afterwork en terrasse", "Un verre pour décompresser après la semaine, dans un bar avec une belle terrasse. On parle de tout sauf du travail.", ["rencontres", "chill"], [6, 12], "Bar à terrasse"],
  ["drinks", "Tournée des bars à tapas", "Trois bars, trois spécialités. On marche entre chaque étape, rythme cool.", ["gourmand", "festif"], [6, 10], "Départ devant la cathédrale"],
  ["drinks", "Dégustation de vermouth", "Le vermouth est de retour : on en goûte quatre avec des olives et des chips maison.", ["gourmand", "intimiste"], [4, 8], "Bodega du quartier"],
  ["drinks", "Speed-friending autour d'un verre", "On change de table toutes les 10 minutes pour rencontrer un maximum de monde. Zéro drague, que de l'amitié.", ["rencontres", "festif"], [10, 20], "Bar lounge"],
  ["drinks", "Bière artisanale et quiz", "Quiz de culture générale par équipes, dans une brasserie artisanale. Lots ridicules garantis.", ["festif", "rencontres"], [8, 16], "Brasserie artisanale"],
  ["drinks", "Cocktails sur un toit", "Un rooftop discret avec une vue folle. On reste deux heures, chacun paie ses verres.", ["festif", "musique"], [6, 10], "Rooftop de l'hôtel"],
  ["coffee", "Café langues : français / espagnol", "30 minutes en français, 30 minutes en espagnol. Tous niveaux, l'important c'est de parler.", ["rencontres", "lent"], [6, 12], "Café de la place"],
  ["coffee", "Coworking du mardi", "On se pose ensemble dans un café calme pour travailler, avec une pause déjeuner commune.", ["networking", "lent"], [4, 8], "Café coworking"],
  ["coffee", "Club de lecture", "Ce mois-ci, on parle d'un roman court. Pas lu ? Viens quand même, on te racontera.", ["créatif", "lent", "intimiste"], [5, 10], "Librairie-café"],
  ["coffee", "Café & croissants au marché", "Petit tour du marché couvert puis café en terrasse. Idéal pour démarrer le samedi.", ["gourmand", "chill"], [4, 8], "Marché couvert"],
  ["coffee", "Atelier aquarelle au café", "Une heure d'aquarelle guidée, matériel fourni. Aucun talent requis, promis.", ["créatif", "chill"], [4, 8], "Café des artistes"],
  ["brunch", "Brunch healthy après le sport", "Bols d'açaï, œufs, jus pressés. On peut venir sans avoir fait de sport, on ne dira rien.", ["gourmand", "sportif"], [4, 8], "Brunch café"],
  ["brunch", "Brunch des expats", "Le rendez-vous des nouveaux et des anciens sur la côte. Échange de bons plans assuré.", ["rencontres", "chill"], [8, 14], "Brunch spot du port"],
  ["brunch", "Brunch pancakes & jeux", "Pancakes à volonté et jeux de société rapides. Ambiance dimanche matin.", ["chill", "gourmand"], [6, 10], "Café ludique"],
  ["brunch", "Brunch fondateurs", "Chacun présente son projet en une minute, puis on mange. Bienveillance de rigueur.", ["networking", "rencontres"], [6, 12], "Hôtel boutique"],
  ["gallery", "Vernissage photo", "Vernissage d'une jeune photographe locale. On fait le tour ensemble puis on discute autour d'un verre.", ["créatif", "rencontres"], [6, 14], "Galerie du centre"],
  ["gallery", "Musée Picasso en petit groupe", "Visite libre en petit groupe, puis café pour échanger nos coups de cœur.", ["créatif", "lent"], [4, 8], "Musée Picasso"],
  ["gallery", "Atelier poterie", "Deux heures de tour de potier avec une artisane. Tu repars avec ta création (après cuisson).", ["créatif", "intimiste"], [4, 6], "Atelier de céramique"],
  ["gallery", "Street art tour", "Balade commentée des plus belles fresques du quartier. Appareil photo bienvenu.", ["créatif", "en plein air"], [6, 12], "Quartier des arts"],
  ["gallery", "Atelier peinture & vin", "On peint le même paysage, chacun à sa façon, un verre à la main. Fous rires garantis.", ["créatif", "festif"], [6, 10], "Atelier d'art"],
  ["walk", "Randonnée au lever du soleil", "Montée tranquille pour voir le soleil se lever sur la mer. Lampe frontale indispensable.", ["sportif", "en plein air"], [6, 12], "Parking du sentier"],
  ["walk", "Balade dans la vieille ville", "Patios fleuris, ruelles blanches, petites places : je vous montre mes coins préférés.", ["lent", "en plein air"], [6, 12], "Place principale"],
  ["walk", "Marche nordique en bord de mer", "Une heure de marche nordique, bâtons prêtés. Bon pour le cardio et le moral.", ["sportif", "en plein air"], [6, 12], "Promenade maritime"],
  ["walk", "Balade avec nos chiens", "Viens avec ton chien (ou sans) pour une balade sociable. Les chiens sociables seulement !", ["chill", "en plein air", "rencontres"], [6, 12], "Parc municipal"],
  ["walk", "Randonnée au Caminito", "Journée de rando sur des passerelles impressionnantes. Transport partagé depuis la ville.", ["sportif", "en plein air"], [4, 8], "Départ en covoiturage"],
  ["sport", "Padel débutants", "On joue en double, niveau débutant. Raquettes à prêter. On tourne les équipes.", ["sportif", "rencontres"], [3, 7], "Club de padel"],
  ["sport", "Volley sur la plage", "Volley détente sur le sable, filet installé. Tous niveaux, bonne humeur obligatoire.", ["sportif", "en plein air"], [6, 12], "Terrain de beach-volley"],
  ["sport", "Running 10 km le long de la mer", "Allure 5'30 à 6'00 min/km. On s'attend aux points de regroupement.", ["sportif", "en plein air"], [5, 15], "Départ devant le port"],
  ["sport", "Yoga au lever du soleil", "Une heure de vinyasa doux face à la mer. Apporte ta serviette ou ton tapis.", ["lent", "en plein air"], [6, 14], "Plage au pied du phare"],
  ["sport", "Session surf débutants", "Cours collectif d'initiation avec un moniteur, combinaison et planche fournies.", ["sportif", "en plein air"], [4, 8], "École de surf"],
  ["sport", "Sortie vélo sur la côte", "40 km en groupe, rythme modéré, pause café à mi-parcours. Casque obligatoire.", ["sportif", "en plein air"], [4, 10], "Départ du rond-point"],
  ["sport", "Escalade en salle", "Bloc en salle, initiation pour ceux qui découvrent. Chaussons en location.", ["sportif", "rencontres"], [4, 8], "Salle d'escalade"],
  ["party", "Soirée karaoké", "Salle privatisée, playlist interminable, aucun jugement. On chante faux ensemble.", ["festif", "musique"], [8, 16], "Bar karaoké"],
  ["party", "Soirée flamenco", "Spectacle de flamenco dans une peña authentique, puis verre dans le quartier.", ["musique", "festif"], [6, 12], "Peña flamenca"],
  ["party", "Soirée jeux de société", "Jeux faciles à apprendre, snacks et bonne ambiance. Apporte ton jeu préféré.", ["chill", "rencontres"], [6, 10], "Bar à jeux"],
  ["party", "Concert jazz en petit comité", "Trio jazz dans un bar intimiste. On réserve une table pour le groupe.", ["musique", "intimiste"], [4, 8], "Club de jazz"],
  ["party", "Soirée électro sur la plage", "DJ set au coucher du soleil, puis on danse pieds nus. Entrée libre au beach club.", ["festif", "musique"], [8, 20], "Beach club"],
  ["party", "Bachata pour débutants", "Une heure de cours puis soirée dansante. Viens seul·e, on tourne les partenaires.", ["musique", "festif", "rencontres"], [10, 20], "École de danse"],
  ["boat", "Balade en catamaran", "Trois heures en mer, baignade dans une crique si la mer le permet. Frais partagés.", ["en plein air", "chill"], [4, 8], "Port de plaisance"],
  ["boat", "Pêche au lever du jour", "Sortie de pêche en petit bateau. Débutants bienvenus, on garde ou on relâche.", ["en plein air", "lent"], [2, 4], "Ponton des pêcheurs"],
  ["boat", "Paddle jusqu'à la crique", "Une heure de paddle jusqu'à une petite crique, pause baignade et retour.", ["sportif", "en plein air"], [4, 8], "Location de paddle"],
  ["boat", "Sortie voilier au coucher du soleil", "Deux heures de voile tranquille au coucher du soleil, cava à bord.", ["chill", "en plein air"], [3, 6], "Marina"],
  ["other", "Ciné en plein air", "Projection d'un classique en VO sous les étoiles. Coussins conseillés.", ["chill", "rencontres"], [6, 14], "Terrasse du centre culturel"],
  ["other", "Atelier cuisine espagnole", "On apprend à faire des croquetas et un salmorejo avec une cheffe. Dégustation ensuite.", ["gourmand", "créatif"], [4, 8], "Cuisine-atelier"],
  ["other", "Bénévolat : nettoyage de plage", "Deux heures pour ramasser les déchets de la plage, puis café offert. Gants fournis.", ["en plein air", "rencontres"], [8, 20], "Plage principale"],
  ["other", "Soirée stand-up en anglais", "Scène ouverte d'humoristes de la côte. Fous rires (en anglais) assurés.", ["festif", "rencontres"], [6, 12], "Comedy bar"],
  ["other", "Visite d'une huilerie", "Visite d'un moulin à huile d'olive et dégustation. Covoiturage depuis la ville.", ["gourmand", "lent"], [4, 8], "Moulin à huile"],
  ["other", "Échange de plantes", "Apporte une bouture, repars avec une autre. Conseils de jardinage inclus.", ["chill", "créatif"], [6, 12], "Jardin partagé"],
];

const messages = [
  "Salut ! Ça me tente beaucoup, je peux apporter quelque chose ?",
  "Je viens d'arriver dans le coin, ce serait top de rencontrer du monde.",
  "Hello, j'ai déjà fait ce genre de sortie, partant·e !",
  "Super idée, je serai à l'heure promis.",
  "Je peux venir avec une amie ? Sinon je viens seule sans souci.",
  "Débutant total mais très motivé.",
  "Ça fait longtemps que je cherchais ce genre de Moment !",
  "Je parle français et espagnol, si ça peut aider.",
];

const textThemes = ["citrus", "forest", "ink", "ocean", "plum", "dusk"];
type Member = [string, "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED", "REQUEST" | "INVITE", string?];
const allSlugs = ["lea", "karim", "sofia", "noah", "ines", "marco", "yael", "lucas", "amira", "hugo", "elena", "tom", "nadia", "jules", "maya", "david", ...people.map((p) => p.slug)];
const guestsOnly = ["clara", "sam", "rafael"];

// Hôtes : environ 55 % de la foule organise 1 à 3 Moments.
const hosts = people.filter(() => r() < 0.55);
const moments: unknown[] = [];
let tplOrder = shuffle(T.map((_, i) => i));
let k = 0;
// Jours : plus de Moments sur les prochains jours et le week-end (relatif au jour du seed).
const dayPool = [-12, -9, -7, -6, -4, -3, -2, -1, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10, 11, 12, 13, 14];
for (const h of hosts) {
  const n = r() < 0.6 ? 1 : r() < 0.7 ? 2 : 3;
  for (let j = 0; j < n; j++) {
    if (tplOrder.length === 0) tplOrder = shuffle(T.map((_, i) => i));
    const [category, title, description, tags, [cmin, cmax], place] = T[tplOrder.pop()!];
    const city = r() < 0.75 ? h.city : cityOf();
    const area = pick(cityAreas[city]);
    const day = pick(dayPool);
    const hour = category === "sport" || category === "walk" ? pick(["07:30", "08:00", "09:00", "10:00", "18:30"]) : category === "coffee" || category === "brunch" ? pick(["09:30", "10:00", "11:00", "11:30"]) : category === "sunset" ? pick(["17:45", "18:00", "18:15"]) : category === "boat" ? pick(["09:00", "10:30", "16:00"]) : category === "gallery" ? pick(["11:00", "17:00", "18:30", "19:00"]) : pick(["19:30", "20:00", "20:30", "21:00", "21:30"]);
    const [hh, mm] = hour.split(":").map(Number);
    const dur = category === "boat" || (category === "walk" && /Caminito/.test(title)) ? 5 : category === "party" ? 4 : 2;
    const end = `${String((hh + dur) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const capacity = int(cmin, cmax);
    const vr = r();
    const visibility = vr < 0.6 ? "REQUEST" : vr < 0.92 ? "PUBLIC" : vr < 0.97 ? "INVITE_ONLY" : "PRIVATE";
    const mr = r();
    const media = mr < 0.82 ? "IMAGE" : "TEXT";
    const status = day >= 2 && r() < 0.04 ? "CANCELLED" : "PUBLISHED";
    // Participants
    const pool = shuffle(allSlugs.filter((x) => x !== h.slug));
    const fill = day < 0 ? 0.5 + r() * 0.5 : r() < 0.15 ? 1 : r() * 0.85;
    const accepted = Math.min(capacity, Math.round(capacity * fill));
    const members: Member[] = [];
    for (let a = 0; a < accepted; a++) members.push([pool.pop()!, "ACCEPTED", visibility === "INVITE_ONLY" || r() < 0.12 ? "INVITE" : "REQUEST"]);
    if (day >= 0 && status === "PUBLISHED") {
      const pend = visibility === "PUBLIC" ? 0 : visibility === "INVITE_ONLY" ? int(0, 2) : int(0, 3);
      for (let a = 0; a < pend; a++) members.push([pool.pop()!, "PENDING", visibility === "INVITE_ONLY" ? "INVITE" : "REQUEST", visibility === "INVITE_ONLY" || r() < 0.3 ? undefined : pick(messages)]);
      if (r() < 0.25) members.push([pool.pop()!, "DECLINED", "REQUEST"]);
      if (r() < 0.15) members.push([pool.pop()!, "CANCELLED", "REQUEST"]);
    }
    // Les participants-testeurs (Clara, Sam, Rafael) reçoivent quelques invitations et réponses.
    if (day >= 1 && status === "PUBLISHED" && visibility !== "PUBLIC" && r() < 0.22) {
      const g = pick(guestsOnly);
      if (!members.some((m) => m[0] === g)) members.push([g, pick(["PENDING", "PENDING", "ACCEPTED", "DECLINED"] as const), r() < 0.6 ? "INVITE" : "REQUEST"]);
    }
    moments.push({
      key: `c${String(++k).padStart(3, "0")}`,
      host: h.slug, title, description, category, tags, media,
      ...(media === "TEXT" ? { textTheme: pick(textThemes) } : {}),
      city, area, placeName: place,
      ...(r() < 0.45 ? { address: `${pick(["Calle", "Avenida", "Plaza", "Paseo"])} ${pick(["del Mar", "Real", "de la Constitución", "San Juan", "de los Naranjos", "Ricardo Soriano", "del Puerto", "Nueva"])} ${int(1, 80)}` } : {}),
      day, start: hour, end, capacity, visibility, status,
      ...(status === "CANCELLED" ? { cancelReason: pick(["Météo défavorable, on reporte.", "Imprévu de dernière minute, désolé !", "Pas assez de participants, on refait ça bientôt."]) } : {}),
      members,
    });
  }
}

process.stdout.write(JSON.stringify({ people, moments }, null, 1));
