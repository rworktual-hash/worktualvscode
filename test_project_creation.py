"""
Test script for the new create_project functionality
"""

import sys
import os
import json

# Add the python directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

from python.backend import create_project, find_files_by_keyword, find_folders_by_keyword

def test_create_project():
    """Test creating a multi-file project"""
    print("=" * 60)
    print("TESTING: create_project functionality")
    print("=" * 60)
    
    # Test data - simulating a Twitter Bot project
    test_files = [
        {
            "path": "config.py",
            "content": "# Twitter Bot Configuration\n\nAPI_KEY = 'your_api_key'\nAPI_SECRET = 'your_api_secret'\nACCESS_TOKEN = 'your_access_token'\nACCESS_TOKEN_SECRET = 'your_access_token_secret'\n"
        },
        {
            "path": "bot_engine.py",
            "content": "# Bot Engine\nimport tweepy\n\nclass TwitterBot:\n    def __init__(self, config):\n        self.config = config\n        self.api = None\n    \n    def authenticate(self):\n        auth = tweepy.OAuthHandler(self.config['api_key'], self.config['api_secret'])\n        return True\n"
        },
        {
            "path": "main.py",
            "content": "# Main Entry Point\nfrom config import *\nfrom bot_engine import TwitterBot\n\ndef main():\n    print('Twitter Bot starting...')\n    bot = TwitterBot({})\n    bot.authenticate()\n\nif __name__ == '__main__':\n    main()\n"
        },
        {
            "path": "requirements.txt",
            "content": "tweepy>=4.14.0\npython-dotenv>=1.0.0\n"
        }
    ]
    
    # Create the project
    result = create_project("test_twitter_bot", test_files)
    print(result)
    print()
    
    # Verify files were created
    project_path = os.path.join(os.path.dirname(__file__), "test_twitter_bot")
    if os.path.exists(project_path):
        print("✅ Project folder created successfully")
        
        expected_files = ["config.py", "bot_engine.py", "main.py", "requirements.txt"]
        for filename in expected_files:
            filepath = os.path.join(project_path, filename)
            if os.path.exists(filepath):
                print(f"  ✅ {filename} created")
                with open(filepath, 'r') as f:
                    content = f.read()
                    print(f"     Size: {len(content)} characters")
            else:
                print(f"  ❌ {filename} NOT found")
    else:
        print("❌ Project folder was not created")
    
    print()
    return result

def test_search_functionality():
    """Test file and folder search"""
    print("=" * 60)
    print("TESTING: Search functionality")
    print("=" * 60)
    
    # Search for files with "test" in name
    print("\n1. Searching for files with 'test' in name:")
    files = find_files_by_keyword("test", max_results=5)
    print(f"   Found {len(files)} files")
    for f in files[:3]:
        print(f"   - {f['name']} ({f['path']})")
    
    # Search for folders with "bot" in name
    print("\n2. Searching for folders with 'bot' in name:")
    folders = find_folders_by_keyword("bot", max_results=5)
    print(f"   Found {len(folders)} folders")
    for f in folders[:3]:
        print(f"   - {f['name']}/ ({f['file_count']} files)")
    
    print()

if __name__ == "__main__":
    # Run tests
    test_create_project()
    test_search_functionality()
    
    print("=" * 60)
    print("All tests completed!")
    print("=" * 60)
