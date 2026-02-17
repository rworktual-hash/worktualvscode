"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Backend = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const child_process = __importStar(require("child_process")); // For running files
class Backend {
    constructor(context) {
        this.outputBuffer = '';
        this.RENDER_BACKEND_URL = 'https://ai-code-backend1.onrender.com';
        // Pending confirmation data (for file overwrite etc.)
        this.pendingConfirmation = null;
        this.context = context;
    }
    // ------------------------------------------------------------------------
    // Workspace helper methods (restored from original)
    // ------------------------------------------------------------------------
    getWorkspaceRoot() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return workspaceFolders[0].uri.fsPath;
    }
    validateWorkspace() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot && this.view) {
            this.view.webview.postMessage({
                type: 'error',
                text: 'Please open a folder before generating files.'
            });
        }
        return workspaceRoot;
    }
    async createFileInWorkspace(relativePath, content) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return false;
        try {
            const fullPath = path.join(workspaceRoot, relativePath);
            const fullDirPath = path.dirname(fullPath);
            if (!fs.existsSync(fullDirPath)) {
                fs.mkdirSync(fullDirPath, { recursive: true });
            }
            fs.writeFileSync(fullPath, content, 'utf8');
            // Open the file in the editor
            await vscode.window.showTextDocument(vscode.Uri.file(fullPath), {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: false
            });
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'status',
                    text: `Created: ${relativePath}`
                });
            }
            return true;
        }
        catch (error) {
            console.error('Failed to create file:', error);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: `Failed to create file ${relativePath}: ${error}`
                });
            }
            return false;
        }
    }
    async createFilesInWorkspace(files) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return false;
        let allSuccess = true;
        for (const file of files) {
            const success = await this.createFileInWorkspace(file.path, file.content);
            if (!success)
                allSuccess = false;
        }
        return allSuccess;
    }
    // ------------------------------------------------------------------------
    // Webview
    // ------------------------------------------------------------------------
    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };
        webviewView.webview.html = this.getWebviewContent();
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'sendMessage':
                    this.handleMessage(message.text, message.files);
                    return;
                case 'openPreview':
                    if (message.url) {
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                    }
                    return;
            }
        }, undefined, this.context.subscriptions);
        // Start the Python backend
        // Send ready signal immediately - no backend to start
        if (this.view) {
            this.view.webview.postMessage({
                type: 'ready',
                text: 'Hello! What would you like to work on today?'
            });
        }
    }
    getWebviewContent() {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'chat.html');
        try {
            return fs.readFileSync(htmlPath, 'utf8');
        }
        catch (error) {
            return this.getDefaultHtml();
        }
    }
    getDefaultHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Assistant</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        #chat-container {
            height: 80vh;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            padding: 10px;
            margin-bottom: 10px;
        }
        #input-container {
            display: flex;
            gap: 10px;
        }
        #user-input {
            flex: 1;
            padding: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        button {
            padding: 10px 20px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 5px;
        }
        .user-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .assistant-message {
            background-color: var(--vscode-editor-selectionBackground);
        }
        .error-message {
            background-color: var(--vscode-editorError-foreground);
            color: white;
        }
        .status-message {
            background-color: var(--vscode-editorInfo-foreground);
            color: var(--vscode-editor-background);
            font-style: italic;
            font-size: 0.9em;
        }
        .website-complete-message {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-terminal-ansiGreen);
        }
        .preview-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 8px 16px;
            margin: 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        .preview-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .typing {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .progress-bar {
            width: 100%;
            height: 4px;
            background-color: var(--vscode-progressBar-background);
            margin-top: 5px;
        }
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div id="chat-container"></div>
    <div id="input-container">
        <input type="text" id="user-input" placeholder="Type your message..." />
        <button onclick="sendMessage()">Send</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chat-container');
        const userInput = document.getElementById('user-input');
        let isTyping = false;

        function sendMessage() {
            const text = userInput.value.trim();
            if (text && !isTyping) {
                addMessage(text, 'user');
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                userInput.value = '';
                isTyping = true;
                addMessage('...', 'assistant', true);
            }
        }

        function addMessage(text, sender, isTyping = false, extraData = {}) {
            const div = document.createElement('div');
            div.className = 'message ' + sender + '-message';
            if (isTyping) {
                div.classList.add('typing');
                div.id = 'typing-indicator';
            }
            
            // Handle special message types
            if (extraData.type === 'website_complete') {
                div.className = 'message website-complete-message';
                div.innerHTML = formatWebsiteCompleteMessage(extraData);
            } else {
                div.textContent = (sender === 'user' ? 'You: ' : 'AI: ') + text;
            }
            
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function formatWebsiteCompleteMessage(data) {
            let html = '<div style="font-weight: bold; margin-bottom: 10px;">🎉 Website Generated Successfully!</div>';
            html += '<div style="margin-bottom: 10px;">' + data.text.replace(/\\\\n/g, '<br>') + '</div>';
            
            if (data.preview_url) {
                html += '<button class="preview-button" onclick="openPreview(\\\\'' + data.preview_url + '\\\\')">🌐 Open Preview</button>';
            }
            
            return html;
        }

        function openPreview(url) {
            vscode.postMessage({
                command: 'openPreview',
                url: url
            });
        }

        function updateTypingIndicator(text, extraData = {}) {
            const typing = document.getElementById('typing-indicator');
            if (typing) {
                if (extraData.type === 'website_complete') {
                    typing.remove();
                    isTyping = false;
                    addMessage('', 'assistant', false, extraData);
                } else {
                    typing.textContent = 'AI: ' + text;
                    typing.classList.remove('typing');
                }
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'response':
                    const typing = document.getElementById('typing-indicator');
                    if (typing) {
                        typing.remove();
                    }
                    isTyping = false;
                    addMessage(message.text, 'assistant');
                    break;
                    
                case 'error':
                    const errorTyping = document.getElementById('typing-indicator');
                    if (errorTyping) {
                        errorTyping.remove();
                    }
                    isTyping = false;
                    addMessage(message.text, 'assistant');
                    break;
                    
                case 'ready':
                    addMessage(message.text, 'assistant');
                    break;
                    
                case 'status':
                    // Update typing indicator with status
                    updateTypingIndicator(message.text);
                    break;
                    
                case 'website_complete':
                    updateTypingIndicator('', message);
                    break;
                    
                case 'confirmation':
                    const confirmTyping = document.getElementById('typing-indicator');
                    if (confirmTyping) {
                        confirmTyping.remove();
                    }
                    isTyping = false;
                    addMessage(message.text, 'assistant');
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>`;
    }
    httpsPost(url, data) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => { resolve(responseData); });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
    async handleMessage(text, files) {
        console.log('Handling message:', text);
        // Show thinking indicator
        if (this.view) {
            this.view.webview.postMessage({ type: 'thinking' });
        }
        try {
            const postData = JSON.stringify({ prompt: text });
            const response = await this.httpsPost(`${this.RENDER_BACKEND_URL}/generate`, postData);
            const data = JSON.parse(response); // Backend should return { response: "..." }
            let assistantReply = data.response || JSON.stringify(data);
            // --------------------------------------------------------------------
            // Extract and execute JSON actions from the assistant's reply
            // --------------------------------------------------------------------
            const actionResults = [];
            const jsonObjects = this.extractJsonObjects(assistantReply);
            if (jsonObjects.length > 0) {
                for (const actionData of jsonObjects) {
                    try {
                        const result = await this.executeAction(actionData);
                        if (result)
                            actionResults.push(result);
                    }
                    catch (err) {
                        actionResults.push(`[ERROR] Failed to execute action: ${err}`);
                    }
                }
            }
            // If we extracted actions and executed them, send the combined result
            if (actionResults.length > 0) {
                // Remove the original JSON parts from the reply (optional)
                const cleanedReply = this.removeJsonFromText(assistantReply);
                const finalResponse = cleanedReply + (cleanedReply ? '\n\n' : '') + actionResults.join('\n\n');
                this.view?.webview.postMessage({ type: 'response', text: finalResponse });
            }
            else {
                // No actions, just the reply
                this.view?.webview.postMessage({ type: 'response', text: assistantReply });
            }
        }
        catch (error) {
            console.error('Failed to call backend API:', error);
            this.view?.webview.postMessage({
                type: 'error',
                text: `Failed to connect to AI Assistant: ${error}. Please check your internet connection.`
            });
        }
    }
    // ------------------------------------------------------------------------
    // JSON action execution (restored from original Python logic)
    // ------------------------------------------------------------------------
    async executeAction(actionData) {
        const action = (actionData.action || actionData.intent || '').toString().toLowerCase().replace(/\s+/g, '_');
        // CREATE FOLDER
        if (action.includes('create_folder') || action === 'createfolder') {
            const folder = actionData.folder || actionData.name;
            if (!folder)
                return '[ERROR] Missing folder name';
            return this.createFolder(folder);
        }
        // CREATE PROJECT (multiple files)
        if (action.includes('create_project') || action === 'createproject') {
            const folder = actionData.folder || actionData.name || actionData.project;
            const files = actionData.files || [];
            if (!folder || !files.length)
                return '[ERROR] Missing folder name or files list';
            return this.createProject(folder, files);
        }
        // CREATE FILE
        if (action.includes('create_file') || action === 'createfile') {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const content = actionData.content || '';
            if (!filePath)
                return '[ERROR] Missing file path';
            return this.createFile(filePath, content);
        }
        // UPDATE FILE
        if (action.includes('update_file') || action === 'updatefile') {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const content = actionData.content || '';
            if (!filePath)
                return '[ERROR] Missing file path';
            return this.updateFile(filePath, content);
        }
        // DEBUG FILE (auto-fix) – same as update_file for now
        if (action.includes('debug_file') || action === 'debugfile') {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const content = actionData.content || '';
            if (!filePath)
                return '[ERROR] Missing file path';
            return this.updateFile(filePath, content);
        }
        // RUN FILE
        if (action.includes('run_file') || action === 'runfile' || action.includes('test_file')) {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const environment = actionData.environment || 'none';
            if (!filePath)
                return '[ERROR] Missing file path';
            return this.runFile(filePath, environment);
        }
        // SEARCH FILES
        if (action.includes('search_files') || action === 'searchfiles') {
            const keyword = actionData.keyword || actionData.search || actionData.query;
            const fileType = actionData.file_type || actionData.extension;
            const maxResults = actionData.max_results || 10;
            if (!keyword)
                return '[ERROR] Missing search keyword';
            const results = this.searchFiles(keyword, fileType, maxResults);
            return this.formatSearchResults(results, 'files');
        }
        // SEARCH FOLDERS
        if (action.includes('search_folders') || action === 'searchfolders') {
            const keyword = actionData.keyword || actionData.search || actionData.query;
            const maxResults = actionData.max_results || 10;
            if (!keyword)
                return '[ERROR] Missing search keyword';
            const results = this.searchFolders(keyword, maxResults);
            return this.formatSearchResults(results, 'folders');
        }
        // SEARCH IN FILES (content)
        if (action.includes('search_in_files') || action === 'searchinfiles' || action === 'grep') {
            const keyword = actionData.keyword || actionData.search || actionData.query;
            const filePattern = actionData.file_pattern || actionData.pattern || '*';
            const maxResults = actionData.max_results || 10;
            if (!keyword)
                return '[ERROR] Missing search keyword';
            const results = this.searchInFiles(keyword, filePattern, maxResults);
            return this.formatSearchResults(results, 'content matches');
        }
        // GET FILE INFO
        if (action.includes('get_file_info') || action === 'getfileinfo' || action === 'file_info') {
            const filePath = actionData.path || actionData.file || actionData.filename;
            if (!filePath)
                return '[ERROR] Missing file path';
            const info = this.getFileInfo(filePath);
            return this.formatFileInfo(info);
        }
        return `[INFO] Unknown action: ${action}`;
    }
    // ------------------------------------------------------------------------
    // File system action implementations (ported from original Python)
    // ------------------------------------------------------------------------
    createFolder(folder) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return '[ERROR] No workspace open';
        const fullPath = path.join(workspaceRoot, folder);
        try {
            if (fs.existsSync(fullPath)) {
                return `[INFO] Folder '${fullPath}' already exists.`;
            }
            fs.mkdirSync(fullPath, { recursive: true });
            return `[OK] Folder '${fullPath}' created.`;
        }
        catch (err) {
            return `[ERROR] ${err}`;
        }
    }
    createProject(folder, files) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return '[ERROR] No workspace open';
        const projectPath = path.join(workspaceRoot, folder);
        const results = [];
        try {
            if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true });
                results.push(`[OK] Created project folder: ${projectPath}`);
            }
            else {
                results.push(`[INFO] Project folder '${folder}' already exists.`);
            }
            let created = 0, updated = 0, errors = 0;
            for (const file of files) {
                try {
                    const relPath = file.path;
                    const fullPath = path.join(projectPath, relPath);
                    const parentDir = path.dirname(fullPath);
                    if (!fs.existsSync(parentDir)) {
                        fs.mkdirSync(parentDir, { recursive: true });
                    }
                    const exists = fs.existsSync(fullPath);
                    fs.writeFileSync(fullPath, file.content, 'utf8');
                    const displayPath = path.join(folder, relPath);
                    if (exists) {
                        results.push(`[UPDATED] ${displayPath}`);
                        updated++;
                    }
                    else {
                        results.push(`[CREATED] ${displayPath}`);
                        created++;
                    }
                }
                catch (e) {
                    results.push(`[ERROR] Failed to create ${file.path}: ${e}`);
                    errors++;
                }
            }
            results.push(`[SUMMARY] Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
            return results.join('\n');
        }
        catch (err) {
            return `[ERROR] Failed to create project: ${err}`;
        }
    }
    createFile(filePath, content) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return '[ERROR] No workspace open';
        const fullPath = path.join(workspaceRoot, filePath);
        // Check if file already exists (simple check)
        if (fs.existsSync(fullPath)) {
            // Ask for confirmation (store pending and return confirmation request)
            this.pendingConfirmation = {
                action: 'create_file',
                path: filePath,
                content: content
            };
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'confirmation',
                    text: `File '${filePath}' already exists. Overwrite? (yes/no)`,
                    action: this.pendingConfirmation
                });
            }
            return `[CONFIRMATION_REQUIRED] File exists. Waiting for user response.`;
        }
        try {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf8');
            // Open file
            vscode.window.showTextDocument(vscode.Uri.file(fullPath));
            return `[OK] Created: ${filePath}`;
        }
        catch (err) {
            return `[ERROR] ${err}`;
        }
    }
    updateFile(filePath, content) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return '[ERROR] No workspace open';
        const fullPath = path.join(workspaceRoot, filePath);
        if (!fs.existsSync(fullPath)) {
            // File doesn't exist – ask to create?
            this.pendingConfirmation = {
                action: 'update_file',
                path: filePath,
                content: content
            };
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'confirmation',
                    text: `File '${filePath}' does not exist. Create it? (yes/no)`,
                    action: this.pendingConfirmation
                });
            }
            return `[CONFIRMATION_REQUIRED] File not found.`;
        }
        try {
            fs.writeFileSync(fullPath, content, 'utf8');
            return `[OK] Updated: ${filePath}`;
        }
        catch (err) {
            return `[ERROR] ${err}`;
        }
    }
    runFile(filePath, environment) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return '[ERROR] No workspace open';
        const fullPath = path.join(workspaceRoot, filePath);
        if (!fs.existsSync(fullPath)) {
            return `[ERROR] File '${filePath}' not found.`;
        }
        // Simple execution based on extension
        let command;
        if (filePath.endsWith('.py')) {
            command = `python "${fullPath}"`;
        }
        else if (filePath.endsWith('.js')) {
            command = `node "${fullPath}"`;
        }
        else if (filePath.endsWith('.sh')) {
            command = `bash "${fullPath}"`;
        }
        else {
            return `[ERROR] Unsupported file type for execution.`;
        }
        try {
            const output = child_process.execSync(command, { encoding: 'utf8', timeout: 10000 });
            return `[RUN] Output:\n${output}`;
        }
        catch (err) {
            return `[ERROR] Execution failed:\n${err.stderr || err.message}`;
        }
    }
    // ------------------------------------------------------------------------
    // Search methods (simplified versions)
    // ------------------------------------------------------------------------
    searchFiles(keyword, fileType, maxResults = 10) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return [{ error: 'No workspace open' }];
        const results = [];
        const walk = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                        walk(fullPath);
                    }
                }
                else {
                    if (entry.name.toLowerCase().includes(keyword.toLowerCase())) {
                        if (fileType && !entry.name.endsWith(fileType))
                            continue;
                        results.push({
                            name: entry.name,
                            path: path.relative(workspaceRoot, fullPath),
                            size: fs.statSync(fullPath).size,
                            modified: new Date(fs.statSync(fullPath).mtime).toLocaleString()
                        });
                        if (results.length >= maxResults)
                            return;
                    }
                }
            }
        };
        walk(workspaceRoot);
        return results;
    }
    searchFolders(keyword, maxResults = 10) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return [{ error: 'No workspace open' }];
        const results = [];
        const walk = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.name.toLowerCase().includes(keyword.toLowerCase())) {
                        results.push({
                            name: entry.name,
                            path: path.relative(workspaceRoot, fullPath),
                            file_count: fs.readdirSync(fullPath).length
                        });
                        if (results.length >= maxResults)
                            return;
                    }
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                        walk(fullPath);
                    }
                }
            }
        };
        walk(workspaceRoot);
        return results;
    }
    searchInFiles(keyword, filePattern = '*', maxResults = 10) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return [{ error: 'No workspace open' }];
        const results = [];
        const textExtensions = ['.py', '.js', '.ts', '.html', '.css', '.json', '.md', '.txt', '.xml', '.yaml', '.yml'];
        const walk = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                        walk(fullPath);
                    }
                }
                else {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!textExtensions.includes(ext))
                        continue;
                    if (filePattern !== '*' && !entry.name.includes(filePattern.replace('*', '')))
                        continue;
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const lines = content.split('\n');
                        const matches = [];
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
                                matches.push({ line: i + 1, content: lines[i].trim().substring(0, 100) });
                                if (matches.length >= 3)
                                    break;
                            }
                        }
                        if (matches.length > 0) {
                            results.push({
                                name: entry.name,
                                path: path.relative(workspaceRoot, fullPath),
                                matches: matches.length,
                                lines: matches
                            });
                            if (results.length >= maxResults)
                                return;
                        }
                    }
                    catch (e) { /* ignore unreadable */ }
                }
            }
        };
        walk(workspaceRoot);
        return results;
    }
    getFileInfo(filePath) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return { error: 'No workspace open' };
        const fullPath = path.join(workspaceRoot, filePath);
        if (!fs.existsSync(fullPath))
            return { error: 'File not found' };
        const stat = fs.statSync(fullPath);
        return {
            name: path.basename(fullPath),
            path: path.relative(workspaceRoot, fullPath),
            size: stat.size,
            created: stat.birthtime.toLocaleString(),
            modified: stat.mtime.toLocaleString(),
            isDirectory: stat.isDirectory()
        };
    }
    formatSearchResults(results, type) {
        if (results.length === 0)
            return `[INFO] No ${type} found.`;
        if (results[0].error)
            return `[ERROR] ${results[0].error}`;
        const lines = [`[OK] Found ${results.length} ${type}:`];
        results.forEach((r, i) => {
            lines.push(`${i + 1}. ${r.name} (${r.path})`);
            if (type === 'files')
                lines.push(`   Size: ${r.size} bytes, Modified: ${r.modified}`);
            if (type === 'folders')
                lines.push(`   Files: ${r.file_count}`);
            if (type === 'content matches') {
                lines.push(`   Matches: ${r.matches}`);
                r.lines.forEach((l) => lines.push(`      Line ${l.line}: ${l.content}`));
            }
        });
        return lines.join('\n');
    }
    formatFileInfo(info) {
        if (info.error)
            return `[ERROR] ${info.error}`;
        return `[OK] File Info:\nName: ${info.name}\nPath: ${info.path}\nSize: ${info.size} bytes\nCreated: ${info.created}\nModified: ${info.modified}`;
    }
    // ------------------------------------------------------------------------
    // JSON extraction helpers
    // ------------------------------------------------------------------------
    extractJsonObjects(text) {
        const objects = [];
        const regex = /\{[\s\S]*?\}/g; // simple greedy match (may fail for nested)
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const obj = JSON.parse(match[0]);
                objects.push(obj);
            }
            catch { /* ignore invalid JSON */ }
        }
        return objects;
    }
    removeJsonFromText(text) {
        // Remove all JSON-like blocks (crude)
        return text.replace(/\{[\s\S]*?\}/g, '').trim();
    }
    // ------------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------------
    dispose() {
        // Nothing to clean up
    }
}
exports.Backend = Backend;
//# sourceMappingURL=backend.js.map