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

export async function getSegment(sessionName, segmentId) {
    return request(`/segment/${encodeURIComponent(sessionName)}/${segmentId}`);
}

export function getAudioUrl(sessionName, filename) {
    return `${API_BASE}/audio/${encodeURIComponent(sessionName)}/${filename}`;
}

export async function uploadAudio(file) {
    const formData = new FormData();
    formData.append("audio", file);
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

export async function saveVocab(word, pronunciation, definitions) {
    return request("/vocab", {
        method: "POST",
        body: JSON.stringify({ word, pronunciation, definitions }),
    });
}

export async function listVocab() {
    return request("/vocab");
}

export async function deleteVocab(id) {
    return request(`/vocab/${id}`, { method: "DELETE" });
}
