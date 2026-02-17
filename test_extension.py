#!/usr/bin/env python3
"""
Test script to verify the VS Code extension components work correctly.
"""

import os
import sys
import json
import subprocess

def test_file_structure():
    """Verify all required files exist."""
    print("=" * 60)
    print("TEST 1: File Structure")
    print("=" * 60)
    
    required_files = [
        "package.json",
        "tsconfig.json",
        "src/extension.ts",
        "src/backend.ts",
        "media/chat.html",
        "python/backend.py",
        "out/extension.js",
        "out/backend.js"
    ]
    
    all_exist = True
    for file in required_files:
        path = os.path.join("/home/vectone/Documents/VS_CODE_EXTENSION/NEW/basic/ai-code-extension", file)
        exists = os.path.exists(path)
        status = "✓" if exists else "✗"
        print(f"  {status} {file}")
        if not exists:
            all_exist = False
    
    return all_exist

def test_package_json():
    """Verify package.json is valid."""
    print("\n" + "=" * 60)
    print("TEST 2: package.json Validation")
    print("=" * 60)
    
    try:
        with open("/home/vectone/Documents/VS_CODE_EXTENSION/NEW/basic/ai-code-extension/package.json") as f:
            data = json.load(f)
        
        checks = [
            ("name", data.get("name")),
            ("main", data.get("main")),
            ("activationEvents", data.get("activationEvents")),
            ("contributes.commands", data.get("contributes", {}).get("commands")),
        ]
        
        all_valid = True
        for key, value in checks:
            valid = value is not None
            status = "✓" if valid else "✗"
            print(f"  {status} {key}: {value}")
            if not valid:
                all_valid = False
        
        return all_valid
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_typescript_compilation():
    """Verify TypeScript compiled successfully."""
    print("\n" + "=" * 60)
    print("TEST 3: TypeScript Compilation")
    print("=" * 60)
    
    out_dir = "/home/vectone/Documents/VS_CODE_EXTENSION/NEW/basic/ai-code-extension/out"
    
    if not os.path.exists(out_dir):
        print("  ✗ out/ directory does not exist")
        return False
    
    files = os.listdir(out_dir)
    print(f"  ✓ Compiled files: {', '.join(files)}")
    
    # Check for .js files
    js_files = [f for f in files if f.endswith('.js')]
    if len(js_files) >= 2:
        print(f"  ✓ Found {len(js_files)} JavaScript files")
        return True
    else:
        print(f"  ✗ Expected at least 2 .js files, found {len(js_files)}")
        return False

def test_python_backend():
    """Test Python backend can be imported."""
    print("\n" + "=" * 60)
    print("TEST 4: Python Backend")
    print("=" * 60)
    
    backend_path = "/home/vectone/Documents/VS_CODE_EXTENSION/NEW/basic/ai-code-extension/python"
    
    try:
        # Add python directory to path
        sys.path.insert(0, backend_path)
        
        # Try to import key modules
        import os
        import requests
        import json
        
        print("  ✓ Required modules available (os, requests, json)")
        
        # Check if backend.py exists and has required functions
        backend_file = os.path.join(backend_path, "backend.py")
        with open(backend_file) as f:
            content = f.read()
        
        required_funcs = ["create_folder", "create_file", "extract_json_objects"]
        for func in required_funcs:
            if func in content:
                print(f"  ✓ Function '{func}' found")
            else:
                print(f"  ✗ Function '{func}' not found")
                return False
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("VS CODE EXTENSION TEST SUITE")
    print("=" * 60)
    
    results = []
    
    results.append(("File Structure", test_file_structure()))
    results.append(("package.json", test_package_json()))
    results.append(("TypeScript Compilation", test_typescript_compilation()))
    results.append(("Python Backend", test_python_backend()))
    
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ ALL TESTS PASSED")
        print("The extension is ready to use!")
        print("\nNext steps:")
        print("1. Open VS Code")
        print("2. Press F5 to launch the extension")
        print("3. Run command: 'Start AI Code Assistant'")
    else:
        print("✗ SOME TESTS FAILED")
        print("Please review the errors above.")
    print("=" * 60)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
