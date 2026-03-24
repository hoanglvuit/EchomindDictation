/**
 * Parse audio_url (which can be JSON array or plain string) into a list of audio objects.
 * Used by ListeningPractice and ListeningVocabList.
 * @param {string|null} audioStr
 * @returns {Array<{pos: string, audio_url: string}>}
 */
export function parseAudios(audioStr) {
    if (!audioStr) return [];
    try {
        const parsed = JSON.parse(audioStr);
        if (Array.isArray(parsed)) return parsed.filter(a => a.audio_url);
        return [{ pos: '', audio_url: audioStr }];
    } catch {
        return [{ pos: '', audio_url: audioStr }];
    }
}
