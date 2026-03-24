"""
SM-2 Spaced Repetition algorithm — shared by vocab, grammar, and listening_vocab.
"""


def sm2_update(
    quality: int,
    easiness_factor: float,
    repetition: int,
    interval_days: int,
) -> tuple[float, int, int]:
    """
    Apply SM-2 algorithm.
    quality: 0, 3, or 5  (mapped from user score 0, 1, 2)
    Returns: (new_ef, new_repetition, new_interval)
    """
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality >= 1:  # Correct (quality 1, 2, 3, or 5)
        if repetition == 0:
            new_interval = 1
        elif repetition == 1:
            new_interval = 6
        else:
            new_interval = max(1, round(interval_days * new_ef))
        new_repetition = repetition + 1
    else:  # Failed (quality 0)
        new_repetition = 0
        new_interval = 1

    return new_ef, new_repetition, new_interval
