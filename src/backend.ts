import * as vscode from 'vscode';
import * as path from 'path';
import * as https from 'https';
import * as child_process from 'child_process';
import * as fs from 'fs';


export class Backend implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;
    private view?: vscode.WebviewView;
    private outputBuffer: string = '';
    private readonly RENDER_BACKEND_URL = 'https://ai-code-backend1.onrender.com';

    // Pending confirmation data (for file overwrite etc.)
    private pendingConfirmation: any = null;

    // Python backend process
    private pythonProcess?: child_process.ChildProcess;
    private pythonReady: boolean = false;
    private messageQueue: any[] = [];
    private responseHandlers: Map<string, (response: any) => void> = new Map();


    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.startPythonBackend();
    }

    /**
     * Start the Python backend process for file operations
     */
    private startPythonBackend(): void {
        const pythonScriptPath = path.join(this.context.extensionPath, 'python', 'backend.py');
        
        // Check if Python backend exists
        if (!fs.existsSync(pythonScriptPath)) {
            console.error('Python backend not found at:', pythonScriptPath);
            return;
        }

        // Spawn Python process
        this.pythonProcess = child_process.spawn('python', [pythonScriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: this.context.extensionPath
        });

        // Handle Python stdout (responses)
        let buffer = '';
        this.pythonProcess.stdout?.on('data', (data: Buffer) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line);
                        this.handlePythonResponse(response);
                    } catch (e) {
                        console.log('Python output:', line);
                    }
                }
            }
        });

        // Handle Python stderr
        this.pythonProcess.stderr?.on('data', (data: Buffer) => {
            console.error('Python backend error:', data.toString());
        });

        // Handle Python process exit
        this.pythonProcess.on('exit', (code) => {
            console.log(`Python backend exited with code ${code}`);
            this.pythonReady = false;
            this.pythonProcess = undefined;
        });

        // Send workspace path configuration once ready
        setTimeout(() => {
            this.sendToPython({
                type: 'config',
                workspacePath: this.getWorkspaceRoot() || path.join(this.context.extensionPath, 'workspace')
            });
            this.pythonReady = true;
            this.processMessageQueue();
        }, 1000);
    }

    /**
     * Send message to Python backend
     */
    private sendToPython(message: any): void {
        if (this.pythonProcess && this.pythonProcess.stdin) {
            this.pythonProcess.stdin.write(JSON.stringify(message) + '\n');
        }
    }

    /**
     * Process queued messages after Python is ready
     */
    private processMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.sendToPython(message);
            }
        }
    }

    /**
     * Handle responses from Python backend
     */
    private handlePythonResponse(response: any): void {
        // Handle ready signal
        if (response.type === 'ready') {
            this.pythonReady = true;
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'ready',
                    text: response.text || 'Hello! What would you like to work on today?'
                });
            }
            return;
        }

        // Handle status updates
        if (response.type === 'status') {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'status',
                    text: response.text
                });
            }
            return;
        }

        // Handle errors
        if (response.type === 'error') {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: response.text
                });
            }
            return;
        }

        // Handle confirmation requests
        if (response.type === 'confirmation') {
            this.pendingConfirmation = response.action;
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'confirmation',
                    text: response.text,
                    action: response.action
                });
            }
            return;
        }

        // Handle regular responses
        if (response.type === 'response') {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'response',
                    text: response.text
                });
            }
            return;
        }

        // Handle website complete
        if (response.type === 'website_complete') {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'website_complete',
                    text: response.text,
                    preview_url: response.preview_url,
                    zip_url: response.zip_url
                });
            }
            return;
        }
    }

    /**
     * Execute file operation via Python backend
     */
    private async executeFileOperation(action: string, data: any): Promise<string> {
        return new Promise((resolve) => {
            const messageId = Date.now().toString();
            
            // Set up response handler
            this.responseHandlers.set(messageId, (response: any) => {
                resolve(response.result || response.text || 'Operation completed');
            });

            // Send to Python
            this.sendToPython({
                type: 'file_operation',
                id: messageId,
                action: action,
                ...data
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.responseHandlers.has(messageId)) {
                    this.responseHandlers.delete(messageId);
                    resolve('[ERROR] Operation timed out');
                }
            }, 30000);
        });
    }


        // ------------------------------------------------------------------------
    // Workspace helper methods (restored from original)
    // ------------------------------------------------------------------------

    private getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    private validateWorkspace(): string | undefined {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot && this.view) {
            this.view.webview.postMessage({
                type: 'error',
                text: 'Please open a folder before generating files.'
            });
        }
        return workspaceRoot;
    }

    private async createFileInWorkspace(relativePath: string, content: string): Promise<boolean> {
        const result = await this.executeFileOperation('create_file', {
            path: relativePath,
            content: content
        });
        
        // Open the file in the editor if successful
        if (result.includes('[OK]') || result.includes('[CREATED]')) {
            const workspaceRoot = this.getWorkspaceRoot();
            if (workspaceRoot) {
                const fullPath = path.join(workspaceRoot, relativePath);
                try {
                    await vscode.window.showTextDocument(vscode.Uri.file(fullPath), {
                        viewColumn: vscode.ViewColumn.One,
                        preserveFocus: false
                    });
                } catch (e) {
                    // File might not exist yet, that's ok
                }
            }
            
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'status',
                    text: `Created: ${relativePath}`
                });
            }
            return true;
        } else {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: result
                });
            }
            return false;
        }
    }

    private async createFilesInWorkspace(files: Array<{ path: string; content: string }>): Promise<boolean> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) return false;

        let allSuccess = true;
        for (const file of files) {
            const success = await this.createFileInWorkspace(file.path, file.content);
            if (!success) allSuccess = false;
        }
        return allSuccess;
    }

    // ------------------------------------------------------------------------
    // Webview
    // ------------------------------------------------------------------------


    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };

        webviewView.webview.html = this.getWebviewContent();

        webviewView.webview.onDidReceiveMessage(
            (message: any) => {
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
            },
            undefined,
            this.context.subscriptions
        );

        // Start the Python backend
        // Send ready signal immediately - no backend to start
        if (this.view) {
            this.view.webview.postMessage({
                type: 'ready',
                text: 'Hello! What would you like to work on today?'
            });
        }
    }

    private getWebviewContent(): string {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'chat.html');
        try {
            return fs.readFileSync(htmlPath, 'utf8');
        } catch (error) {
            return this.getDefaultHtml();
        }
    }

    private getDefaultHtml(): string {
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

    private httpsPost(url: string, data: string): Promise<string> {
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
    
    
    
 private async handleMessage(text: string, files?: any[]): Promise<void> {
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
            const actionResults: string[] = [];
            const jsonObjects = this.extractJsonObjects(assistantReply);

            if (jsonObjects.length > 0) {
                for (const actionData of jsonObjects) {
                    try {
                        const result = await this.executeAction(actionData);
                        if (result) actionResults.push(result);
                    } catch (err) {
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
            } else {
                // No actions, just the reply
                this.view?.webview.postMessage({ type: 'response', text: assistantReply });
            }

        } catch (error) {
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

    private async executeAction(actionData: any): Promise<string> {
        const action = (actionData.action || actionData.intent || '').toString().toLowerCase().replace(/\s+/g, '_');

        // CREATE FOLDER
        if (action.includes('create_folder') || action === 'createfolder') {
            const folder = actionData.folder || actionData.name;
            if (!folder) return '[ERROR] Missing folder name';
            return await this.createFolder(folder);
        }

        // CREATE PROJECT (multiple files)
        if (action.includes('create_project') || action === 'createproject') {
            const folder = actionData.folder || actionData.name || actionData.project;
            const files = actionData.files || [];
            if (!folder || !files.length) return '[ERROR] Missing folder name or files list';
            return await this.createProject(folder, files);
        }

        // CREATE FILE
        if (action.includes('create_file') || action === 'createfile') {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const content = actionData.content || '';
            if (!filePath) return '[ERROR] Missing file path';
            return await this.createFile(filePath, content);
        }

        // UPDATE FILE
        if (action.includes('update_file') || action === 'updatefile') {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const content = actionData.content || '';
            if (!filePath) return '[ERROR] Missing file path';
            return await this.updateFile(filePath, content);
        }

        // DEBUG FILE (auto-fix) – same as update_file for now
        if (action.includes('debug_file') || action === 'debugfile') {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const content = actionData.content || '';
            if (!filePath) return '[ERROR] Missing file path';
            return await this.updateFile(filePath, content);
        }

        // RUN FILE
        if (action.includes('run_file') || action === 'runfile' || action.includes('test_file')) {
            const filePath = actionData.path || actionData.filename || actionData.file;
            const environment = actionData.environment || 'none';
            if (!filePath) return '[ERROR] Missing file path';
            return await this.runFile(filePath, environment);
        }

        // SEARCH FILES
        if (action.includes('search_files') || action === 'searchfiles') {
            const keyword = actionData.keyword || actionData.search || actionData.query;
            const fileType = actionData.file_type || actionData.extension;
            const maxResults = actionData.max_results || 10;
            if (!keyword) return '[ERROR] Missing search keyword';
            const results = await this.searchFiles(keyword, fileType, maxResults);
            return this.formatSearchResults(results, 'files');
        }

        // SEARCH FOLDERS
        if (action.includes('search_folders') || action === 'searchfolders') {
            const keyword = actionData.keyword || actionData.search || actionData.query;
            const maxResults = actionData.max_results || 10;
            if (!keyword) return '[ERROR] Missing search keyword';
            const results = await this.searchFolders(keyword, maxResults);
            return this.formatSearchResults(results, 'folders');
        }

        // SEARCH IN FILES (content)
        if (action.includes('search_in_files') || action === 'searchinfiles' || action === 'grep') {
            const keyword = actionData.keyword || actionData.search || actionData.query;
            const filePattern = actionData.file_pattern || actionData.pattern || '*';
            const maxResults = actionData.max_results || 10;
            if (!keyword) return '[ERROR] Missing search keyword';
            const results = await this.searchInFiles(keyword, filePattern, maxResults);
            return this.formatSearchResults(results, 'content matches');
        }

        // GET FILE INFO
        if (action.includes('get_file_info') || action === 'getfileinfo' || action === 'file_info') {
            const filePath = actionData.path || actionData.file || actionData.filename;
            if (!filePath) return '[ERROR] Missing file path';
            const info = await this.getFileInfo(filePath);
            return this.formatFileInfo(info);
        }

        return `[INFO] Unknown action: ${action}`;
    }

    // ------------------------------------------------------------------------
    // File system action implementations (ported from original Python)
    // ------------------------------------------------------------------------

    private async createFolder(folder: string): Promise<string> {
        return await this.executeFileOperation('create_folder', {
            folder: folder
        });
    }

    private async createProject(folder: string, files: Array<{ path: string; content: string }>): Promise<string> {
        return await this.executeFileOperation('create_project', {
            folder: folder,
            files: files
        });
    }

    private async createFile(filePath: string, content: string): Promise<string> {
        return await this.executeFileOperation('create_file', {
            path: filePath,
            content: content
        });
    }

    private async updateFile(filePath: string, content: string): Promise<string> {
        return await this.executeFileOperation('update_file', {
            path: filePath,
            content: content
        });
    }

    private async runFile(filePath: string, environment: string): Promise<string> {
        return await this.executeFileOperation('run_file', {
            path: filePath,
            environment: environment
        });
    }

    // ------------------------------------------------------------------------
    // Search methods (simplified versions)
    // ------------------------------------------------------------------------

    private async searchFiles(keyword: string, fileType?: string, maxResults: number = 10): Promise<any[]> {
        const result = await this.executeFileOperation('search_files', {
            keyword: keyword,
            file_type: fileType,
            max_results: maxResults
        });
        
        // Parse the result string to extract file information
        try {
            // Try to extract JSON from the result
            const lines = result.split('\n');
            const files: any[] = [];
            let currentFile: any = null;
            
            for (const line of lines) {
                if (line.match(/^\d+\./)) {
                    // New file entry
                    if (currentFile) {
                        files.push(currentFile);
                    }
                    const name = line.replace(/^\d+\.\s*/, '').trim();
                    currentFile = { name: name, path: '', size: 0, modified: '' };
                } else if (line.includes('Path:') && currentFile) {
                    currentFile.path = line.replace(/.*Path:\s*/, '').trim();
                } else if (line.includes('Size:') && currentFile) {
                    const sizeMatch = line.match(/Size:\s*(\d+)/);
                    if (sizeMatch) {
                        currentFile.size = parseInt(sizeMatch[1]);
                    }
                } else if (line.includes('Modified:') && currentFile) {
                    currentFile.modified = line.replace(/.*Modified:\s*/, '').trim();
                }
            }
            
            if (currentFile) {
                files.push(currentFile);
            }
            
            return files.length > 0 ? files : [{ error: 'No files found' }];
        } catch (e) {
            return [{ error: 'Failed to parse search results' }];
        }
    }

    private async searchFolders(keyword: string, maxResults: number = 10): Promise<any[]> {
        const result = await this.executeFileOperation('search_folders', {
            keyword: keyword,
            max_results: maxResults
        });
        
        // Parse the result string to extract folder information
        try {
            const lines = result.split('\n');
            const folders: any[] = [];
            let currentFolder: any = null;
            
            for (const line of lines) {
                if (line.match(/^\d+\./)) {
                    // New folder entry
                    if (currentFolder) {
                        folders.push(currentFolder);
                    }
                    const name = line.replace(/^\d+\.\s*/, '').replace(/\/$/, '').trim();
                    currentFolder = { name: name, path: '', file_count: 0 };
                } else if (line.includes('Path:') && currentFolder) {
                    currentFolder.path = line.replace(/.*Path:\s*/, '').replace(/\/$/, '').trim();
                } else if (line.includes('Files:') && currentFolder) {
                    const countMatch = line.match(/Files:\s*(\d+)/);
                    if (countMatch) {
                        currentFolder.file_count = parseInt(countMatch[1]);
                    }
                }
            }
            
            if (currentFolder) {
                folders.push(currentFolder);
            }
            
            return folders.length > 0 ? folders : [{ error: 'No folders found' }];
        } catch (e) {
            return [{ error: 'Failed to parse search results' }];
        }
    }

    private async searchInFiles(keyword: string, filePattern: string = '*', maxResults: number = 10): Promise<any[]> {
        const result = await this.executeFileOperation('search_in_files', {
            keyword: keyword,
            file_pattern: filePattern,
            max_results: maxResults
        });
        
        // Parse the result string to extract content matches
        try {
            const lines = result.split('\n');
            const matches: any[] = [];
            let currentMatch: any = null;
            
            for (const line of lines) {
                if (line.match(/^\d+\./)) {
                    // New match entry
                    if (currentMatch) {
                        matches.push(currentMatch);
                    }
                    const name = line.replace(/^\d+\.\s*/, '').trim();
                    currentMatch = { name: name, path: '', matches: 0, lines: [] };
                } else if (line.includes('Path:') && currentMatch) {
                    currentMatch.path = line.replace(/.*Path:\s*/, '').trim();
                } else if (line.includes('Matches:') && currentMatch) {
                    const countMatch = line.match(/Matches:\s*(\d+)/);
                    if (countMatch) {
                        currentMatch.matches = parseInt(countMatch[1]);
                    }
                } else if (line.includes('Line') && currentMatch) {
                    const lineMatch = line.match(/Line\s+(\d+):\s*(.+)/);
                    if (lineMatch) {
                        currentMatch.lines.push({
                            line: parseInt(lineMatch[1]),
                            content: lineMatch[2]
                        });
                    }
                }
            }
            
            if (currentMatch) {
                matches.push(currentMatch);
            }
            
            return matches.length > 0 ? matches : [{ error: 'No matches found' }];
        } catch (e) {
            return [{ error: 'Failed to parse search results' }];
        }
    }

    private async getFileInfo(filePath: string): Promise<any> {
        const result = await this.executeFileOperation('get_file_info', {
            path: filePath
        });
        
        // Parse the result string to extract file information
        try {
            const lines = result.split('\n');
            const info: any = {};
            
            for (const line of lines) {
                if (line.includes(':')) {
                    const [key, value] = line.split(':').map(s => s.trim());
                    if (key && value) {
                        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
                        info[normalizedKey] = value;
                    }
                }
            }
            
            return info.name ? info : { error: 'Failed to parse file info' };
        } catch (e) {
            return { error: 'Failed to parse file info' };
        }
    }

    private formatSearchResults(results: any[], type: string): string {
        if (results.length === 0) return `[INFO] No ${type} found.`;
        if (results[0].error) return `[ERROR] ${results[0].error}`;
        const lines = [`[OK] Found ${results.length} ${type}:`];
        results.forEach((r, i) => {
            lines.push(`${i + 1}. ${r.name} (${r.path})`);
            if (type === 'files') lines.push(`   Size: ${r.size} bytes, Modified: ${r.modified}`);
            if (type === 'folders') lines.push(`   Files: ${r.file_count}`);
            if (type === 'content matches') {
                lines.push(`   Matches: ${r.matches}`);
                r.lines.forEach((l: any) => lines.push(`      Line ${l.line}: ${l.content}`));
            }
        });
        return lines.join('\n');
    }

    private formatFileInfo(info: any): string {
        if (info.error) return `[ERROR] ${info.error}`;
        return `[OK] File Info:\nName: ${info.name}\nPath: ${info.path}\nSize: ${info.size} bytes\nCreated: ${info.created}\nModified: ${info.modified}`;
    }

    // ------------------------------------------------------------------------
    // JSON extraction helpers
    // ------------------------------------------------------------------------

    private extractJsonObjects(text: string): any[] {
        const objects: any[] = [];
        const regex = /\{[\s\S]*?\}/g; // simple greedy match (may fail for nested)
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const obj = JSON.parse(match[0]);
                objects.push(obj);
            } catch { /* ignore invalid JSON */ }
        }
        return objects;
    }

    private removeJsonFromText(text: string): string {
        // Remove all JSON-like blocks (crude)
        return text.replace(/\{[\s\S]*?\}/g, '').trim();
    }

    // ------------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------------

    public dispose(): void {
        // Clean up Python backend process
        if (this.pythonProcess) {
            this.sendToPython({ type: 'exit' });
            setTimeout(() => {
                if (this.pythonProcess && !this.pythonProcess.killed) {
                    this.pythonProcess.kill();
                }
            }, 1000);
        }
    }
}
