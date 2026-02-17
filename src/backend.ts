import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';

export class Backend implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;
    private view?: vscode.WebviewView;
    private pythonProcess?: child_process.ChildProcess;
    private outputBuffer: string = '';
    private isReady: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get the workspace root path from the currently open workspace.
     * Returns undefined if no workspace is open.
     */
    private getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        
        // Get the first workspace folder's path
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Check if workspace is open and show error if not.
     * Returns the workspace root path if valid.
     */
    private validateWorkspace(): string | undefined {
        const workspaceRoot = this.getWorkspaceRoot();
        
        if (!workspaceRoot) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'Please open a folder before generating files.'
                });
            }
            return undefined;
        }
        
        return workspaceRoot;
    }

    /**
     * Create a file in the workspace with the given content.
     * Automatically creates parent directories if they don't exist.
     * Opens the file in the editor after creation.
     */
    private async createFileInWorkspace(relativePath: string, content: string): Promise<boolean> {
        const workspaceRoot = this.validateWorkspace();
        
        if (!workspaceRoot) {
            return false;
        }

        try {
            // Use path.join() to create the full file path
            const fullPath = path.join(workspaceRoot, relativePath);
            const fullDirPath = path.dirname(fullPath);

            // Use fs.mkdirSync() with recursive option to create directories
            if (!fs.existsSync(fullDirPath)) {
                fs.mkdirSync(fullDirPath, { recursive: true });
                console.log('Created directory:', fullDirPath);
            }

            // Use fs.writeFileSync() to write content with UTF-8 encoding
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log('Created file:', fullPath);

            // Automatically open the created file in the editor
            const document = await vscode.window.showTextDocument(
                vscode.Uri.file(fullPath),
                {
                    viewColumn: vscode.ViewColumn.One,
                    preserveFocus: false
                }
            );

            if (this.view) {
                this.view.webview.postMessage({
                    type: 'status',
                    text: `Created: ${relativePath}`
                });
            }

            return true;
        } catch (error) {
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

    /**
     * Create multiple files in the workspace.
     */
    private async createFilesInWorkspace(files: Array<{ path: string; content: string }>): Promise<boolean> {
        const workspaceRoot = this.validateWorkspace();
        
        if (!workspaceRoot) {
            return false;
        }

        let allSuccess = true;

        for (const file of files) {
            const success = await this.createFileInWorkspace(file.path, file.content);
            if (!success) {
                allSuccess = false;
            }
        }

        return allSuccess;
    }

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
                    case 'searchFiles':
                        this.handleSearchFiles(message.keyword, message.fileType);
                        return;
                    case 'searchFolders':
                        this.handleSearchFolders(message.keyword);
                        return;
                    case 'searchInFiles':
                        this.handleSearchInFiles(message.keyword, message.filePattern);
                        return;
                    case 'getFileInfo':
                        this.handleGetFileInfo(message.path);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Start the Python backend
        this.startPythonBackend();
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

    private startPythonBackend(): void {
        const pythonScript = path.join(this.context.extensionPath, 'python', 'backend.py');
        console.log('Starting Python backend:', pythonScript);
        console.log('Extension path:', this.context.extensionPath);

        // Check if Python script exists
        if (!fs.existsSync(pythonScript)) {
            console.error('Python backend script not found:', pythonScript);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: `Backend script not found: ${pythonScript}`
                });
            }
            return;
        }

        // Check if Python is available - use system Python by default
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
        const useConda = false; // Disabled - use system Python
        const condaEnvPath = '/home/vectone/miniconda3/envs/audio_env'; // Not used

        let spawnCommand: string;
        let spawnArgs: string[];

        if (useConda) {
            // Use the Python executable directly from the conda environment
            spawnCommand = path.join(condaEnvPath, 'bin', pythonCommand);
            spawnArgs = [pythonScript];
            console.log('Using conda environment Python:', spawnCommand);
        } else {
            // Use system Python
            spawnCommand = pythonCommand;
            spawnArgs = [pythonScript];
            console.log('Using system Python:', spawnCommand);
        }

        try {
            this.pythonProcess = child_process.spawn(spawnCommand, spawnArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (error) {
            console.error('Failed to spawn Python process:', error);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: `Failed to start Python: ${error}`
                });
            }
            return;
        }

        // Show initial loading message
        if (this.view) {
            this.view.webview.postMessage({ type: 'status', text: 'Starting AI Assistant...' });
        }

        this.pythonProcess.stdout?.on('data', (data: Buffer) => {
            const text = data.toString();
            console.log('Python stdout:', text);
            this.outputBuffer += text;

            // Process complete JSON lines
            const lines = this.outputBuffer.split('\n');
            this.outputBuffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line.trim());
                        console.log('Parsed message:', message);
                        this.handlePythonMessage(message);
                    } catch (e) {
                        console.error('Failed to parse Python message:', line, e);
                    }
                }
            }
        });

        this.pythonProcess.stderr?.on('data', (data: Buffer) => {
            const errorText = data.toString();
            console.error(`Python backend error: ${errorText}`);
            if (this.view) {
                this.view.webview.postMessage({ type: 'error', text: `Backend: ${errorText}` });
            }
        });

        this.pythonProcess.on('close', (code: number | null) => {
            console.log(`Python backend exited with code ${code}`);
            this.isReady = false;
            if (this.view) {
                this.view.webview.postMessage({ type: 'error', text: 'AI Assistant disconnected' });
            }
        });

        this.pythonProcess.on('error', (error: Error) => {
            console.error('Failed to start Python backend:', error);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: `Failed to start AI Assistant: ${error.message}. Make sure Python is installed.`
                });
            }
        });

        // Handle spawn errors specifically
        this.pythonProcess.on('spawn', () => {
            console.log('Python process spawned successfully');
        });

        // Timeout: if not ready after 10 seconds, show error
        setTimeout(() => {
            if (!this.isReady && this.view) {
                console.error('Python backend failed to become ready within 10 seconds');
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant failed to start. Check that Python is installed and the Gemini API is configured.'
                });
            }
        }, 10000);
    }

    private handlePythonMessage(message: any): void {
        if (!this.view) {
            console.log('No view available to handle message');
            return;
        }

        console.log('Handling message:', message);

        // Handle file creation requests from Python backend
        if (message.type === 'create_file') {
            console.log('Creating file:', message.file_path);
            this.createFileInWorkspace(message.file_path, message.content);
            return;
        }

        // Handle multiple file creation requests
        if (message.type === 'create_files') {
            console.log('Creating multiple files:', message.files?.length || 0);
            this.createFilesInWorkspace(message.files || []);
            return;
        }

        switch (message.type) {
            case 'ready':
                console.log('Python backend is ready');
                this.isReady = true;
                this.view.webview.postMessage(message);
                break;
            case 'response':
                console.log('Received response:', message.text?.substring(0, 100));
                this.view.webview.postMessage(message);
                break;
            case 'error':
                console.log('Received error:', message.text);
                this.view.webview.postMessage(message);
                break;
            case 'status':
                this.view.webview.postMessage(message);
                break;
            case 'website_complete':
                console.log('Website generation complete:', message.preview_url);
                this.view.webview.postMessage(message);
                break;
            case 'confirmation':
                this.view.webview.postMessage(message);
                break;
            case 'search_results':
                console.log('Received search results:', message.search_results);
                this.view.webview.postMessage(message);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    private handleSearchFiles(keyword: string, fileType?: string): void {
        if (!this.isReady || !this.pythonProcess || this.pythonProcess.killed) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant is not ready. Please wait...'
                });
            }
            return;
        }

        const message = JSON.stringify({
            type: 'message',
            text: `search files with keyword "${keyword}"${fileType ? ` and type ${fileType}` : ''}`
        }) + '\n';

        try {
            this.pythonProcess.stdin?.write(message);
        } catch (error) {
            console.error('Failed to send search request:', error);
        }
    }

    private handleSearchFolders(keyword: string): void {
        if (!this.isReady || !this.pythonProcess || this.pythonProcess.killed) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant is not ready. Please wait...'
                });
            }
            return;
        }

        const message = JSON.stringify({
            type: 'message',
            text: `search folders with keyword "${keyword}"`
        }) + '\\n';

        try {
            this.pythonProcess.stdin?.write(message);
        } catch (error) {
            console.error('Failed to send search request:', error);
        }
    }

    private handleSearchInFiles(keyword: string, filePattern?: string): void {
        if (!this.isReady || !this.pythonProcess || this.pythonProcess.killed) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant is not ready. Please wait...'
                });
            }
            return;
        }

        const message = JSON.stringify({
            type: 'message',
            text: `search in files for "${keyword}"${filePattern ? ` in ${filePattern} files` : ''}`
        }) + '\\n';

        try {
            this.pythonProcess.stdin?.write(message);
        } catch (error) {
            console.error('Failed to send search request:', error);
        }
    }

    private handleGetFileInfo(filePath: string): void {
        if (!this.isReady || !this.pythonProcess || this.pythonProcess.killed) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant is not ready. Please wait...'
                });
            }
            return;
        }

        const message = JSON.stringify({
            type: 'message',
            text: `get file info for ${filePath}`
        }) + '\\n';

        try {
            this.pythonProcess.stdin?.write(message);
        } catch (error) {
            console.error('Failed to send file info request:', error);
        }
    }

    private handleMessage(text: string, files?: any[]): void {
        console.log('Handling message, isReady:', this.isReady);
        console.log('Python process exists:', !!this.pythonProcess);
        console.log('Python process killed:', this.pythonProcess?.killed);
        console.log('Files attached:', files?.length || 0);

        // Show thinking indicator in frontend
        if (this.view) {
            this.view.webview.postMessage({ type: 'thinking' });
        }

        if (!this.isReady) {
            console.log('Backend not ready, cannot send message');
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant is not ready yet. Please wait or check the console for errors.'
                });
            }
            return;
        }

        if (this.pythonProcess && this.pythonProcess.stdin && !this.pythonProcess.killed) {
            const messageObj: any = { type: 'message', text: text };

            // Include files if any
            if (files && files.length > 0) {
                messageObj.files = files;
                console.log('Files to send:', files.map((f: any) => ({ name: f.name, type: f.type })));
            }

            const message = JSON.stringify(messageObj) + '\n';
            console.log('Sending to Python:', message.substring(0, 200) + '...');

            try {
                this.pythonProcess.stdin.write(message);
                console.log('Message sent successfully');
            } catch (error) {
                console.error('Failed to write to Python stdin:', error);
                if (this.view) {
                    this.view.webview.postMessage({
                        type: 'error',
                        text: `Failed to send message: ${error}`
                    });
                }
            }
        } else {
            console.error('Python process or stdin not available');
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'AI Assistant not available. The backend may have crashed.'
                });
            }
        }
    }

    public dispose(): void {
        if (this.pythonProcess) {
            this.pythonProcess.stdin?.end();
            this.pythonProcess.kill();
        }
    }
}
