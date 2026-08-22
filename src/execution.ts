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

  public getTargetRepoPath(): string {
    return this.targetRepoPath;
  }

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
    } else if (command === 'list files') {
      safeCommand = 'list_files_internal';
    } else if (command.startsWith('search files ')) {
      safeCommand = 'search_files_internal';
    } else if (command === 'inspect git diff') {
      safeCommand = 'git diff';
    } else if (command === 'inspect git log') {
      safeCommand = 'git log -n 5';
    } else if (command === 'run pytest') {
      if (this.testRunsCount >= this.MAX_TEST_RUNS) {
        throw new Error(`Max test runs (${this.MAX_TEST_RUNS}) exceeded.`);
      }
      this.testRunsCount++;
      safeCommand = 'pytest -v';
    } else {
      throw new Error(`Unsupported operation: ${command}`);
    }

    let output = '';
    let exitCode = 0;

    try {
      if (command.startsWith('read file ')) {
        const file = path.join(this.targetRepoPath, command.replace('read file ', '').trim());
        output = fs.readFileSync(file, 'utf-8');
      } else if (command === 'list files') {
        // Pure JS recursive file listing — works without git
        const listRecursive = (dir: string, base: string): string[] => {
          const results: string[] = [];
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            const rel = path.join(base, entry);
            if (fs.statSync(full).isDirectory()) {
              results.push(...listRecursive(full, rel));
            } else {
              results.push(rel);
            }
          }
          return results;
        };
        const absPath = path.resolve(this.targetRepoPath);
        const files = listRecursive(absPath, '');
        output = files.join('\n') || '(no files found)';
      } else if (command.startsWith('search files ')) {
        // Pure JS recursive text search — works without git
        const query = command.replace('search files ', '').trim();
        const searchRecursive = (dir: string, base: string): string[] => {
          const matches: string[] = [];
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            const rel = path.join(base, entry);
            if (fs.statSync(full).isDirectory()) {
              matches.push(...searchRecursive(full, rel));
            } else if (full.endsWith('.py') || full.endsWith('.ts') || full.endsWith('.js') || full.endsWith('.txt')) {
              const lines = fs.readFileSync(full, 'utf-8').split('\n');
              lines.forEach((line, i) => {
                if (line.includes(query)) {
                  matches.push(`${rel}:${i + 1}: ${line.trim()}`);
                }
              });
            }
          }
          return matches;
        };
        const absPath = path.resolve(this.targetRepoPath);
        const matches = searchRecursive(absPath, '');
        output = matches.join('\n') || `(no matches found for "${query}")`;
      } else {
        const { stdout, stderr } = await execAsync(safeCommand, { cwd: this.targetRepoPath, timeout: 15000 });
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
