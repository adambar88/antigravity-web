/**
 * Utilities for computing and formatting line-level file diffs
 */

import { diffLines, Change } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'normal';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface SplitDiffRow {
  left?: {
    lineNumber: number;
    content: string;
    type: 'removed' | 'normal' | 'empty';
  };
  right?: {
    lineNumber: number;
    content: string;
    type: 'added' | 'normal' | 'empty';
  };
}

export interface ComputedDiff {
  unifiedLines: DiffLine[];
  splitRows: SplitDiffRow[];
  additions: number;
  deletions: number;
}

export function computeFileDiff(before: string = '', after: string = ''): ComputedDiff {
  const safeBefore = before ?? '';
  const safeAfter = after ?? '';

  const changes: Change[] = diffLines(safeBefore, safeAfter);

  const unifiedLines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    // split into individual lines
    const lines = change.value.split('\n');
    // if trailing empty line due to newline, preserve structure
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (change.added) {
      additions += lines.length;
      for (const line of lines) {
        unifiedLines.push({
          type: 'added',
          newLineNumber: newLine++,
          content: line,
        });
      }
    } else if (change.removed) {
      deletions += lines.length;
      for (const line of lines) {
        unifiedLines.push({
          type: 'removed',
          oldLineNumber: oldLine++,
          content: line,
        });
      }
    } else {
      for (const line of lines) {
        unifiedLines.push({
          type: 'normal',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          content: line,
        });
      }
    }
  }

  // Generate split (side-by-side) rows
  const splitRows: SplitDiffRow[] = [];
  let i = 0;

  while (i < unifiedLines.length) {
    const line = unifiedLines[i];

    if (line.type === 'normal') {
      splitRows.push({
        left: {
          lineNumber: line.oldLineNumber!,
          content: line.content,
          type: 'normal',
        },
        right: {
          lineNumber: line.newLineNumber!,
          content: line.content,
          type: 'normal',
        },
      });
      i++;
    } else if (line.type === 'removed') {
      // Check if immediately followed by an added line to align them
      let nextLine = unifiedLines[i + 1];
      if (nextLine && nextLine.type === 'added') {
        splitRows.push({
          left: {
            lineNumber: line.oldLineNumber!,
            content: line.content,
            type: 'removed',
          },
          right: {
            lineNumber: nextLine.newLineNumber!,
            content: nextLine.content,
            type: 'added',
          },
        });
        i += 2;
      } else {
        splitRows.push({
          left: {
            lineNumber: line.oldLineNumber!,
            content: line.content,
            type: 'removed',
          },
          right: undefined,
        });
        i++;
      }
    } else {
      // added
      splitRows.push({
        left: undefined,
        right: {
          lineNumber: line.newLineNumber!,
          content: line.content,
          type: 'added',
        },
      });
      i++;
    }
  }

  return {
    unifiedLines,
    splitRows,
    additions,
    deletions,
  };
}
