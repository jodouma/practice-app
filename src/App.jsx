import React, { useEffect, useMemo, useState } from "react";
import questionsData from "./data/questions.json";
import flashcardsData from "./data/flashcards.json";
import { EXAM_CONFIG } from "./config/examConfig";

const STORAGE_KEYS = {
  activeSimulation: "caig_v3_active_simulation",
  history: "caig_v3_history",
  mistakes: "caig_v3_mistakes",
  flashcards: "caig_v3_flashcards",
  lastResult: "caig_v3_last_result"
};

function readStorageJson(key, fallback) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    return safeParse(window.localStorage.getItem(key), fallback);
  } catch (error) {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // ignore storage write failures in restricted browsers
  }
}

function removeStorageItem(key) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch (error) {
    // ignore storage removal failures in restricted browsers
  }
}

const DEFAULT_VIEW = "home";
const LEARN_SECTION_FILTERS = [
  { id: "all", label: "Toutes les questions" },
  { id: "A", label: "Questions courtes" },
  { id: "B", label: "Questions moyennes" },
  { id: "SCENARIO", label: "Sous-questions de scénarios" }
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureSimulation(value) {
  if (!value || typeof value !== "object") return null;
  if (!Array.isArray(value.units)) return null;
  return {
    ...value,
    flaggedUnitIds: Array.isArray(value.flaggedUnitIds) ? value.flaggedUnitIds : [],
    answersById: ensureRecord(value.answersById),
    currentUnitIndex: typeof value.currentUnitIndex === "number" ? value.currentUnitIndex : 0,
    durationSeconds: typeof value.durationSeconds === "number" ? value.durationSeconds : EXAM_CONFIG.durationMinutes * 60
  };
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleItems(array, count) {
  return shuffle(array).slice(0, count);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createQuestionSnapshot(question) {
  return {
    ...deepClone(question),
    options: shuffle(deepClone(question.options))
  };
}

function createScenarioSnapshot(scenario) {
  return {
    ...deepClone(scenario),
    questions: scenario.questions.map((question) => createQuestionSnapshot(question))
  };
}

function getQuestionMaxScore(question) {
  return question.type === "multiple" ? question.options.length : 1;
}

function isAnswerEmpty(question, answer) {
  if (question.type === "multiple") {
    return !Array.isArray(answer) || answer.length === 0;
  }
  return !answer;
}

function scoreQuestion(question, answer) {
  const max = getQuestionMaxScore(question);
  if (question.type === "single") {
    const selected = answer || "";
    const correct = question.options.find((option) => option.isCorrect);
    return {
      score: correct && selected === correct.id ? 1 : 0,
      max,
      isEmpty: !selected
    };
  }

  const selectedIds = new Set(Array.isArray(answer) ? answer : []);
  let score = 0;
  for (const option of question.options) {
    const isSelected = selectedIds.has(option.id);
    if ((option.isCorrect && isSelected) || (!option.isCorrect && !isSelected)) {
      score += 1;
    }
  }
  return {
    score,
    max,
    isEmpty: selectedIds.size === 0
  };
}

function getQuestionFeedback(question, answer) {
  const { score, max, isEmpty } = scoreQuestion(question, answer);
  const correctOptions = question.options.filter((option) => option.isCorrect);
  return {
    score,
    max,
    isEmpty,
    isPerfect: score === max,
    correctOptions
  };
}

function getCorrectOptionIds(question) {
  return question.options.filter((option) => option.isCorrect).map((option) => option.id);
}

function getCorrectOptionTexts(question) {
  return question.options.filter((option) => option.isCorrect).map((option) => `${option.id}. ${option.text}`);
}

function getQuestionInstruction(question) {
  return question.type === "multiple"
    ? "Cochez toutes les réponses que vous jugez correctes."
    : "Une seule réponse est attendue.";
}

function flattenPracticePool(allQuestions) {
  const simpleQuestions = [];
  const scenarios = [];

  for (const item of allQuestions) {
    if (Array.isArray(item.questions)) {
      scenarios.push(item);
      for (const subQuestion of item.questions) {
        simpleQuestions.push({
          ...deepClone(subQuestion),
          sourceSection: "C",
          category: item.category,
          scenarioId: item.id,
          scenarioTitle: item.title,
          scenarioContext: item.context,
          scenarioDiagram: item.diagram,
          learningNote: subQuestion.learningNote || `Contexte scénario : ${item.title}`
        });
      }
    } else {
      simpleQuestions.push({
        ...deepClone(item),
        sourceSection: item.section
      });
    }
  }

  return {
    pool: simpleQuestions,
    scenarios
  };
}

function buildSimulationSession(allQuestions) {
  const sectionAQuestions = allQuestions.filter((item) => item.section === "A");
  const sectionBQuestions = allQuestions.filter((item) => item.section === "B");
  const sectionCScenarios = allQuestions.filter((item) => Array.isArray(item.questions));

  const selectedA = sampleItems(sectionAQuestions, EXAM_CONFIG.sections.A.count).map(createQuestionSnapshot);
  const selectedB = sampleItems(sectionBQuestions, EXAM_CONFIG.sections.B.count).map(createQuestionSnapshot);
  const selectedC = sampleItems(sectionCScenarios, EXAM_CONFIG.sections.C.count).map(createScenarioSnapshot);

  const units = [
    ...selectedA.map((question) => ({ kind: "question", section: "A", ...question })),
    ...selectedB.map((question) => ({ kind: "question", section: "B", ...question })),
    ...selectedC.map((scenario) => ({ kind: "scenario", section: "C", ...scenario }))
  ];

  return {
    id: `simulation-${Date.now()}`,
    mode: "simulation",
    startedAt: Date.now(),
    durationSeconds: EXAM_CONFIG.durationMinutes * 60,
    currentUnitIndex: 0,
    flaggedUnitIds: [],
    units,
    answersById: {},
    completed: false,
    autoSavedAt: Date.now()
  };
}

function getScenarioPromptCount(scenario) {
  return scenario.questions.length;
}

function getUnitPromptCount(unit) {
  return unit.kind === "scenario" ? getScenarioPromptCount(unit) : 1;
}

function getTotalPromptCount(session) {
  return session.units.reduce((total, unit) => total + getUnitPromptCount(unit), 0);
}

function getAnsweredPromptCount(session) {
  let count = 0;
  for (const unit of session.units) {
    if (unit.kind === "scenario") {
      for (const question of unit.questions) {
        if (!isAnswerEmpty(question, session.answersById[question.id])) {
          count += 1;
        }
      }
    } else if (!isAnswerEmpty(unit, session.answersById[unit.id])) {
      count += 1;
    }
  }
  return count;
}

function getCurrentSimulationSection(session) {
  const unit = session.units[session.currentUnitIndex];
  return unit ? unit.section : "A";
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function buildItemDetails(question, answer) {
  const feedback = getQuestionFeedback(question, answer);
  return {
    id: question.id,
    category: question.category,
    concept: question.concept,
    question: question.question,
    sourceSection: question.sourceSection || question.section,
    learningNote: question.learningNote,
    options: question.options,
    answer: answer || (question.type === "multiple" ? [] : ""),
    ...feedback
  };
}

function summarizeResults(units, answersById, startedAt, endedAt) {
  const sectionScores = {
    A: { raw: 0, max: 0, answered: 0 },
    B: { raw: 0, max: 0, answered: 0 },
    C: { raw: 0, max: 0, answered: 0 }
  };

  const categoryScores = {};
  const conceptScores = {};
  const reviewItems = [];
  const masteredItems = [];
  const mistakeIds = [];

  let rawScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let emptyCount = 0;
  const detailedUnits = [];

  function register(category, concept, score, max, isEmpty, isPerfect) {
    rawScore += score;
    maxScore += max;
    if (isEmpty) {
      emptyCount += 1;
    } else if (isPerfect) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }

    categoryScores[category] = categoryScores[category] || { raw: 0, max: 0 };
    categoryScores[category].raw += score;
    categoryScores[category].max += max;

    conceptScores[concept] = conceptScores[concept] || { raw: 0, max: 0 };
    conceptScores[concept].raw += score;
    conceptScores[concept].max += max;
  }

  for (const unit of units) {
    if (unit.kind === "scenario") {
      const scenarioDetails = {
        id: unit.id,
        kind: "scenario",
        section: unit.section,
        title: unit.title,
        context: unit.context,
        category: unit.category,
        diagram: unit.diagram,
        questionDetails: []
      };
      for (const question of unit.questions) {
        const detail = buildItemDetails(question, answersById[question.id]);
        scenarioDetails.questionDetails.push(detail);
        sectionScores.C.raw += detail.score;
        sectionScores.C.max += detail.max;
        if (!detail.isEmpty) {
          sectionScores.C.answered += 1;
        }
        register(question.category || unit.category, question.concept || unit.title, detail.score, detail.max, detail.isEmpty, detail.isPerfect);
        if (!detail.isPerfect) {
          mistakeIds.push(question.id);
          reviewItems.push(detail);
        } else {
          masteredItems.push(detail);
        }
      }
      detailedUnits.push(scenarioDetails);
    } else {
      const detail = buildItemDetails(unit, answersById[unit.id]);
      sectionScores[unit.section].raw += detail.score;
      sectionScores[unit.section].max += detail.max;
      if (!detail.isEmpty) {
        sectionScores[unit.section].answered += 1;
      }
      register(unit.category, unit.concept, detail.score, detail.max, detail.isEmpty, detail.isPerfect);
      if (!detail.isPerfect) {
        mistakeIds.push(unit.id);
        reviewItems.push(detail);
      } else {
        masteredItems.push(detail);
      }
      detailedUnits.push({
        id: unit.id,
        kind: "question",
        section: unit.section,
        category: unit.category,
        detail
      });
    }
  }

  const percent = maxScore ? (rawScore / maxScore) * 100 : 0;
  const note20 = maxScore ? (rawScore / maxScore) * 20 : 0;
  const byCategory = Object.entries(categoryScores)
    .map(([name, stats]) => ({
      name,
      ...stats,
      ratio: stats.max ? stats.raw / stats.max : 0
    }))
    .sort((a, b) => b.ratio - a.ratio);

  const byConcept = Object.entries(conceptScores)
    .map(([name, stats]) => ({
      name,
      ...stats,
      ratio: stats.max ? stats.raw / stats.max : 0
    }))
    .sort((a, b) => b.ratio - a.ratio);

  return {
    rawScore,
    maxScore,
    percent,
    note20,
    correctCount,
    incorrectCount,
    emptyCount,
    sectionScores,
    byCategory,
    byConcept,
    reviewItems,
    masteredItems,
    mistakeIds,
    detailedUnits,
    startedAt,
    endedAt,
    usedSeconds: Math.max(1, Math.round((endedAt - startedAt) / 1000))
  };
}

function buildMistakeLookup(practicePool) {
  return Object.fromEntries(practicePool.map((question) => [question.id, question]));
}

function buildLearnSession(pool, category, sectionFilter, label) {
  return {
    id: `learn-${Date.now()}`,
    mode: "learn",
    startedAt: Date.now(),
    category,
    sectionFilter,
    label,
    questions: shuffle(pool),
    currentIndex: 0,
    answersById: {},
    resultsById: {},
    completed: false
  };
}

function buildFlashcardSession(cards) {
  return {
    cards: shuffle(cards),
    currentIndex: 0,
    revealed: false
  };
}

function ResultBar({ label, value, max, accent = "blue" }) {
  const ratio = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="result-bar">
      <div className="result-bar-header">
        <span>{label}</span>
        <strong>
          {value} / {max}
        </strong>
      </div>
      <div className="result-bar-track">
        <div className={`result-bar-fill result-bar-fill-${accent}`} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function ProgressBar({ value, max, label }) {
  const ratio = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-card">
      <div className="progress-label-row">
        <span>{label}</span>
        <strong>{ratio}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function Timer({ remainingSeconds }) {
  const warning = remainingSeconds <= 15 * 60;
  const danger = remainingSeconds <= 5 * 60;
  return (
    <div className={`timer-card ${warning ? "timer-warning" : ""} ${danger ? "timer-danger" : ""}`}>
      <span>Temps restant</span>
      <strong>{formatDuration(remainingSeconds)}</strong>
    </div>
  );
}

function QuestionOptions({ question, value, onChange, disabled = false, reveal = false }) {
  if (question.type === "single") {
    return (
      <div className="option-grid">
        {question.options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`option-card ${selected ? "option-card-selected" : ""} ${reveal ? optionClassReveal(option, selected) : ""}`}
              onClick={() => !disabled && onChange(option.id)}
              disabled={disabled}
            >
              <span className="option-letter">{option.id}</span>
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const selectedSet = new Set(Array.isArray(value) ? value : []);
  return (
    <div className="option-grid">
      {question.options.map((option) => {
        const selected = selectedSet.has(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={`option-card ${selected ? "option-card-selected" : ""} ${reveal ? optionClassReveal(option, selected) : ""}`}
            onClick={() => {
              if (disabled) return;
              const next = new Set(selectedSet);
              if (selected) {
                next.delete(option.id);
              } else {
                next.add(option.id);
              }
              onChange([...next]);
            }}
            disabled={disabled}
          >
            <span className="option-letter">{option.id}</span>
            <span>{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function optionClassReveal(option, selected) {
  if (option.isCorrect && selected) return "option-card-good";
  if (option.isCorrect && !selected) return "option-card-good-unselected";
  if (!option.isCorrect && selected) return "option-card-bad";
  return "";
}

function OptionExplanations({ question, answer }) {
  const selectedSet = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
  return (
    <div className="explanation-list">
      {question.options.map((option) => {
        const selected = selectedSet.has(option.id);
        return (
          <div key={option.id} className={`explanation-item ${optionClassReveal(option, selected)}`}>
            <strong>
              {option.id}. {option.text}
            </strong>
            <div className="explanation-tags">
              {option.isCorrect && <span className="explanation-tag explanation-tag-good">Réponse correcte</span>}
              {!option.isCorrect && selected && (
                <span className="explanation-tag explanation-tag-bad">Choix risqué / non adapté</span>
              )}
              {option.isCorrect && !selected && (
                <span className="explanation-tag explanation-tag-missed">À retenir</span>
              )}
            </div>
            <p>{option.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}

function LearnFeedbackSummary({ question, answer, feedback }) {
  const correctIds = getCorrectOptionIds(question);
  const correctTexts = getCorrectOptionTexts(question);
  const selected = Array.isArray(answer) ? answer : answer ? [answer] : [];
  return (
    <div className="learning-summary-card">
      <div className="learning-summary-grid">
        <div>
          <span className="summary-label">Score obtenu</span>
          <strong>
            {feedback.score}/{feedback.max}
          </strong>
        </div>
        <div>
          <span className="summary-label">Bonne réponse attendue</span>
          <strong>{correctIds.join(", ")}</strong>
        </div>
        <div>
          <span className="summary-label">Votre sélection</span>
          <strong>{selected.length ? selected.join(", ") : "Aucune réponse"}</strong>
        </div>
      </div>
      <p className="learning-summary-note">
        <strong>Notion clé :</strong> {question.concept}
      </p>
      <p className="learning-summary-note">
        <strong>Réponse(s) à retenir :</strong> {correctTexts.join(" | ")}
      </p>
      <p className="learning-summary-note">{question.learningNote}</p>
      <p className="learning-summary-note">
        {feedback.isPerfect
          ? "Bonne réponse. Vous pouvez maintenant passer à une question similaire pour consolider le raisonnement."
          : "La réponse correcte apparaît en vert. Les choix sélectionnés à tort apparaissent en rouge pour vous aider à comprendre le piège."}
      </p>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error && error.message ? error.message : "Erreur inconnue"
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell">
          <div className="surface main-panel">
            <div className="section-badge">Problème d'affichage</div>
            <h2>L'application a rencontré une erreur dans ce navigateur.</h2>
            <p>
              Essayez de recharger la page. Si le problème persiste, videz le stockage local du site
              ou relancez l'application.
            </p>
            <pre className="diagram-box">{this.state.message}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [history, setHistory] = useState(() => ensureArray(readStorageJson(STORAGE_KEYS.history, [])));
  const [mistakeRegistry, setMistakeRegistry] = useState(() => ensureRecord(readStorageJson(STORAGE_KEYS.mistakes, {})));
  const [flashcardProgress, setFlashcardProgress] = useState(() =>
    ensureRecord(readStorageJson(STORAGE_KEYS.flashcards, {}))
  );
  const [activeSimulation, setActiveSimulation] = useState(() =>
    ensureSimulation(readStorageJson(STORAGE_KEYS.activeSimulation, null))
  );
  const [lastResult, setLastResult] = useState(() => readStorageJson(STORAGE_KEYS.lastResult, null));
  const [now, setNow] = useState(Date.now());
  const [learnCategory, setLearnCategory] = useState("Toutes");
  const [learnSectionFilter, setLearnSectionFilter] = useState("all");
  const [learnSession, setLearnSession] = useState(null);
  const [flashcardSession, setFlashcardSession] = useState(() => buildFlashcardSession(flashcardsData));
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const { pool: practicePool } = useMemo(() => flattenPracticePool(questionsData), []);
  const mistakeLookup = useMemo(() => buildMistakeLookup(practicePool), [practicePool]);
  const categories = useMemo(
    () => ["Toutes", ...Array.from(new Set(practicePool.map((question) => question.category))).sort((a, b) => a.localeCompare(b, "fr"))],
    [practicePool]
  );

  useEffect(() => {
    writeStorageJson(STORAGE_KEYS.history, history);
  }, [history]);

  useEffect(() => {
    writeStorageJson(STORAGE_KEYS.mistakes, mistakeRegistry);
  }, [mistakeRegistry]);

  useEffect(() => {
    writeStorageJson(STORAGE_KEYS.flashcards, flashcardProgress);
  }, [flashcardProgress]);

  useEffect(() => {
    if (activeSimulation) {
      writeStorageJson(STORAGE_KEYS.activeSimulation, { ...activeSimulation, autoSavedAt: Date.now() });
    } else {
      removeStorageItem(STORAGE_KEYS.activeSimulation);
    }
  }, [activeSimulation]);

  useEffect(() => {
    if (lastResult) {
      writeStorageJson(STORAGE_KEYS.lastResult, lastResult);
    } else {
      removeStorageItem(STORAGE_KEYS.lastResult);
    }
  }, [lastResult]);

  useEffect(() => {
    if (view !== "simulation" || !activeSimulation || activeSimulation.completed) return undefined;
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [view, activeSimulation]);

  const simulationRemainingSeconds = useMemo(() => {
    if (!activeSimulation || activeSimulation.completed) return EXAM_CONFIG.durationMinutes * 60;
    const elapsed = Math.floor((now - activeSimulation.startedAt) / 1000);
    return Math.max(0, activeSimulation.durationSeconds - elapsed);
  }, [activeSimulation, now]);

  useEffect(() => {
    if (view !== "simulation" || !activeSimulation || activeSimulation.completed) return;
    if (simulationRemainingSeconds === 0) {
      finalizeSimulation("Temps écoulé");
    }
  }, [simulationRemainingSeconds, view, activeSimulation]);

  function updateMistakesFromDetails(reviewItems) {
    setMistakeRegistry((prev) => {
      const next = { ...prev };
      for (const item of reviewItems) {
        next[item.id] = {
          id: item.id,
          category: item.category,
          concept: item.concept,
          question: item.question,
          count: (next[item.id]?.count || 0) + 1,
          lastMissedAt: Date.now()
        };
      }
      return next;
    });
  }

  function startSimulation() {
    const session = buildSimulationSession(questionsData);
    setActiveSimulation(session);
    setLastResult(null);
    setView("simulation");
  }

  function resumeSimulation() {
    if (activeSimulation) {
      setView("simulation");
    }
  }

  function discardSimulation() {
    setActiveSimulation(null);
  }

  function updateSimulationAnswer(question, value) {
    setActiveSimulation((prev) => ({
      ...prev,
      autoSavedAt: Date.now(),
      answersById: {
        ...prev.answersById,
        [question.id]: value
      }
    }));
  }

  function toggleFlag(unitId) {
    setActiveSimulation((prev) => {
      const flagged = prev.flaggedUnitIds.includes(unitId)
        ? prev.flaggedUnitIds.filter((item) => item !== unitId)
        : [...prev.flaggedUnitIds, unitId];
      return { ...prev, flaggedUnitIds: flagged, autoSavedAt: Date.now() };
    });
  }

  function goToSimulationUnit(index) {
    setActiveSimulation((prev) => ({
      ...prev,
      autoSavedAt: Date.now(),
      currentUnitIndex: Math.min(Math.max(index, 0), prev.units.length - 1)
    }));
  }

  function finalizeSimulation(reason = "Terminé") {
    setActiveSimulation((current) => {
      if (!current || current.completed) return current;
      const result = summarizeResults(current.units, current.answersById, current.startedAt, Date.now());
      const historyEntry = {
        id: current.id,
        mode: "Simulation examen",
        reason,
        startedAt: current.startedAt,
        endedAt: result.endedAt,
        usedSeconds: result.usedSeconds,
        rawScore: result.rawScore,
        maxScore: result.maxScore,
        note20: result.note20,
        percent: result.percent,
        sectionScores: result.sectionScores,
        categoryScores: result.byCategory,
        correctCount: result.correctCount,
        incorrectCount: result.incorrectCount,
        emptyCount: result.emptyCount,
        reviewItems: result.reviewItems,
        masteredItems: result.masteredItems,
        detail: result
      };
      setHistory((prev) => [historyEntry, ...prev].slice(0, 25));
      updateMistakesFromDetails(result.reviewItems);
      setLastResult(historyEntry);
      setView("results");
      return null;
    });
  }

  function filteredLearnPool() {
    const sectionNormalized = learnSectionFilter;
    let pool = practicePool;
    if (learnCategory !== "Toutes") {
      pool = pool.filter((question) => question.category === learnCategory);
    }
    if (sectionNormalized !== "all") {
      if (sectionNormalized === "SCENARIO") {
        pool = pool.filter((question) => question.sourceSection === "C");
      } else {
        pool = pool.filter((question) => question.sourceSection === sectionNormalized);
      }
    }
    return pool;
  }

  function startLearnSession(customPool = null, label = "Répondre et apprendre") {
    const sourcePool = customPool || filteredLearnPool();
    if (!sourcePool.length) return;
    setLearnSession(buildLearnSession(sourcePool, learnCategory, learnSectionFilter, label));
    setView("learn");
  }

  function updateLearnAnswer(questionId, value) {
    setLearnSession((prev) => ({
      ...prev,
      answersById: {
        ...prev.answersById,
        [questionId]: value
      }
    }));
  }

  function submitLearnQuestion() {
    setLearnSession((prev) => {
      const question = prev.questions[prev.currentIndex];
      const answer = prev.answersById[question.id];
      const feedback = getQuestionFeedback(question, answer);
      const nextResults = {
        ...prev.resultsById,
        [question.id]: feedback
      };
      if (!feedback.isPerfect) {
        updateMistakesFromDetails([buildItemDetails(question, answer)]);
      }
      return {
        ...prev,
        resultsById: nextResults
      };
    });
  }

  function nextLearnQuestion(preferSimilar = false) {
    setLearnSession((prev) => {
      if (!prev) return prev;
      let nextIndex = prev.currentIndex + 1;
      if (preferSimilar) {
        const current = prev.questions[prev.currentIndex];
        const found = prev.questions.findIndex(
          (question, index) =>
            index !== prev.currentIndex &&
            question.category === current.category &&
            question.concept === current.concept &&
            !prev.resultsById[question.id]
        );
        if (found >= 0) {
          nextIndex = found;
        }
      }
      if (nextIndex >= prev.questions.length) {
        const detailed = prev.questions.map((question) =>
          buildItemDetails(question, prev.answersById[question.id])
        );
        const rawScore = detailed.reduce((sum, item) => sum + item.score, 0);
        const maxScore = detailed.reduce((sum, item) => sum + item.max, 0);
        const entry = {
          id: prev.id,
          mode: prev.label,
          startedAt: prev.startedAt,
          endedAt: Date.now(),
          usedSeconds: Math.round((Date.now() - prev.startedAt) / 1000),
          rawScore,
          maxScore,
          note20: maxScore ? (rawScore / maxScore) * 20 : 0,
          percent: maxScore ? (rawScore / maxScore) * 100 : 0,
          reviewItems: detailed.filter((item) => !item.isPerfect),
          detail: { detailedUnits: detailed }
        };
        setHistory((historyPrev) => [entry, ...historyPrev].slice(0, 25));
        setLastResult(entry);
        setView("results");
        return null;
      }
      return {
        ...prev,
        currentIndex: nextIndex
      };
    });
  }

  function startMistakeReview() {
    const ids = Object.keys(mistakeRegistry);
    const pool = ids.map((id) => mistakeLookup[id]).filter(Boolean);
    if (!pool.length) return;
    startLearnSession(pool, "Refaire mes erreurs");
  }

  function openHistoryDetails(id) {
    setSelectedHistoryId(id);
    setView("history");
  }

  function clearHistory() {
    setHistory([]);
    setSelectedHistoryId(null);
  }

  function clearMistakes() {
    setMistakeRegistry({});
  }

  function removeMistake(id) {
    setMistakeRegistry((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function rateFlashcard(status) {
    const card = flashcardSession.cards[flashcardSession.currentIndex];
    setFlashcardProgress((prev) => ({
      ...prev,
      [card.id]: {
        status,
        updatedAt: Date.now()
      }
    }));
    setFlashcardSession((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.cards.length,
      revealed: false
    }));
  }

  const selectedHistory = history.find((item) => item.id === selectedHistoryId) || history[0] || null;
  const mistakesList = Object.values(mistakeRegistry).sort((a, b) => b.count - a.count);

  const simulationProgress = activeSimulation
    ? {
        answered: getAnsweredPromptCount(activeSimulation),
        total: getTotalPromptCount(activeSimulation),
        section: getCurrentSimulationSection(activeSimulation)
      }
    : null;

  const currentSimulationUnit = activeSimulation ? activeSimulation.units[activeSimulation.currentUnitIndex] : null;
  const currentLearnQuestion = learnSession ? learnSession.questions[learnSession.currentIndex] : null;
  const currentLearnFeedback = currentLearnQuestion ? learnSession?.resultsById[currentLearnQuestion.id] : null;
  const flashcard = flashcardSession.cards[flashcardSession.currentIndex];

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-topline">Master M1 Big Data & Cybersécurité</div>
        <h1>Préparation active — Contrôle d'accès et gestion d'identité</h1>
        <p>
          Trois modes de travail, une logique de score claire et une progression sauvegardée
          automatiquement. L'application entraîne les mêmes compétences que l'examen sans en
          reprendre les questions exactes.
        </p>
        <nav className="nav-tabs">
          {[
            ["home", "Accueil"],
            ["simulation", "Simulation"],
            ["learn", "Répondre et apprendre"],
            ["flashcards", "Révision rapide"],
            ["history", "Historique"],
            ["mistakes", "Mes erreurs"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`nav-tab ${view === id ? "nav-tab-active" : ""}`}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {view === "home" && (
        <main className="dashboard-grid">
          <section className="surface home-panel home-panel-large">
            <div className="section-badge">Simulation de 2h</div>
            <h2>Mode examen</h2>
            <p>
              Vous êtes en conditions d'examen : les corrections seront visibles à la fin. Les
              questions sont tirées aléatoirement, le timer tourne sur 2h et la session se sauvegarde
              toute seule.
            </p>
            <ul className="feature-list">
              <li>32 questions courtes, 10 questions moyennes, 5 scénarios.</li>
              <li>Retour arrière, questions à revoir, reprise après refresh.</li>
              <li>Résultats détaillés : score brut, note sur 20, sections, catégories et notions à revoir.</li>
            </ul>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={startSimulation}>
                Commencer la simulation
              </button>
              {activeSimulation && (
                <>
                  <button type="button" className="ghost-button" onClick={resumeSimulation}>
                    Reprendre la session
                  </button>
                  <button type="button" className="ghost-button ghost-button-danger" onClick={discardSimulation}>
                    Recommencer
                  </button>
                </>
              )}
            </div>
            {activeSimulation && (
              <div className="resume-card">
                <strong>Une session non terminée existe.</strong>
                <p>
                  Démarrée le {formatTimestamp(activeSimulation.startedAt)}. Progression :{" "}
                  {simulationProgress.answered}/{simulationProgress.total} réponses renseignées.
                </p>
              </div>
            )}
          </section>

          <section className="surface home-panel">
            <div className="section-badge">Apprentissage</div>
            <h2>Répondre et apprendre</h2>
            <p>
              Correction immédiate, explications option par option, notion clé et possibilité de
              refaire uniquement les erreurs.
            </p>
            <label className="label" htmlFor="learn-category">
              Catégorie
            </label>
            <select
              id="learn-category"
              className="input"
              value={learnCategory}
              onChange={(event) => setLearnCategory(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <label className="label" htmlFor="learn-section">
              Type de questions
            </label>
            <select
              id="learn-section"
              className="input"
              value={learnSectionFilter}
              onChange={(event) => setLearnSectionFilter(event.target.value)}
            >
              {LEARN_SECTION_FILTERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={() => startLearnSession()}>
                Lancer l'entraînement
              </button>
              <button type="button" className="ghost-button" onClick={startMistakeReview} disabled={!mistakesList.length}>
                Refaire mes erreurs
              </button>
            </div>
          </section>

          <section className="surface home-panel">
            <div className="section-badge">Révision rapide</div>
            <h2>Flashcards</h2>
            <p>
              Terme, définition, exemple AWS et piège fréquent à éviter. Idéal pour des sessions
              courtes entre deux révisions plus lourdes.
            </p>
            <div className="flashcard-mini-stats">
              <div>
                <span>Cartes</span>
                <strong>{flashcardsData.length}</strong>
              </div>
              <div>
                <span>Maîtrisées</span>
                <strong>
                  {Object.values(flashcardProgress).filter((item) => item.status === "mastered").length}
                </strong>
              </div>
              <div>
                <span>À revoir</span>
                <strong>
                  {Object.values(flashcardProgress).filter((item) => item.status === "review").length}
                </strong>
              </div>
            </div>
            <button type="button" className="primary-button" onClick={() => setView("flashcards")}>
              Ouvrir les flashcards
            </button>
          </section>

          <section className="surface home-panel">
            <div className="section-badge">Mémoire locale</div>
            <h2>Suivi personnel</h2>
            <p>Historique local, sessions sauvegardées, catégories faibles et reprise rapide.</p>
            <ul className="feature-list">
              <li>{history.length} session(s) enregistrée(s).</li>
              <li>{mistakesList.length} question(s) dans “Mes erreurs”.</li>
              <li>Barème appliqué : +1 si correct, 0 sinon.</li>
            </ul>
            <div className="button-row">
              <button type="button" className="ghost-button" onClick={() => setView("history")}>
                Voir l'historique
              </button>
              <button type="button" className="ghost-button" onClick={() => setView("mistakes")}>
                Ouvrir mes erreurs
              </button>
            </div>
          </section>
        </main>
      )}

      {view === "simulation" && activeSimulation && currentSimulationUnit && (
        <main className="workspace-grid">
          <aside className="surface sidebar">
            <Timer remainingSeconds={simulationRemainingSeconds} />
            <ProgressBar
              value={simulationProgress.answered}
              max={simulationProgress.total}
              label="Progression de la simulation"
            />
            <div className="section-summary">
              <h3>Sections</h3>
              {Object.entries(EXAM_CONFIG.sections).map(([key, section]) => (
                <button
                  key={key}
                  type="button"
                  className={`section-chip ${simulationProgress.section === key ? "section-chip-active" : ""}`}
                  onClick={() => {
                    const index = activeSimulation.units.findIndex((unit) => unit.section === key);
                    if (index >= 0) goToSimulationUnit(index);
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <div className="autosave-card">
              <strong>Session sauvegardée automatiquement.</strong>
              <p>Dernière sauvegarde : {formatTimestamp(activeSimulation.autoSavedAt || Date.now())}</p>
            </div>
            <div className="unit-list">
              {activeSimulation.units.map((unit, index) => {
                const answered = unit.kind === "scenario"
                  ? unit.questions.filter((question) => !isAnswerEmpty(question, activeSimulation.answersById[question.id])).length
                  : !isAnswerEmpty(unit, activeSimulation.answersById[unit.id])
                    ? 1
                    : 0;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    className={`unit-pill ${index === activeSimulation.currentUnitIndex ? "unit-pill-active" : ""} ${
                      activeSimulation.flaggedUnitIds.includes(unit.id) ? "unit-pill-flagged" : ""
                    }`}
                    onClick={() => goToSimulationUnit(index)}
                  >
                    <span>{unit.section}</span>
                    <strong>{unit.kind === "scenario" ? unit.title : `Question ${index + 1}`}</strong>
                    <small>
                      {answered}/{getUnitPromptCount(unit)} répondu(s)
                    </small>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="surface main-panel">
            <div className="simulation-banner">
              <p>Vous êtes en conditions d'examen : les corrections seront visibles à la fin.</p>
            </div>

            {currentSimulationUnit.kind === "question" ? (
              <div className="question-panel">
                <div className="question-metadata">
                  <span className="meta-pill">{EXAM_CONFIG.sections[currentSimulationUnit.section].label}</span>
                  <span className="meta-pill meta-pill-muted">{currentSimulationUnit.category}</span>
                  <span className="meta-pill meta-pill-muted">{currentSimulationUnit.difficulty}</span>
                </div>
                <h2>{currentSimulationUnit.question}</h2>
                <p className="instruction-line">{getQuestionInstruction(currentSimulationUnit)}</p>
                <QuestionOptions
                  question={currentSimulationUnit}
                  value={activeSimulation.answersById[currentSimulationUnit.id] || (currentSimulationUnit.type === "multiple" ? [] : "")}
                  onChange={(value) => updateSimulationAnswer(currentSimulationUnit, value)}
                />
              </div>
            ) : (
              <div className="question-panel">
                <div className="question-metadata">
                  <span className="meta-pill">{EXAM_CONFIG.sections.C.label}</span>
                  <span className="meta-pill meta-pill-muted">{currentSimulationUnit.category}</span>
                  <span className="meta-pill meta-pill-muted">Scénario</span>
                </div>
                <h2>{currentSimulationUnit.title}</h2>
                <p className="scenario-context">{currentSimulationUnit.context}</p>
                <pre className="diagram-box">{currentSimulationUnit.diagram}</pre>
                <div className="scenario-questions">
                  {currentSimulationUnit.questions.map((question) => (
                    <div key={question.id} className="scenario-question-card">
                      <h3>{question.question}</h3>
                      <p className="instruction-line">{getQuestionInstruction(question)}</p>
                      <QuestionOptions
                        question={question}
                        value={activeSimulation.answersById[question.id] || (question.type === "multiple" ? [] : "")}
                        onChange={(value) => updateSimulationAnswer(question, value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="button-row button-row-spread">
              <div className="button-row">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={activeSimulation.currentUnitIndex === 0}
                  onClick={() => goToSimulationUnit(activeSimulation.currentUnitIndex - 1)}
                >
                  Question précédente
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={activeSimulation.currentUnitIndex === activeSimulation.units.length - 1}
                  onClick={() => goToSimulationUnit(activeSimulation.currentUnitIndex + 1)}
                >
                  Passer / suivante
                </button>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className={`ghost-button ${activeSimulation.flaggedUnitIds.includes(currentSimulationUnit.id) ? "ghost-button-warning" : ""}`}
                  onClick={() => toggleFlag(currentSimulationUnit.id)}
                >
                  {activeSimulation.flaggedUnitIds.includes(currentSimulationUnit.id) ? "Retirer le marqueur" : "Marquer à revoir"}
                </button>
                <button type="button" className="primary-button" onClick={() => finalizeSimulation("Soumission manuelle")}>
                  Terminer
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {view === "simulation" && activeSimulation && !currentSimulationUnit && (
        <main className="workspace-grid workspace-grid-single">
          <section className="surface main-panel">
            <div className="section-badge">Session invalide</div>
            <h2>La simulation en cours semble incomplète.</h2>
            <p>
              Cela peut arriver si une ancienne session sauvegardée ne correspond plus à la nouvelle
              version de l'application.
            </p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={startSimulation}>
                Lancer une nouvelle simulation
              </button>
              <button type="button" className="ghost-button" onClick={discardSimulation}>
                Effacer la session sauvegardée
              </button>
            </div>
          </section>
        </main>
      )}

      {view === "simulation" && !activeSimulation && (
        <main className="workspace-grid workspace-grid-single">
          <section className="surface main-panel">
            <div className="section-badge">Simulation examen</div>
            <h2>Prêt à lancer une simulation complète ?</h2>
            <p>
              Cette simulation reproduit la structure de l'épreuve : questions courtes, questions
              moyennes et scénarios. Les corrections resteront cachées jusqu'à la fin.
            </p>
            <div className="tips-inline">
              <strong>Rappel :</strong> il s'agit de questions d'entraînement. Elles couvrent les mêmes
              compétences que l'examen officiel sans en reprendre les formulations exactes.
            </div>
            <ul className="feature-list">
              <li>Durée : 2h</li>
              <li>Section A : 32 questions courtes</li>
              <li>Section B : 10 questions moyennes</li>
              <li>Section C : 5 scénarios</li>
            </ul>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={startSimulation}>
                Commencer la simulation
              </button>
              <button type="button" className="ghost-button" onClick={() => setView("home")}>
                Retour à l'accueil
              </button>
            </div>
          </section>
        </main>
      )}

      {view === "learn" && learnSession && currentLearnQuestion && (
        <main className="workspace-grid workspace-grid-single">
          <section className="surface main-panel">
            <div className="question-metadata">
              <span className="meta-pill">{learnSession.label}</span>
              <span className="meta-pill meta-pill-muted">{currentLearnQuestion.category}</span>
              <span className="meta-pill meta-pill-muted">
                {learnSession.currentIndex + 1}/{learnSession.questions.length}
              </span>
            </div>
            {currentLearnQuestion.scenarioTitle && (
              <div className="scenario-summary">
                <strong>Contexte scénario :</strong>
                <p>{currentLearnQuestion.scenarioTitle}</p>
                <small>{currentLearnQuestion.scenarioContext}</small>
              </div>
            )}
            <h2>{currentLearnQuestion.question}</h2>
            <p className="instruction-line">{getQuestionInstruction(currentLearnQuestion)}</p>
            <QuestionOptions
              question={currentLearnQuestion}
              value={learnSession.answersById[currentLearnQuestion.id] || (currentLearnQuestion.type === "multiple" ? [] : "")}
              onChange={(value) => updateLearnAnswer(currentLearnQuestion.id, value)}
              disabled={Boolean(currentLearnFeedback)}
              reveal={Boolean(currentLearnFeedback)}
            />

            {currentLearnFeedback && (
              <div className={`feedback-card ${currentLearnFeedback.isPerfect ? "feedback-card-good" : "feedback-card-warn"}`}>
                <h3>
                  {currentLearnFeedback.isPerfect
                    ? "Bonne réponse."
                    : "Réponse partielle ou incorrecte."}
                </h3>
                <p>
                  Score obtenu : {currentLearnFeedback.score}/{currentLearnFeedback.max}. Retenez surtout le
                  principe : <strong>{currentLearnQuestion.concept}</strong>.
                </p>
                <LearnFeedbackSummary
                  question={currentLearnQuestion}
                  answer={learnSession.answersById[currentLearnQuestion.id]}
                  feedback={currentLearnFeedback}
                />
                <OptionExplanations
                  question={currentLearnQuestion}
                  answer={learnSession.answersById[currentLearnQuestion.id]}
                />
              </div>
            )}

            <div className="button-row">
              {!currentLearnFeedback ? (
                <button type="button" className="primary-button" onClick={submitLearnQuestion}>
                  Voir la correction
                </button>
              ) : (
                <>
                  <button type="button" className="primary-button" onClick={() => nextLearnQuestion(false)}>
                    Question suivante
                  </button>
                  <button type="button" className="ghost-button" onClick={() => nextLearnQuestion(true)}>
                    Question similaire
                  </button>
                </>
              )}
              <button type="button" className="ghost-button" onClick={() => setView("home")}>
                Retour à l'accueil
              </button>
            </div>
          </section>
        </main>
      )}

      {view === "learn" && (!learnSession || !currentLearnQuestion) && (
        <main className="workspace-grid workspace-grid-single">
          <section className="surface main-panel">
            <div className="section-badge">Entraînement</div>
            <h2>Aucune question disponible pour cette sélection.</h2>
            <p>
              Changez de catégorie ou relancez un entraînement global. Si vous arriviez depuis une
              ancienne session, l'application a probablement filtré un état obsolète.
            </p>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setLearnCategory("Toutes");
                  setLearnSectionFilter("all");
                  startLearnSession(practicePool, "Répondre et apprendre");
                }}
              >
                Charger un entraînement global
              </button>
              <button type="button" className="ghost-button" onClick={() => setView("home")}>
                Retour à l'accueil
              </button>
            </div>
          </section>
        </main>
      )}

      {view === "flashcards" && flashcard && (
        <main className="workspace-grid workspace-grid-single">
          <section className="surface main-panel">
            <div className="question-metadata">
              <span className="meta-pill">Révision rapide</span>
              <span className="meta-pill meta-pill-muted">
                Carte {flashcardSession.currentIndex + 1}/{flashcardSession.cards.length}
              </span>
            </div>
            <div className="flashcard-card">
              <h2>{flashcard.term}</h2>
              {flashcardSession.revealed ? (
                <div className="flashcard-content">
                  <p>
                    <strong>Définition :</strong> {flashcard.definition}
                  </p>
                  <p>
                    <strong>Exemple AWS :</strong> {flashcard.awsExample}
                  </p>
                  <p>
                    <strong>Piège fréquent :</strong> {flashcard.frequentTrap}
                  </p>
                </div>
              ) : (
                <p className="flashcard-hidden">
                  Essayez de définir le terme avant de révéler la carte.
                </p>
              )}
            </div>
            <div className="button-row">
              {!flashcardSession.revealed ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    setFlashcardSession((prev) => ({
                      ...prev,
                      revealed: true
                    }))
                  }
                >
                  Voir la définition
                </button>
              ) : (
                <>
                  <button type="button" className="primary-button" onClick={() => rateFlashcard("mastered")}>
                    Je maîtrise
                  </button>
                  <button type="button" className="ghost-button ghost-button-warning" onClick={() => rateFlashcard("review")}>
                    À revoir
                  </button>
                </>
              )}
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setFlashcardSession((prev) => ({
                    ...prev,
                    currentIndex: (prev.currentIndex + 1) % prev.cards.length,
                    revealed: false
                  }))
                }
              >
                Carte suivante
              </button>
            </div>
          </section>
        </main>
      )}

      {view === "results" && lastResult && (
        <main className="dashboard-grid">
          <section className="surface home-panel home-panel-large">
            <div className="section-badge">{lastResult.mode}</div>
            <h2>Résultats de session</h2>
            <div className="result-kpis">
              <div className="kpi-card">
                <span>Score brut</span>
                <strong>
                  {Math.round(lastResult.rawScore * 100) / 100} / {lastResult.maxScore}
                </strong>
              </div>
              <div className="kpi-card">
                <span>Note /20</span>
                <strong>{lastResult.note20.toFixed(2)}</strong>
              </div>
              <div className="kpi-card">
                <span>Pourcentage</span>
                <strong>{lastResult.percent.toFixed(1)}%</strong>
              </div>
              <div className="kpi-card">
                <span>Temps utilisé</span>
                <strong>{formatDuration(lastResult.usedSeconds)}</strong>
              </div>
            </div>
            {lastResult.sectionScores && (
              <div className="result-section">
                <h3>Score par section</h3>
                <ResultBar label="Section A" value={lastResult.sectionScores.A.raw} max={lastResult.sectionScores.A.max} />
                <ResultBar label="Section B" value={lastResult.sectionScores.B.raw} max={lastResult.sectionScores.B.max} accent="gold" />
                <ResultBar label="Section C" value={lastResult.sectionScores.C.raw} max={lastResult.sectionScores.C.max} accent="green" />
              </div>
            )}
            {lastResult.categoryScores && (
              <div className="result-section">
                <h3>Score par catégorie</h3>
                <div className="stack-list">
                  {lastResult.categoryScores.slice(0, 8).map((item) => (
                    <ResultBar
                      key={item.name}
                      label={item.name}
                      value={Math.round(item.raw * 100) / 100}
                      max={item.max}
                      accent={item.ratio >= 0.75 ? "green" : item.ratio >= 0.5 ? "gold" : "red"}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="result-kpis">
              <div className="kpi-card">
                <span>Bonnes réponses</span>
                <strong>{lastResult.correctCount ?? "-"}</strong>
              </div>
              <div className="kpi-card">
                <span>Mauvaises réponses</span>
                <strong>{lastResult.incorrectCount ?? "-"}</strong>
              </div>
              <div className="kpi-card">
                <span>Réponses vides</span>
                <strong>{lastResult.emptyCount ?? "-"}</strong>
              </div>
            </div>
            {lastResult.categoryScores && (
              <div className="dual-column">
                <div className="surface inset-card">
                  <h3>Top 3 notions maîtrisées</h3>
                  <ul className="feature-list">
                    {(lastResult.detail?.byConcept || [])
                      .slice(0, 3)
                      .map((item) => (
                        <li key={item.name}>
                          {item.name} — {(item.ratio * 100).toFixed(0)}%
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="surface inset-card">
                  <h3>Top 3 notions à revoir</h3>
                  <ul className="feature-list">
                    {(lastResult.detail?.byConcept || [])
                      .slice(-3)
                      .reverse()
                      .map((item) => (
                        <li key={item.name}>
                          {item.name} — {(item.ratio * 100).toFixed(0)}%
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="button-row">
              <button type="button" className="primary-button" onClick={startMistakeReview}>
                Refaire mes erreurs
              </button>
              <button type="button" className="ghost-button" onClick={startSimulation}>
                Nouvelle simulation
              </button>
              <button type="button" className="ghost-button" onClick={() => setView("home")}>
                Retour à l'accueil
              </button>
            </div>
          </section>

          <section className="surface home-panel">
            <div className="section-badge">Feedback pédagogique</div>
            <h2>Explications et notions à revoir</h2>
            <div className="scroll-list">
              {(lastResult.reviewItems || []).slice(0, 12).map((item) => (
                <div key={item.id} className="review-card">
                  <strong>{item.question}</strong>
                  <p>
                    Score : {item.score}/{item.max}
                  </p>
                  <p>
                    <strong>Notion :</strong> {item.concept}
                  </p>
                  <p>{item.learningNote}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {view === "history" && (
        <main className="workspace-grid">
          <section className="surface sidebar">
            <h2>Historique</h2>
            <p>Sessions locales enregistrées sur ce navigateur.</p>
            <div className="stack-list">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`history-pill ${selectedHistory?.id === entry.id ? "history-pill-active" : ""}`}
                  onClick={() => setSelectedHistoryId(entry.id)}
                >
                  <strong>{entry.mode}</strong>
                  <small>{formatTimestamp(entry.endedAt || entry.startedAt)}</small>
                  <span>
                    {entry.note20?.toFixed(2) || "—"} / 20
                  </span>
                </button>
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="ghost-button" onClick={clearHistory}>
                Supprimer l'historique
              </button>
            </div>
          </section>

          <section className="surface main-panel">
            {selectedHistory ? (
              <>
                <div className="section-badge">{selectedHistory.mode}</div>
                <h2>Détails de session</h2>
                <div className="result-kpis">
                  <div className="kpi-card">
                    <span>Date</span>
                    <strong>{formatTimestamp(selectedHistory.endedAt || selectedHistory.startedAt)}</strong>
                  </div>
                  <div className="kpi-card">
                    <span>Score brut</span>
                    <strong>
                      {Math.round((selectedHistory.rawScore || 0) * 100) / 100} / {selectedHistory.maxScore || "—"}
                    </strong>
                  </div>
                  <div className="kpi-card">
                    <span>Note /20</span>
                    <strong>{selectedHistory.note20 ? selectedHistory.note20.toFixed(2) : "—"}</strong>
                  </div>
                  <div className="kpi-card">
                    <span>Durée</span>
                    <strong>{selectedHistory.usedSeconds ? formatDuration(selectedHistory.usedSeconds) : "—"}</strong>
                  </div>
                </div>
                {selectedHistory.reviewItems && (
                  <div className="scroll-list">
                    {selectedHistory.reviewItems.slice(0, 10).map((item) => (
                      <div key={item.id} className="review-card">
                        <strong>{item.question}</strong>
                        <p>{item.concept}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <h2>Aucune session enregistrée</h2>
                <p>Lancez une simulation ou un entraînement pour créer votre historique.</p>
              </div>
            )}
          </section>
        </main>
      )}

      {view === "mistakes" && (
        <main className="workspace-grid">
          <section className="surface main-panel">
            <div className="section-badge">Travail ciblé</div>
            <h2>Mes erreurs</h2>
            <p>Questions ratées ou partielles, à refaire pour consolider les notions fragiles.</p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={startMistakeReview} disabled={!mistakesList.length}>
                Refaire toutes mes erreurs
              </button>
              <button type="button" className="ghost-button" onClick={clearMistakes}>
                Supprimer cette liste
              </button>
            </div>
            <div className="scroll-list">
              {mistakesList.length ? (
                mistakesList.map((item) => (
                  <div key={item.id} className="review-card">
                    <strong>{item.question}</strong>
                    <p>
                      <strong>Catégorie :</strong> {item.category}
                    </p>
                    <p>
                      <strong>Notion :</strong> {item.concept}
                    </p>
                    <p>Ratée {item.count} fois.</p>
                    <div className="button-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => startLearnSession([mistakeLookup[item.id]].filter(Boolean), "Révision ciblée")}
                      >
                        Refaire cette question
                      </button>
                      <button type="button" className="ghost-button ghost-button-danger" onClick={() => removeMistake(item.id)}>
                        Retirer
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <h3>Pas encore d'erreurs enregistrées.</h3>
                  <p>Bonne nouvelle : rien à retravailler ici pour le moment.</p>
                </div>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
