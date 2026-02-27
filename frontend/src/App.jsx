import { useState, useEffect, useCallback } from "react";
import { listSessions } from "./api";
import HomePage from "./components/HomePage";
import Exercise from "./components/Exercise";
import CompletionPage from "./components/CompletionPage";
import VocabList from "./components/VocabList";

function App() {
  const [page, setPage] = useState("home"); // home | exercise | complete | vocab
  const [sessions, setSessions] = useState([]);
  const [sessionName, setSessionName] = useState(null);
  const [totalSegments, setTotalSegments] = useState(0);
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

  const handleStartSession = (name, total) => {
    setSessionName(name);
    setTotalSegments(total);
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
        />
      )}

      {page === "exercise" && sessionName && (
        <Exercise
          sessionName={sessionName}
          totalSegments={totalSegments}
          onComplete={handleComplete}
          onBack={goHome}
        />
      )}

      {page === "complete" && finalStats && (
        <CompletionPage stats={finalStats} onRestart={goHome} />
      )}

      {page === "vocab" && <VocabList onBack={goHome} />}
    </div>
  );
}

export default App;
