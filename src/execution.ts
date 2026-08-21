import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ExecutionResult {
  command: string;
  output: string;
  exitCode: number;
  duration: number;
}

export class ExperimentRunner {
  private stepsCount = 0;
  private testRunsCount = 0;
  private startTime = Date.now();
  private records: ExecutionResult[] = [];

  readonly MAX_STEPS = 8;
  readonly MAX_TEST_RUNS = 3;
  readonly MAX_RUNTIME_SECONDS = 60;

  constructor(private targetRepoPath: string) {}

  private isTimeExceeded(): boolean {
    return (Date.now() - this.startTime) / 1000 >= this.MAX_RUNTIME_SECONDS;
  }

  async runOperation(command: string): Promise<ExecutionResult> {
    if (this.stepsCount >= this.MAX_STEPS) {
      throw new Error(`Max steps (${this.MAX_STEPS}) exceeded.`);
    }
    if (this.isTimeExceeded()) {
      throw new Error(`Max runtime (${this.MAX_RUNTIME_SECONDS}s) exceeded.`);
    }

    const start = Date.now();
    let safeCommand = '';
    
    // Whitelist and sanitize commands
    if (command.startsWith('read file ')) {
      const file = command.replace('read file ', '').trim();
      safeCommand = `cat "${file}"`;
    } else if (command.startsWith('search files ')) {
      const query = command.replace('search files ', '').trim();
      safeCommand = `grep -rn "${query}" .`;
    } else if (command === 'inspect git diff') {
      safeCommand = 'git diff';
    } else if (command === 'inspect git log') {
      safeCommand = 'git log -n 5';
    } else if (command === 'run pytest') {
      if (this.testRunsCount >= this.MAX_TEST_RUNS) {
        throw new Error(`Max test runs (${this.MAX_TEST_RUNS}) exceeded.`);
      }
      this.testRunsCount++;
      safeCommand = 'pytest';
    } else {
      throw new Error(`Unsupported operation: ${command}`);
    }

    let output = '';
    let exitCode = 0;

    try {
      if (command.startsWith('read file ')) {
        const file = path.join(this.targetRepoPath, command.replace('read file ', '').trim());
        output = fs.readFileSync(file, 'utf-8');
      } else if (command.startsWith('search files ')) {
        // very basic search for mock/simplicity, avoiding grep vs windows findstr
        const query = command.replace('search files ', '').trim();
        // Just mock it or use a simple recursive search - we'll just shell out to `git grep` which works everywhere if git is installed
        safeCommand = `git grep -n "${query}"`;
        const { stdout, stderr } = await execAsync(safeCommand, { cwd: this.targetRepoPath, timeout: 10000 });
        output = stdout + stderr;
      } else {
        const { stdout, stderr } = await execAsync(safeCommand, { cwd: this.targetRepoPath, timeout: 10000 });
        output = stdout + stderr;
      }
    } catch (e: any) {
      exitCode = e.code || 1;
      output = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    }

    const duration = Date.now() - start;
    this.stepsCount++;

    const result: ExecutionResult = {
      command,
      output: output.substring(0, 5000), // Limit output size
      exitCode,
      duration
    };

    this.records.push(result);
    return result;
  }

  getRecords() {
    return this.records;
  }
}
