import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let nextServerProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;
const WEB_PORT = 3000;
const APP_URL = `http://localhost:${WEB_PORT}/dashboard`;

function startProductionNextServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        const webDir = path.join(process.resourcesPath, 'web-standalone');
        const serverScript = path.join(webDir, 'server.js');

        nextServerProcess = spawn(process.execPath, [serverScript], {
            cwd: webDir,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
                PORT: String(WEB_PORT),
                HOSTNAME: '127.0.0.1',
            },
        });

        nextServerProcess.stdout?.on('data', (data: Buffer) => {
            if (data.toString().includes('Ready')) {
                resolve();
            }
        });

        nextServerProcess.on('error', reject);
        setTimeout(resolve, 3500);
    });
}

async function createMainWindow() {
    if (!isDev) {
        await startProductionNextServer();
    }

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 720,
        title: 'CodeMentor AI Studio',
        backgroundColor: '#020617',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    // Ẩn thanh menu mặc định để giao diện IDE gọn như VS Code
    Menu.setApplicationMenu(null);

    // Mở các liên kết ngoài (VD: xác thực QR) bằng trình duyệt mặc định của hệ điều hành
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    await mainWindow.loadURL(APP_URL);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
    if (nextServerProcess) {
        nextServerProcess.kill();
        nextServerProcess = null;
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});