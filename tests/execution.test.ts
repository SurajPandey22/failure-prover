import { ExperimentRunner } from '../src/execution';
import * as fs from 'fs';
import * as path from 'path';

describe('ExperimentRunner', () => {
  const dummyRepo = path.join(__dirname, 'dummy_repo');

  beforeAll(() => {
    if (!fs.existsSync(dummyRepo)) {
      fs.mkdirSync(dummyRepo);
    }
    fs.writeFileSync(path.join(dummyRepo, 'test.txt'), 'hello world');
  });

  afterAll(() => {
    fs.unlinkSync(path.join(dummyRepo, 'test.txt'));
    fs.rmdirSync(dummyRepo);
  });

  it('should run a successful command (read file)', async () => {
    const runner = new ExperimentRunner(dummyRepo);
    const result = await runner.runOperation('read file test.txt');
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('hello world');
  });

  it('should handle failed command (nonexistent file)', async () => {
    const runner = new ExperimentRunner(dummyRepo);
    const result = await runner.runOperation('read file missing.txt');
    expect(result.exitCode).not.toBe(0);
  });

  it('should handle malformed request', async () => {
    const runner = new ExperimentRunner(dummyRepo);
    await expect(runner.runOperation('rm -rf /')).rejects.toThrow('Unsupported operation');
  });

  it('should enforce step limit', async () => {
    const runner = new ExperimentRunner(dummyRepo);
    for (let i = 0; i < 8; i++) {
      await runner.runOperation('read file test.txt');
    }
    await expect(runner.runOperation('read file test.txt')).rejects.toThrow('Max steps (8) exceeded.');
  });

  it('should enforce test-run limit', async () => {
    const runner = new ExperimentRunner(dummyRepo);
    for (let i = 0; i < 3; i++) {
      await runner.runOperation('run pytest');
    }
    await expect(runner.runOperation('run pytest')).rejects.toThrow('Max test runs (3) exceeded.');
  });

  it('should timeout if execution takes too long (mocking time)', async () => {
    const runner = new ExperimentRunner(dummyRepo);
    // Mock the isTimeExceeded method for this test since we can't easily wait 60s
    jest.spyOn(runner as any, 'isTimeExceeded').mockReturnValue(true);
    await expect(runner.runOperation('read file test.txt')).rejects.toThrow('Max runtime (60s) exceeded.');
  });
});
