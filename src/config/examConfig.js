export const EXAM_CONFIG = {
  durationMinutes: 120,
  sections: {
    A: { count: 32, label: "Section A — Questions courtes" },
    B: { count: 10, label: "Section B — Questions moyennes" },
    C: { count: 5, label: "Section C — Scénarios" }
  },
  scoring: {
    correct: 1,
    wrong: 0,
    empty: 0,
    multipleMode:
      "Pour les QRM, chaque proposition est évaluée indépendamment : une proposition correcte cochée vaut +1, une proposition incorrecte laissée décochée vaut +1, sinon 0."
  }
};
