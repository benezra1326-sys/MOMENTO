import { describe, expect, it } from "vitest";
import { parseWithRules } from "@/server/ai";

const now = new Date("2026-11-27T14:00:00Z"); // vendredi

describe("assistant de création (règles)", () => {
  it("transforme une envie en dispo structurée", () => {
    const d = parseWithRules("J'ai envie de faire quelque chose samedi soir à Marbella, plutôt chic, avec des gens intéressants.", { now });
    expect(d.kind).toBe("availability");
    expect(d.date).toBe("2026-11-28");
    expect(d.slot).toBe("evening");
    expect(d.city).toBe("Marbella");
    expect(d.vibeTags).toContain("rencontres");
  });
  it("reconnaît un Moment avec places restantes", () => {
    const d = parseWithRules("On est quatre à Marbella demain, il nous reste 2 places pour un dîner sympa.", { now });
    expect(d.kind).toBe("moment");
    expect(d.category).toBe("dinner");
    expect(d.capacity).toBe(2);
    expect(d.date).toBe("2026-11-28");
  });
  it("lit l'heure, le sport et le jour", () => {
    const d = parseWithRules("Dispo demain 18h pour un match de padel", { now });
    expect(d.kind).toBe("availability");
    expect(d.category).toBe("sport");
    expect(d.time).toBe("18:00");
    expect(d.slot).toBe("afternoon");
  });
  it("propose un Moment avec capacité", () => {
    const d = parseWithRules("Je propose un rooftop au coucher du soleil ce soir à Golden Mile pour 6", { now });
    expect(d.kind).toBe("moment");
    expect(d.category).toBe("sunset");
    expect(d.capacity).toBe(5);
    expect(d.date).toBe("2026-11-27");
    expect(d.area).toBe("Golden Mile");
  });
  it("classe une proposition libertine dans l'espace adulte", () => {
    const d = parseWithRules("Couple ouvert, on propose une soirée au club libertin samedi 23h", { now });
    expect(d.category).toBe("adult");
    expect(d.time).toBe("23:00");
  });
});

describe("titre proposé par les règles", () => {
  it("retire le jour, l'heure et le nombre de personnes", () => {
    const d = parseWithRules("Apéro sunset samedi vers 19 h à Puerto Banús, 4 personnes", { now: new Date("2026-11-27T10:00:00Z"), tz: "Europe/Madrid", defaultCity: "Marbella", kind: "auto" });
    expect(d.title).toBe("Apéro sunset à Puerto Banús");
    const p = parseWithRules("Padel dimanche matin, il me manque 2 joueurs", { now: new Date("2026-11-27T10:00:00Z"), tz: "Europe/Madrid", defaultCity: "Marbella", kind: "auto" });
    expect(p.title).toBe("Padel");
  });
});
