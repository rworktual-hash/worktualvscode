# Simple stub for emotion detection
# Returns a dictionary with 'label' and 'score'

def detect_emotion(text: str = "") -> dict:
    """
    Stub function to detect emotion from text.
    Returns a fixed structure for now.
    """
    if not isinstance(text, str) or not text.strip():
        return {"label": "neutral", "score": 0.0}

    # Example logic (replace with real model later)
    return {"label": "neutral", "score": 0.75}


# Optional: allow easy import like `from emotion import detect_emotion`
__all__ = ["detect_emotion"]
