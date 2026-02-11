
import { useEffect, useState } from "react";

const STORAGE_KEY = "peds-card-qbank:v1";

const initialQuestions = [
  {
    id: 1,
    topic: "Physiology",
    stem: "LV isovolumic contraction continues until what event occurs?",
    choices: [
      "Mitral valve opens",
      "Passive atrial filling",
      "Increased ventricular volume",
      "Aortic valve opens",
      "Aortic pressure greater than LV"
    ],
    answer: 3,
    explanation: "LV pressure exceeds aortic pressure → aortic valve opens."
  }
];

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function QuestionBankApp() {
  const [questionBank, setQuestionBank] = useState(() => shuffleArray(initialQuestions));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.questionBank) {
      setQuestionBank(saved.questionBank);
      setIndex(saved.index || 0);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ questionBank, index })
    );
  }, [questionBank, index]);

  const q = questionBank[index];

  if (!q) return <div>No questions loaded</div>;

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>{q.topic}</h2>
      <p>{q.stem}</p>

      {q.choices.map((c, i) => (
        <button
          key={i}
          style={{
            display: "block",
            width: "100%",
            marginBottom: 10,
            padding: 12,
            whiteSpace: "normal",
            textAlign: "left"
          }}
          onClick={() => setSelected(i)}
        >
          {c}
        </button>
      ))}

      <button onClick={() => setShowAnswer(true)}>Check</button>
      <button onClick={() => {
        setIndex((prev) => (prev + 1) % questionBank.length);
        setSelected(null);
        setShowAnswer(false);
      }}>
        {showAnswer ? "Next" : "Skip"}
      </button>
    </div>
  );
}
