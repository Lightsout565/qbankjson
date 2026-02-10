import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";

const STORAGE_KEY = "peds-card-qbank:v1";

type Question = {
  id: number | string;
  topic: string;
  stem: string;
  choices: string[];
  answer: number; // index into choices
  explanation: string;
};

type TopicStats = Record<string, { correct: number; total: number }>;

type PersistedState = {
  questionBank: Question[];
  index: number;
  showAccuracy: boolean;
  stats: TopicStats;
  schemaVersion: number;
  savedAt: number;
};

const initialQuestions: Question[] = [
  {
    id: 1,
    topic: "Physiology",
    stem: "Left ventricular (LV) isovolumic contraction continues until what cardiac event occurs?",
    choices: [
      "Mitral valve opens",
      "Passive atrial filling",
      "Increased ventricular volume",
      "Aortic valve opens",
      "Aortic pressure greater than left ventricular",
    ],
    answer: 3,
    explanation:
      "During isovolumic contraction, both valves are closed. Contraction continues until LV pressure exceeds aortic pressure, causing the aortic valve to open.",
  },
  {
    id: 2,
    topic: "Coronary Physiology",
    stem: "Which metabolic factor regulating coronary blood flow is derived from breakdown of high-energy phosphates?",
    choices: ["Prostaglandin", "Nitric oxide", "Endothelin-1", "Adenosine", "VEGF"],
    answer: 3,
    explanation:
      "Adenosine is produced from ATP breakdown during low oxygen states and causes potent coronary vasodilation.",
  },
];

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function isValidQuestion(q: any): q is Question {
  return (
    q &&
    (typeof q.id === "number" || typeof q.id === "string") &&
    typeof q.topic === "string" &&
    typeof q.stem === "string" &&
    Array.isArray(q.choices) &&
    q.choices.every((c: any) => typeof c === "string") &&
    typeof q.answer === "number" &&
    Number.isFinite(q.answer) &&
    q.answer >= 0 &&
    q.answer < q.choices.length &&
    typeof q.explanation === "string"
  );
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clampIndex(idx: number, length: number): number {
  if (!Number.isFinite(idx) || length <= 0) return 0;
  return Math.max(0, Math.min(idx, length - 1));
}

// Lightweight dev-time tests (no framework required).
function runDevTests() {
  // shuffleArray should not mutate input
  const a = [1, 2, 3, 4, 5];
  const b = shuffleArray(a);
  console.assert(a !== b, "shuffleArray should return a new array");
  console.assert(a.length === b.length, "shuffleArray should preserve length");
  console.assert(
    a.slice().sort().join(",") === b.slice().sort().join(","),
    "shuffleArray should preserve elements"
  );

  // isValidQuestion basics
  const good: Question = {
    id: 1,
    topic: "T",
    stem: "S",
    choices: ["A", "B"],
    answer: 0,
    explanation: "E",
  };
  console.assert(isValidQuestion(good), "isValidQuestion should accept valid shape");
  console.assert(
    !isValidQuestion({ ...good, answer: 99 }),
    "isValidQuestion should reject out-of-range answer"
  );

  // clampIndex
  console.assert(clampIndex(0, 10) === 0, "clampIndex keeps 0");
  console.assert(clampIndex(9, 10) === 9, "clampIndex keeps last index");
  console.assert(clampIndex(999, 10) === 9, "clampIndex clamps high");
  console.assert(clampIndex(-5, 10) === 0, "clampIndex clamps low");
  console.assert(clampIndex(2, 0) === 0, "clampIndex handles empty");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
  runDevTests();
}

export default function QuestionBankApp() {
  // Default: start shuffled if nothing is persisted.
  const [questionBank, setQuestionBank] = useState<Question[]>(() => shuffleArray(initialQuestions));
  const [index, setIndex] = useState<number>(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const [stats, setStats] = useState<TopicStats>({});
  const [showAccuracy, setShowAccuracy] = useState<boolean>(false);
  const [importError, setImportError] = useState<string>("");

  // Hydrate from localStorage once.
  // IMPORTANT: preserve saved order; only reshuffle when Shuffle button is pressed.
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = safeParseJSON(raw) as PersistedState | null;
    if (!saved || typeof saved !== "object") return;

    if (Array.isArray(saved.questionBank) && saved.questionBank.every(isValidQuestion)) {
      setQuestionBank(saved.questionBank);
      setIndex(clampIndex(saved.index, saved.questionBank.length));
    }

    if (typeof saved.showAccuracy === "boolean") setShowAccuracy(saved.showAccuracy);
    if (saved.stats && typeof saved.stats === "object") setStats(saved.stats as TopicStats);
  }, []);

  // Persist to localStorage.
  useEffect(() => {
    const payload: PersistedState = {
      questionBank,
      index,
      showAccuracy,
      stats,
      schemaVersion: 1,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [questionBank, index, showAccuracy, stats]);

  const totalQuestions = questionBank.length;
  const q: Question | undefined = questionBank[clampIndex(index, totalQuestions)];

  const accuracyByTopic = useMemo(() => {
    const entries = Object.entries(stats || {}).filter(
      ([, s]) => s && typeof s.total === "number" && s.total > 0
    );
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [stats]);

  const resetPerQuestionUI = () => {
    setSelected(null);
    setShowAnswer(false);
    setShowExplanation(false);
  };

  const handleCheck = () => {
    if (!q || selected === null) return;

    setShowAnswer(true);
    setShowExplanation(false);

    setStats((prev) => {
      const topicStats = prev[q.topic] || { correct: 0, total: 0 };
      const isCorrect = selected === q.answer;
      return {
        ...prev,
        [q.topic]: {
          total: topicStats.total + 1,
          correct: topicStats.correct + (isCorrect ? 1 : 0),
        },
      };
    });
  };

  const handleNext = () => {
    if (totalQuestions <= 0) return;
    setIndex((prev) => (prev + 1) % totalQuestions);
    resetPerQuestionUI();
  };

  const handleResetProgress = () => {
    setIndex(0);
    resetPerQuestionUI();
    setStats({});
  };

  const handleShuffle = () => {
    setQuestionBank((prev) => shuffleArray(prev));
    setIndex(0);
    resetPerQuestionUI();
  };

  const handleImportJSON = async (file?: File) => {
    setImportError("");
    if (!file) return;

    try {
      const text = await file.text();
      const data = safeParseJSON(text) as any;

      // Accept either a direct array or an object with { questions: [...] }
      const imported = Array.isArray(data) ? data : data?.questions;

      if (!Array.isArray(imported) || imported.length === 0) {
        setImportError(
          "Import failed: JSON must be an array of questions (or { questions: [...] })."
        );
        return;
      }

      if (!imported.every(isValidQuestion)) {
        setImportError(
          "Import failed: One or more questions are missing required fields (topic/stem/choices/answer/explanation)."
        );
        return;
      }

      // Import gets one initial shuffle; after that, the order persists until Shuffle is clicked.
      setQuestionBank(shuffleArray(imported));
      setIndex(0);
      resetPerQuestionUI();
      setStats({});
    } catch {
      setImportError("Import failed: Could not read/parse the JSON file.");
    }
  };

  const ImportButton = (
    <div className="pt-6">
      <div className="flex justify-center">
        <label className="text-xs px-3 py-2 rounded-md border cursor-pointer select-none inline-block">
          Import Questions (JSON)
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImportJSON(e.target.files?.[0] || undefined)}
          />
        </label>
      </div>
    </div>
  );

  if (!q) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card className="rounded-2xl shadow-md">
          <CardContent className="space-y-2">
            <div className="text-lg font-semibold">No questions loaded</div>
            <div className="text-sm text-muted-foreground">Import a JSON file to get started.</div>
          </CardContent>
        </Card>

        {/* Import at Bottom */}
        {ImportButton}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => setShowAccuracy((prev) => !prev)}
        >
          {showAccuracy ? "Hide Accuracy" : "Show Accuracy"}
        </Button>

        <Button variant="ghost" className="text-xs" onClick={handleResetProgress}>
          Reset Progress
        </Button>

        <Button
          variant="ghost"
          className="text-xs flex items-center gap-1"
          onClick={handleShuffle}
        >
          <Shuffle className="h-3 w-3" />
          Shuffle
        </Button>

        <div className="ml-auto text-xs text-muted-foreground">{totalQuestions} questions</div>
      </div>

      {importError && <div className="text-xs text-red-600">{importError}</div>}

      {showAccuracy && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-2">
            <div className="text-sm font-semibold">Accuracy</div>
            {accuracyByTopic.length === 0 && (
              <div className="text-xs text-muted-foreground">No questions answered yet</div>
            )}
            {accuracyByTopic.map(([topic, s]) => (
              <div key={topic} className="text-xs">
                {topic}: {s.correct}/{s.total} ({Math.round((s.correct / s.total) * 100)}%)
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Question */}
      <Card className="rounded-2xl shadow-md">
        <CardContent className="space-y-4">
          <div className="flex justify-end items-center">
            <div className="text-xs text-muted-foreground">{q.topic}</div>
          </div>

          <div>{q.stem}</div>

          <div className="space-y-2">
            {q.choices.map((c, i) => {
              let variant: any = "outline";

              if (showAnswer) {
                if (i === q.answer) variant = "default";
                else if (i === selected) variant = "destructive";
              } else if (selected === i) {
                variant = "default";
              }

              return (
                <Button
                  key={i}
                  variant={variant}
                  className={`w-full justify-start text-left whitespace-normal break-words h-auto py-3 leading-snug ${
                    showAnswer && i === q.answer
                      ? "bg-green-600 hover:bg-green-600"
                      : showAnswer && i === selected
                      ? "bg-red-600 hover:bg-red-600"
                      : ""
                  }`}
                  onClick={() => {
                    if (!showAnswer) setSelected(i);
                  }}
                >
                  {c}
                </Button>
              );
            })}
          </div>

          {showAnswer && (
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={() => setShowExplanation((prev) => !prev)}
              >
                {showExplanation ? "Hide Explanation" : "Show Explanation"}
              </Button>

              {showExplanation && (
                <div className="text-sm bg-muted p-3 rounded-xl">{q.explanation}</div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="secondary"
              onClick={handleCheck}
              disabled={selected === null || showAnswer}
            >
              Check Answer
            </Button>
            <Button onClick={handleNext}>{showAnswer ? "Next" : "Skip"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Import at Bottom */}
      {ImportButton}
    </div>
  );
}
