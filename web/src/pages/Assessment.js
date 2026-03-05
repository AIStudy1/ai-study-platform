import { useState } from "react";

function Assessment() {
  const [subject, setSubject] = useState("");
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lp, setLp] = useState(0);
  const [studyPlan, setStudyPlan] = useState([]);


  const questions = [
    {
      id: 1,
      question: "What is a stack?",
      options: [
        "A FIFO data structure",
        "A LIFO data structure",
        "A sorting algorithm",
        "A database"
      ],
      correct: 1
    },
    {
      id: 2,
      question: "What does O(n) represent?",
      options: [
        "Constant time",
        "Logarithmic time",
        "Linear time complexity",
        "Exponential time"
      ],
      correct: 2
    },
    {
      id: 3,
      question: "Which structure uses nodes and pointers?",
      options: [
        "Array",
        "Linked List",
        "Stack",
        "Queue"
      ],
      correct: 1
    }
  ];

  const handleStart = () => {
    if (subject.trim() === "") {
      alert("Please enter a subject");
      return;
    }
    setStep(2);
  };

  const handleOptionSelect = (questionId, optionIndex) => {
    setAnswers({ ...answers, [questionId]: optionIndex });
  };

  const handleSubmit = () => {
  let total = 0;

  questions.forEach((q) => {
    if (answers[q.id] === q.correct) {
      total++;
    }
  });

  setScore(total);

  // Determine level
  let detectedLevel = "";
  let recommendation = "";

  if (total <= 1) {
    detectedLevel = "Beginner";
    recommendation = "You need to strengthen foundational concepts.";
  } else if (total === 2) {
    detectedLevel = "Intermediate";
    recommendation = "You understand basics but need practice on advanced topics.";
  } else {
    detectedLevel = "Advanced";
    recommendation = "Excellent understanding. You can move to complex problems.";
  }

  setLevel(detectedLevel);
  setFeedback(recommendation);
  let earnedLP = 0;
  if (detectedLevel === "Beginner") {
    earnedLP = 10;
  } else if (detectedLevel === "Intermediate") {
    earnedLP = 25;
  } else {
    earnedLP = 50;
  }

  setLp(earnedLP);
  let plan = [];
  if (detectedLevel === "Beginner") {
    plan = [
      "Review basic definitions and concepts",
      "Watch introductory tutorials",
      "Solve easy practice problems",
      "Retake assessment after 3 study sessions"
    ];
  } else if (detectedLevel === "Intermediate") {
    plan = [
      "Practice medium-level problems",
      "Study edge cases and optimizations",
      "Implement small projects",
      "Retake assessment after 5 practice sessions"
    ];
  } else {
    plan = [
      "Solve advanced problems",
      "Work on real-world applications",
      "Explore system design concepts",
      "Take advanced mock assessment"
    ];
  }

  setStudyPlan(plan);
  setStep(3);
};


  return (
    <div style={styles.container}>
      <h1>Skill Assessment</h1>

      {step === 1 && (
        <>
          <p>Select the subject you want to be tested on:</p>

          <input
            type="text"
            placeholder="e.g. Data Structures"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={styles.input}
          />

          <button onClick={handleStart} style={styles.button}>
            Start Assessment
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Assessment for: {subject}</h2>

          {questions.map((q) => (
            <div key={q.id} style={{ marginBottom: "20px" }}>
              <p><strong>{q.question}</strong></p>

              {q.options.map((option, index) => (
                <div key={index}>
                  <label>
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      onChange={() => handleOptionSelect(q.id, index)}
                    />
                    {option}
                  </label>
                </div>
              ))}
            </div>
          ))}

          <button onClick={handleSubmit} style={styles.button}>
            Submit Quiz
          </button>
        </>
      )}

      {step === 3 && (
      <>
        <h2>Assessment Results</h2>

        <p>You scored {score} out of {questions.length}</p>

        <h3>Detected Level: {level}</h3>

        <p>{feedback}</p>

        <h3>Learning Points Earned: +{lp} LP ⭐</h3>

        <h3>Your Personalized Study Plan:</h3>

        <ul style={{ textAlign: "left", maxWidth: "400px", margin: "0 auto" }}>
          {studyPlan.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </>
    )}

    </div>
  );
}

const styles = {
  container: {
    textAlign: "center",
    marginTop: "80px"
  },
  input: {
    padding: "10px",
    width: "300px",
    margin: "20px",
    borderRadius: "5px",
    border: "1px solid #ccc"
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer"
  }
};

export default Assessment;
