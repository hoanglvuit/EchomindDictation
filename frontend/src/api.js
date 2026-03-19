const API_BASE = "/api";

async function request(url, options = {}) {
    const resp = await fetch(`${API_BASE}${url}`, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || err.error || "Request failed");
    }
    return resp.json();
}

export async function listSessions() {
    return request("/sessions");
}

export async function loadSession(name) {
    return request(`/load/${encodeURIComponent(name)}`);
}

export async function deleteSession(name) {
    return request(`/sessions/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function getSegment(sessionName, segmentId) {
    return request(`/segment/${encodeURIComponent(sessionName)}/${segmentId}`);
}

export async function saveProgress(sessionName, segmentIndex) {
    return request("/progress", {
        method: "POST",
        body: JSON.stringify({ session_name: sessionName, segment_index: segmentIndex }),
    });
}

export function getAudioUrl(sessionName, filename) {
    return `${API_BASE}/audio/${encodeURIComponent(sessionName)}/${filename}`;
}

export async function uploadAudio(file, vadParams = {}) {
    const formData = new FormData();
    formData.append("audio", file);
    if (vadParams.threshold !== undefined) formData.append("vad_threshold", vadParams.threshold);

    const resp = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || err.error || "Upload failed");
    }
    return resp.json();
}

export async function checkAnswer(sessionName, segmentId, userText) {
    return request("/check", {
        method: "POST",
        body: JSON.stringify({
            session_name: sessionName,
            segment_id: segmentId,
            user_text: userText,
        }),
    });
}

export async function showAnswer(sessionName, segmentId) {
    return request("/answer", {
        method: "POST",
        body: JSON.stringify({
            session_name: sessionName,
            segment_id: segmentId,
        }),
    });
}

export async function getHint(sessionName, segmentId, userText) {
    return request("/hint", {
        method: "POST",
        body: JSON.stringify({
            session_name: sessionName,
            segment_id: segmentId,
            user_text: userText,
        }),
    });
}

export async function saveVocab(word, pronunciation, definitions, general_meaning, audio_url) {
    return request("/vocab", {
        method: "POST",
        body: JSON.stringify({ word, pronunciation, definitions, general_meaning, audio_url }),
    });
}

export async function updateVocab(id, word, pronunciation, definitions, general_meaning, audio_url) {
    return request(`/vocab/${id}`, {
        method: "PUT",
        body: JSON.stringify({ word, pronunciation, definitions, general_meaning, audio_url }),
    });
}

export async function scrapeVocab(url) {
    return request("/vocab/scrape", {
        method: "POST",
        body: JSON.stringify({ url }),
    });
}


export async function listVocab() {
    return request("/vocab");
}

export async function deleteVocab(id) {
    return request(`/vocab/${id}`, { method: "DELETE" });
}

export async function getVocabPractice() {
    return request("/vocab/practice");
}

export async function submitVocabPractice(vocabId, quality) {
    return request("/vocab/practice/submit", {
        method: "POST",
        body: JSON.stringify({ vocab_id: vocabId, quality }),
    });
}

// --- Grammar APIs ---

export async function saveGrammar(structure, meaning, examples) {
    return request("/grammar", {
        method: "POST",
        body: JSON.stringify({ structure, meaning, examples }),
    });
}

export async function updateGrammar(id, structure, meaning, examples) {
    return request(`/grammar/${id}`, {
        method: "PUT",
        body: JSON.stringify({ structure, meaning, examples }),
    });
}

export async function listGrammar() {
    return request("/grammar");
}

export async function deleteGrammar(id) {
    return request(`/grammar/${id}`, { method: "DELETE" });
}

export async function getGrammarPractice() {
    return request("/grammar/practice");
}

export async function submitGrammarPractice(grammarId, quality) {
    return request("/grammar/practice/submit", {
        method: "POST",
        body: JSON.stringify({ grammar_id: grammarId, quality }),
    });
}

// --- Listening Vocab APIs ---

export async function saveListeningVocab(word, audio_url) {
    return request("/listening-vocab", {
        method: "POST",
        body: JSON.stringify({ word, audio_url }),
    });
}

export async function listListeningVocab() {
    return request("/listening-vocab");
}

export async function updateListeningVocab(id, word, audio_url) {
    return request(`/listening-vocab/${id}`, {
        method: "PUT",
        body: JSON.stringify({ word, audio_url }),
    });
}

export async function deleteListeningVocab(id) {
    return request(`/listening-vocab/${id}`, { method: "DELETE" });
}

export async function scrapeListeningVocab(url) {
    return request("/listening-vocab/scrape", {
        method: "POST",
        body: JSON.stringify({ url }),
    });
}

export async function getListeningPractice() {
    return request("/listening-vocab/practice");
}

export async function submitListeningPractice(id, quality) {
    return request("/listening-vocab/practice/submit", {
        method: "POST",
        body: JSON.stringify({ id, quality }),
    });
}
