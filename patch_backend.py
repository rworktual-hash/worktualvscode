import re

# Read the file
with open('out/backend.js', 'r') as f:
    content = f.read()

# Add workspace path initialization after constructor
old_constructor = """    constructor(context) {
        this.outputBuffer = '';
        this.isReady = false;
        this.context = context;
    }"""

new_constructor = """    constructor(context) {
        this.outputBuffer = '';
        this.isReady = false;
        this.context = context;
        // Get workspace path - prefer first workspace folder
        this.workspacePath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            // Fallback to extension path
            this.workspacePath = context.extensionPath;
        }
        console.log('Workspace path:', this.workspacePath);
    }"""

content = content.replace(old_constructor, new_constructor)

# Add workspace config message after python process spawn
old_spawn = """        this.pythonProcess.on('spawn', () => {
            console.log('Python process spawned successfully');
        });"""

new_spawn = """        this.pythonProcess.on('spawn', () => {
            console.log('Python process spawned successfully');
            // Send workspace path configuration
            setTimeout(() => {
                if (this.pythonProcess && this.pythonProcess.stdin && !this.pythonProcess.killed) {
                    const configMsg = JSON.stringify({ type: 'config', workspacePath: this.workspacePath }) + '\\\\n';
                    console.log('Sending workspace config:', configMsg);
                    this.pythonProcess.stdin.write(configMsg);
                }
            }, 500);
        });"""

content = content.replace(old_spawn, new_spawn)

# Write back
with open('out/backend.js', 'w') as f:
    f.write(content)

print('Backend.js patched successfully')
