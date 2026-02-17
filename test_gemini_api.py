#!/usr/bin/env python3
"""
Test script to verify Gemini API connectivity
"""

import sys
import os

# Add the python directory to path to import the same modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from google import genai

# Test configuration
GEMINI_API_KEY = "AIzaSyDMXJuQ5e4ZeXyX2ECAnAK6HsYPAI_ubZg"
GEMINI_MODEL = "gemini-2.5-pro"

def test_api_connection():
    """Test if we can connect to Gemini API"""
    print("=" * 60)
    print("Testing Gemini API Connection")
    print("=" * 60)
    
    # Check API key
    print(f"\n1. API Key check:")
    print(f"   Key present: {'Yes' if GEMINI_API_KEY else 'No'}")
    print(f"   Key length: {len(GEMINI_API_KEY) if GEMINI_API_KEY else 0}")
    print(f"   Key starts with: {GEMINI_API_KEY[:10]}..." if GEMINI_API_KEY else "   N/A")
    
    # Test client creation
    print(f"\n2. Creating Gemini client...")
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        print("   ✓ Client created successfully")
    except Exception as e:
        print(f"   ✗ Failed to create client: {e}")
        return False
    
    # Test API call
    print(f"\n3. Testing API call with model: {GEMINI_MODEL}")
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents="Say 'Hello from Gemini API test' in one sentence."
        )
        print("   ✓ API call successful")
        print(f"\n4. Response received:")
        print(f"   '{response.text}'")
        return True
        
    except Exception as e:
        print(f"   ✗ API call failed: {e}")
        print(f"\n   Error type: {type(e).__name__}")
        
        # Try with a different model as fallback
        print(f"\n5. Trying with fallback model (gemini-1.5-flash)...")
        try:
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents="Say 'Hello from Gemini API test' in one sentence."
            )
            print("   ✓ Fallback model works!")
            print(f"\n6. Response from fallback:")
            print(f"   '{response.text}'")
            return True
        except Exception as e2:
            print(f"   ✗ Fallback also failed: {e2}")
            return False

if __name__ == "__main__":
    success = test_api_connection()
    print("\n" + "=" * 60)
    if success:
        print("RESULT: ✓ Gemini API is working correctly!")
    else:
        print("RESULT: ✗ Gemini API connection failed")
    print("=" * 60)
    sys.exit(0 if success else 1)
