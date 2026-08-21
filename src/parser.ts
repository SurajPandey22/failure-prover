import { FailureContext } from './domain';

export class Parser {
  static parse(rawLog: string): FailureContext {
    const context: FailureContext = {
      rawLog,
      sourceLocations: [],
      relevantLogLines: []
    };

    if (!rawLog || typeof rawLog !== 'string') {
      return context;
    }

    const lines = rawLog.split('\n');

    // 1. Extract test name
    const testNameMatch = rawLog.match(/_{3,} (test_[a-zA-Z0-9_]+) _{3,}/);
    if (testNameMatch) {
      context.testName = testNameMatch[1];
    } else {
      const failedMatch = rawLog.match(/FAILED\s+[^:]+::(test_[a-zA-Z0-9_]+)/);
      if (failedMatch) {
        context.testName = failedMatch[1];
      }
    }

    // 2. Extract Exception type and message
    // Usually pytest prefixes lines with "E   "
    for (const line of lines) {
      const errorMatch = line.match(/^E\s+([A-Za-z0-9_]+(?:Error|Exception)):\s*(.*)/);
      if (errorMatch) {
        if (!context.errorType) {
          context.errorType = errorMatch[1];
          context.errorMessage = errorMatch[2].trim();
        }
        context.relevantLogLines.push(line);
      } else if (line.match(/^E\s+/)) {
        context.relevantLogLines.push(line);
      } else if (line.match(/^>\s+/)) {
        context.relevantLogLines.push(line);
      }
    }

    // Fallback if not found with 'E   '
    if (!context.errorType) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const errorMatch = line.match(/^([A-Za-z0-9_]+(?:Error|Exception)):\s*(.*)/);
        if (errorMatch && !line.startsWith('E ')) {
          context.errorType = errorMatch[1];
          context.errorMessage = errorMatch[2].trim();
          break;
        }
      }
    }

    // 3. Extract source locations
    const sourceLocations = new Set<string>();
    for (const line of lines) {
      const locationMatch = line.match(/([a-zA-Z0-9_\-\./\\]+\.py):(\d+):/);
      if (locationMatch) {
        sourceLocations.add(`${locationMatch[1]}:${locationMatch[2]}`);
      } else {
        const tbMatch = line.match(/File "([^"]+)", line (\d+)/);
        if (tbMatch) {
          sourceLocations.add(`${tbMatch[1]}:${tbMatch[2]}`);
        }
      }
    }
    context.sourceLocations = Array.from(sourceLocations);

    // 4. Extract stack trace block (rudimentary)
    const traceStartIndex = lines.findIndex(l => 
      l.includes('Traceback (most recent call last):') || 
      l.match(/_{3,} test_/) ||
      l.startsWith('FAILED ')
    );
    
    if (traceStartIndex !== -1) {
      const traceLines = [];
      for (let i = traceStartIndex; i < lines.length; i++) {
        const l = lines[i];
        if (l.startsWith('===') || l.match(/^-{2,} short test summary info/)) {
          break;
        }
        traceLines.push(l);
      }
      if (traceLines.length > 0) {
        context.stackTrace = traceLines.join('\n');
      }
    }

    return context;
  }
}
