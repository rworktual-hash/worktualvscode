#!/usr/bin/env python3
"""
Test script to verify the search functionality in the VS Code: extension backend.
"""

import sys
import os

# Add the python directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

# Import the backend functions
from backend import (
    find_files_by_keyword,
    find_folders_by_keyword,
    search_in_file_content,
    get_file_info,
    format_search_results,
    WORKSPACE_PATH
)

def test_file_search():
    """Test file search functionality."""
    print("=" * 60)
    print("TEST 1: File Search by Keyword")
    print("=" * 60)
    
    # Search for Python files
    results = find_files_by_keyword("strong", file_type=".py", max_results=5)
    print(format_search_results(results, "files"))
    print()
    
    # Search for any file with "number" in name
    results = find_files_by_keyword("number", max_results=5)
    print(format_search_results(results, "files"))
    print()

def test_folder_search():
    """Test folder search functionality."""
    print("=" * 60)
    print("TEST 2: Folder Search by Keyword")
    print("=" * 60)
    
    # Search for folders with "code" in name
    results = find_folders_by_keyword("code", max_results=5)
    print(format_search_results(results, "folders"))
    print()
    
    # Search for folders with "backend" in name
    results = find_folders_by_keyword("backend", max_results=5)
    print(format_search_results(results, "folders"))
    print()

def test_content_search():
    """Test content search functionality."""
    print("=" * 60)
    print("TEST 3: Content Search in Files")
    print("=" * 60)
    
    # Search for "def " in Python files
    results = search_in_file_content("def ", file_pattern="*.py", max_results=3)
    print(format_search_results(results, "content matches"))
    print()

def test_file_info():
    """Test file info functionality."""
    print("=" * 60)
    print("TEST 4: File Information")
    print("=" * 60)
    
    # Get info about a specific file
    info = get_file_info("python/backend.py")
    if 'error' not in info:
        print(f"[OK] File Information:")
        print("-" * 40)
        for key, value in info.items():
            if key != 'full_path':
                print(f"{key.replace('_', ' ').title()}: {value}")
    else:
        print(f"[ERROR] {info['error']}")
    print()

def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("VS CODE: EXTENSION - SEARCH FUNCTIONALITY TESTS")
    print("=" * 60)
    print(f"Workspace: {WORKSPACE_PATH}")
    print()
    
    try:
        test_file_search()
        test_folder_search()
        test_content_search()
        test_file_info()
        
        print("=" * 60)
        print("ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
    except Exception as e:
        print(f"[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
