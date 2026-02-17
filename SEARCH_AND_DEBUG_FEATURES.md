# Enhanced File Search & Debug Features

## Overview
The VS Code: extension backend has been enhanced with powerful file/folder search capabilities and improved error debugging functionality.

## New Features

### 1. File/Folder Search Actions

#### Search Files by Keyword
```json
{
  "action": "search_files",
  "keyword": "config",
  "file_type": ".py",
  "max_results": 10
}
```
- Searches for files containing the keyword in their name
- Supports optional file type filtering (e.g., `.py`, `.js`)
- Returns file name, path, size, and modification date

#### Search Folders by Keyword
```json
{
  "action": "search_folders",
  "keyword": "test",
  "max_results": 10
}
```
- Searches for folders containing the keyword in their name
- Returns folder name, path, and file count

#### Search Inside Files (Content Search)
```json
{
  "action": "search_in_files",
  "keyword": "function",
  "file_pattern": "*.py",
  "max_results": 10
}
```
- Searches for text inside file contents
- Supports file pattern filtering (e.g., `*.py`, `*.js`)
- Returns matching files with line numbers and content snippets

#### Get File Information
```json
{
  "action": "get_file_info",
  "path": "config.py"
}
```
- Returns detailed file/folder information:
  - Name, path, size (human-readable)
  - Creation, modification, access dates
  - For folders: item count, file count, folder count

### 2. Project Creation (Multi-File)

Create entire project structures in one action:

```json
{
  "action": "create_project",
  "folder": "my_project",
  "files": [
    {
      "path": "config.py",
      "content": "# Configuration\nAPI_KEY = 'xxx'"
    },
    {
      "path": "main.py",
      "content": "from config import *\nprint('Hello')"
    },
    {
      "path": "utils/helpers.py",
      "content": "def helper():\n    pass"
    }
  ]
}
```

Features:
- Creates project folder if it doesn't exist
- Creates all files with their content
- Automatically creates subdirectories
- Validates Python syntax for `.py` files
- Provides detailed summary of created/updated files

### 3. Enhanced Debug Features

#### Multi-Stage Debugging
The `debug_file` action now supports multiple stages:

```json
{
  "action": "debug_file",
  "path": "script.py",
  "stage": "all"
}
```

Stages:
- `syntax` - Check for syntax errors only
- `runtime` - Check for runtime errors only
- `logic` - Code quality analysis
- `all` - All stages (default)

#### Detailed Error Analysis
When errors are found, the system provides:
- **Error Type Classification**: Syntax, Runtime, Type, Name, Index, etc.
- **Common Causes**: List of likely causes for the error type
- **Suggested Fixes**: Specific recommendations
- **Line Number & Code Context**: Exact location with surrounding code
- **Auto-Fix**: AI-powered automatic error correction with backup

#### Error Categories Supported
- SyntaxError
- IndentationError
- NameError
- TypeError
- IndexError / KeyError
- AttributeError
- ImportError / ModuleNotFoundError
- ZeroDivisionError
- FileNotFoundError
- RuntimeError (generic)

### 4. Smart File Finding

The backend now automatically searches for files recursively:
- Searches in all subdirectories
- Skips hidden folders (`.git`, `.vscode`, `node_modules`, etc.)
- Returns the first match or all matches based on function
- Provides helpful suggestions when files aren't found

## Usage Examples

### Example 1: Find and Debug a File
```
User: "Find my config file and debug it"

AI: {
  "action": "search_files",
  "keyword": "config",
  "file_type": ".py"
}

[Found config.py at test_twitter_bot/config.py]

AI: {
  "action": "debug_file",
  "path": "test_twitter_bot/config.py",
  "stage": "all"
}
```

### Example 2: Create a Complete Project
```
User: "Create a Flask API project with user authentication"

AI: {
  "action": "create_project",
  "folder": "flask_api",
  "files": [
    {"path": "app.py", "content": "..."},
    {"path": "models.py", "content": "..."},
    {"path": "auth.py", "content": "..."},
    {"path": "requirements.txt", "content": "..."}
  ]
}
```

### Example 3: Search for Code Patterns
```
User: "Find all files that use the requests library"

AI: {
  "action": "search_in_files",
  "keyword": "import requests",
  "file_pattern": "*.py"
}
```

## Implementation Details

### File Structure
- `python/backend.py` - Main backend with all search and debug functions
- `src/backend.ts` - VS Code: extension interface (TypeScript)

### Key Functions Added

**Search Functions:**
- `find_files_by_keyword()` - File name search with wildcards
- `find_folders_by_keyword()` - Folder name search
- `search_in_file_content()` - Text search inside files
- `get_file_info()` - Detailed file/folder metadata
- `format_search_results()` - Human-readable result formatting

**Debug Functions:**
- `analyze_error()` - Categorize and analyze errors
- `format_error_analysis()` - Format error details for display
- `get_syntax_error_suggestion()` - Provide fix suggestions
- `validate_python_code()` - Enhanced syntax validation
- `execute_and_capture_errors()` - Safe code execution

**Project Functions:**
- `create_project()` - Multi-file project creation
- `find_file_recursive()` - Recursive file search

### Safety Features
- Automatic backup before file modifications
- Confirmation prompts for destructive operations
- Syntax validation before file creation
- Safe code execution in isolated environment
- Timeout protection (30s for code execution)

## Testing

Run the test suite:
```bash
python test_project_creation.py
```

This tests:
1. Project creation with multiple files
2. File search by keyword
3. Folder search by keyword
4. File validation and syntax checking

## Future Enhancements

Potential improvements:
- Regex pattern matching for file searches
- Full-text search with indexing
- Integration with version control (git status)
- Code complexity analysis
- Performance profiling for debugged code
- Multi-language support for debugging (JavaScript, TypeScript, etc.)
