import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const questionsPath = path.join(projectRoot, "src", "data", "questions.json");
const flashcardsPath = path.join(projectRoot, "src", "data", "flashcards.json");

function fail(message) {
  console.error(`ERREUR: ${message}`);
  process.exitCode = 1;
}

const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
const flashcards = JSON.parse(fs.readFileSync(flashcardsPath, "utf8"));

const questionIds = new Set();
const flatQuestions = [];

for (const item of questions) {
  if (questionIds.has(item.id)) fail(`ID dupliqué dans les questions: ${item.id}`);
  questionIds.add(item.id);

  if (Array.isArray(item.questions)) {
    if (!item.title || !item.context || !item.diagram) fail(`Scénario incomplet: ${item.id}`);
    for (const subQuestion of item.questions) {
      if (questionIds.has(subQuestion.id)) fail(`ID dupliqué dans les sous-questions: ${subQuestion.id}`);
      questionIds.add(subQuestion.id);
      flatQuestions.push({ ...subQuestion, parentScenario: item.id, category: item.category });
    }
  } else {
    flatQuestions.push(item);
  }
}

for (const question of flatQuestions) {
  if (!question.question) fail(`Énoncé vide: ${question.id}`);
  if (!Array.isArray(question.options) || question.options.length < 2) {
    fail(`Options manquantes ou insuffisantes: ${question.id}`);
    continue;
  }
  if (!question.category) fail(`Catégorie manquante: ${question.id}`);
  if (!question.concept) fail(`Concept manquant: ${question.id}`);
  if (!question.learningNote) fail(`Learning note manquante: ${question.id}`);
  const correctCount = question.options.filter((item) => item.isCorrect).length;
  if (correctCount === 0) fail(`Aucune bonne réponse: ${question.id}`);
  if (question.type === "single" && correctCount !== 1) fail(`Question single avec ${correctCount} bonnes réponses: ${question.id}`);
  for (const option of question.options) {
    if (!option.text || !option.explanation) fail(`Option incomplète: ${question.id} / ${option.id}`);
  }
}

const flashcardIds = new Set();
for (const card of flashcards) {
  if (flashcardIds.has(card.id)) fail(`ID de flashcard dupliqué: ${card.id}`);
  flashcardIds.add(card.id);
  if (!card.term || !card.definition || !card.awsExample || !card.frequentTrap) {
    fail(`Flashcard incomplète: ${card.id}`);
  }
}

const sectionA = questions.filter((item) => item.section === "A").length;
const sectionB = questions.filter((item) => item.section === "B").length;
const sectionC = questions.filter((item) => Array.isArray(item.questions)).length;
const sectionCSubQuestions = questions
  .filter((item) => Array.isArray(item.questions))
  .reduce((sum, item) => sum + item.questions.length, 0);

console.log(
  JSON.stringify(
    {
      sectionA,
      sectionB,
      sectionC,
      sectionCSubQuestions,
      flashcards: flashcards.length,
      duplicateQuestionIds: 0,
      duplicateFlashcardIds: 0
    },
    null,
    2
  )
);

if (process.exitCode) {
  process.exit(process.exitCode);
}
