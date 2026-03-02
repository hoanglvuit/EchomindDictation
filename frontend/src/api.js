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
    if (vadParams.max !== undefined) formData.append("vad_max", vadParams.max);
    if (vadParams.min !== undefined) formData.append("vad_min", vadParams.min);
    if (vadParams.k !== undefined) formData.append("vad_k", vadParams.k);
    if (vadParams.t0 !== undefined) formData.append("vad_t0", vadParams.t0);
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

export async function saveVocab(word, pronunciation, definitions, audio_url) {
    return request("/vocab", {
        method: "POST",
        body: JSON.stringify({ word, pronunciation, definitions, audio_url }),
    });
}

export async function updateVocab(id, word, pronunciation, definitions, audio_url) {
    return request(`/vocab/${id}`, {
        method: "PUT",
        body: JSON.stringify({ word, pronunciation, definitions, audio_url }),
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
