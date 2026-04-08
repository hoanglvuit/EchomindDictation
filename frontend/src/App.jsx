import { useState, useEffect, useCallback } from "react";
import { listSessions } from "./api";
import HomePage from "./components/HomePage";
import Exercise from "./components/dictation/Exercise";
import CompletionPage from "./components/dictation/CompletionPage";
import VocabList from "./components/vocab/VocabList";
import VocabPractice from "./components/vocab/VocabPractice";
import GrammarList from "./components/grammar/GrammarList";
import GrammarPractice from "./components/grammar/GrammarPractice";
import ListeningVocabList from "./components/listening/ListeningVocabList";
import ListeningPractice from "./components/listening/ListeningPractice";

function App() {
  const [page, setPage] = useState("home"); // home | exercise | complete | vocab | practice | grammar | grammar-practice | listening-vocab | listening-practice
  const [sessions, setSessions] = useState([]);
  const [sessionName, setSessionName] = useState(null);
  const [totalSegments, setTotalSegments] = useState(0);
  const [startIdx, setStartIdx] = useState(0);
  const [finalStats, setFinalStats] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStartSession = (name, total, progress = 0) => {
    setSessionName(name);
    setTotalSegments(total);
    setStartIdx(progress);
    setPage("exercise");
  };

  const handleComplete = (stats) => {
    setFinalStats(stats);
    setPage("complete");
  };

  const goHome = () => {
    setPage("home");
    setSessionName(null);
    setTotalSegments(0);
    setStartIdx(0);
    setFinalStats(null);
    fetchSessions();
  };

  return (
    <div className="min-h-screen px-4 pb-8">
      {page === "home" && (
        <HomePage
          sessions={sessions}
          onStartSession={handleStartSession}
          onRefresh={fetchSessions}
          onOpenVocab={() => setPage("vocab")}
          onOpenGrammar={() => setPage("grammar")}
          onOpenListeningVocab={() => setPage("listening-vocab")}
        />
      )}

      {page === "exercise" && sessionName && (
        <Exercise
          sessionName={sessionName}
          totalSegments={totalSegments}
          startIdx={startIdx}
          onComplete={handleComplete}
          onBack={goHome}
        />
      )}

      {page === "complete" && finalStats && (
        <CompletionPage stats={finalStats} onRestart={goHome} />
      )}

      {page === "vocab" && <VocabList onBack={goHome} onPractice={() => setPage("practice")} />}

      {page === "practice" && <VocabPractice onBack={() => setPage("vocab")} />}

      {page === "grammar" && <GrammarList onBack={goHome} onPractice={() => setPage("grammar-practice")} />}

      {page === "grammar-practice" && <GrammarPractice onBack={() => setPage("grammar")} />}

      {page === "listening-vocab" && <ListeningVocabList onBack={goHome} onPractice={() => setPage("listening-practice")} />}

      {page === "listening-practice" && <ListeningPractice onBack={() => setPage("listening-vocab")} />}
    </div>
  );
}

export default App;
