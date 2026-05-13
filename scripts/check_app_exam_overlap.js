import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const examPath = path.resolve(projectRoot, "../exam/examen_etudiant_controle_acces_gestion_identite.md");
const appQuestionsPath = path.join(projectRoot, "src", "data", "questions.json");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`*_>#-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token.length > 2)
  );
}

function jaccard(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function extractExamQuestions(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(###|####)\s/.test(line))
    .map((line) => line.replace(/^(###|####)\s*/, ""))
    .filter((line) => /\.\s/.test(line))
    .map((line) => line.replace(/^[A-Z]?\d+(\.\d+)?\.\s*/, "").trim());
}

function flattenAppQuestions(entries) {
  const output = [];
  for (const item of entries) {
    if (Array.isArray(item.questions)) {
      for (const subQuestion of item.questions) {
        output.push({
          id: subQuestion.id,
          section: "C",
          category: item.category,
          question: `${item.title} — ${subQuestion.question}`,
          options: subQuestion.options.map((option) => option.text)
        });
      }
    } else {
      output.push({
        id: item.id,
        section: item.section,
        category: item.category,
        question: item.question,
        options: item.options.map((option) => option.text)
      });
    }
  }
  return output;
}

if (!fs.existsSync(examPath)) {
  console.error(`ERREUR: examen officiel introuvable à ${examPath}`);
  process.exit(1);
}

const examMarkdown = fs.readFileSync(examPath, "utf8");
const appQuestions = JSON.parse(fs.readFileSync(appQuestionsPath, "utf8"));

const examQuestions = extractExamQuestions(examMarkdown);
const flatAppQuestions = flattenAppQuestions(appQuestions);
const suspicious = [];

for (const question of flatAppQuestions) {
  const appNorm = normalize(question.question);
  const appTokens = tokenSet(question.question);
  for (const examQuestion of examQuestions) {
    const examNorm = normalize(examQuestion);
    const examTokens = tokenSet(examQuestion);
    const exactMatch = appNorm === examNorm && appNorm.length > 0;
    const similarity = jaccard(appTokens, examTokens);
    const strongOverlap = similarity >= 0.8 && appNorm.length > 45;
    const optionOverlap = question.options.filter((option) => examNorm.includes(normalize(option))).length;
    const longFragmentOverlap =
      appNorm.length > 45 && examNorm.length > 45 && (appNorm.includes(examNorm) || examNorm.includes(appNorm));

    if (exactMatch || strongOverlap || optionOverlap >= 3 || longFragmentOverlap) {
      suspicious.push({
        id: question.id,
        section: question.section,
        category: question.category,
        similarity: Number(similarity.toFixed(3)),
        optionOverlap,
        appQuestion: question.question,
        examQuestion
      });
      break;
    }
  }
}

console.log(`Questions application analysées : ${flatAppQuestions.length}`);
console.log(`Questions examen analysées : ${examQuestions.length}`);
console.log(`Questions suspectes : ${suspicious.length}`);

if (!suspicious.length) {
  console.log("Aucune question d'entraînement n'apparaît trop proche de l'examen officiel selon les seuils définis.");
} else {
  console.log("Questions à reformuler :");
  for (const item of suspicious.slice(0, 30)) {
    console.log(`- ${item.id} [${item.category}] similarité=${item.similarity} options=${item.optionOverlap}`);
    console.log(`  App : ${item.appQuestion}`);
    console.log(`  Exam: ${item.examQuestion}`);
  }
  process.exit(1);
}
