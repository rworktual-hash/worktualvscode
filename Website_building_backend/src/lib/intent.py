# Simple stub for intent detection
# Returns a dictionary with 'intent' and 'confidence'

def detect_intent(text: str = "") -> dict:
    """
    Stub function to detect intent from text.
    Returns a fixed structure for now.
    """
    if not isinstance(text, str) or not text.strip():
        return {"intent": "unknown", "confidence": 0.0}

    # Example logic (replace with real model later)
    return {"intent": "general_query", "confidence": 0.82}


# Optional: allow easy import like `from intent import detect_intent`
__all__ = ["detect_intent"]
