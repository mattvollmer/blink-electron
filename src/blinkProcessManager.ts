import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import path from 'node:path';

interface BlinkProcess {
  process: ChildProcess;
  port: number;
  projectPath: string;
}

class BlinkProcessManager {
  private processes: Map<string, BlinkProcess> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private async killProcessOnPort(port: number): Promise<void> {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      if (process.platform === 'win32') {
        // Windows
        const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
        const lines = stdout.split('\n').filter((line: string) => line.includes('LISTENING'));
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            await execPromise(`taskkill /F /PID ${pid}`);
            console.log(`Killed process ${pid} on port ${port}`);
          }
        }
      } else {
        // macOS/Linux
        try {
          const { stdout } = await execPromise(`lsof -ti:${port}`);
          const pids = stdout.trim().split('\n').filter((pid: string) => pid);
          
          for (const pid of pids) {
            await execPromise(`kill -9 ${pid}`);
            console.log(`Killed process ${pid} on port ${port}`);
          }
        } catch (error) {
          // No process found on port, that's fine
        }
      }
    } catch (error) {
      console.log(`No process to kill on port ${port}`);
    }
  }

  async startProject(projectId: string, projectPath: string, port: number): Promise<void> {
    if (this.processes.has(projectId)) {
      throw new Error(`Project ${projectId} is already running`);
    }

    // Kill any existing process on this port
    await this.killProcessOnPort(port);

    return new Promise((resolve, reject) => {
      // First, build the project
      const buildProcess = spawn('blink', ['build'], {
        cwd: projectPath,
        shell: true,
      });

      buildProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to build project'));
          return;
        }

        // Run the built agent with custom port via environment variable
        const blinkProcess = spawn('node', ['.blink/build/agent.js'], {
          cwd: projectPath,
          env: { ...process.env, PORT: port.toString() },
          shell: true,
        });

        let startupError = '';

        blinkProcess.stdout?.on('data', (data) => {
          console.log(`[${projectId}] stdout:`, data.toString());
          // Send logs to renderer
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('blink:log', {
              projectId,
              level: 'info',
              message: data.toString(),
            });
          }
        });

        blinkProcess.stderr?.on('data', (data) => {
          const message = data.toString();
          console.error(`[${projectId}] stderr:`, message);
          startupError += message;
          
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('blink:log', {
              projectId,
              level: 'error',
              message,
            });
          }
        });

        blinkProcess.on('error', (error) => {
          console.error(`[${projectId}] Failed to start:`, error);
          this.processes.delete(projectId);
          reject(error);
        });

        blinkProcess.on('exit', (code) => {
          console.log(`[${projectId}] Process exited with code ${code}`);
          this.processes.delete(projectId);
          
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('blink:process-exit', {
              projectId,
              code,
            });
          }
        });

        // Store the process
        this.processes.set(projectId, {
          process: blinkProcess,
          port,
          projectPath,
        });

        // Give it a moment to start up
        setTimeout(() => {
          if (this.processes.has(projectId)) {
            resolve();
          } else {
            reject(new Error(`Failed to start project: ${startupError}`));
          }
        }, 2000);
      });
    });
  }

  stopProject(projectId: string): void {
    const blinkProcess = this.processes.get(projectId);
    if (!blinkProcess) {
      return;
    }

    blinkProcess.process.kill('SIGTERM');
    this.processes.delete(projectId);
  }

  stopAll(): void {
    for (const [projectId] of this.processes) {
      this.stopProject(projectId);
    }
  }

  isRunning(projectId: string): boolean {
    return this.processes.has(projectId);
  }

  getPort(projectId: string): number | undefined {
    return this.processes.get(projectId)?.port;
  }
}

export const blinkProcessManager = new BlinkProcessManager();
