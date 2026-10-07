export interface DiffPart {
  type: "added" | "removed" | "unchanged";
  value: string;
}

/**
 * Computes a word-by-word diff between original and modified text
 * using the Longest Common Subsequence (LCS) algorithm.
 */
export function computeWordDiff(original: string, modified: string): DiffPart[] {
  if (!original) {
    return [{ type: "added", value: modified }];
  }
  if (!modified) {
    return [{ type: "removed", value: original }];
  }

  // Tokenize preserving spaces so reconstruction is perfect
  const origWords = original.split(/(\s+)/).filter(Boolean);
  const modWords = modified.split(/(\s+)/).filter(Boolean);

  const n = origWords.length;
  const m = modWords.length;
  const dp: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (origWords[i - 1] === modWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffPart[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === modWords[j - 1]) {
      result.unshift({ type: "unchanged", value: origWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", value: modWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", value: origWords[i - 1] });
      i--;
    }
  }

  // Merge adjacent diff parts of the same type for better rendering performance
  const merged: DiffPart[] = [];
  for (const part of result) {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) {
      last.value += part.value;
    } else {
      merged.push({ ...part });
    }
  }

  return merged;
}

export interface CorrectionChunk {
  id: string;
  before: string;
  after: string;
  contextBefore: string;
  contextAfter: string;
}

/**
 * Extracts distinct correction chunks (before/after edits with surrounding context)
 * from a list of DiffParts.
 */
export function extractCorrections(diffParts: DiffPart[]): CorrectionChunk[] {
  const chunks: CorrectionChunk[] = [];
  let i = 0;

  while (i < diffParts.length) {
    const part = diffParts[i];

    if (part.type === "unchanged") {
      i++;
      continue;
    }

    // Found a modification block (added or removed)
    let before = "";
    let after = "";

    // Context before: last 35 characters of the previous unchanged part
    let contextBefore = "";
    if (i > 0 && diffParts[i - 1].type === "unchanged") {
      const val = diffParts[i - 1].value;
      contextBefore = val.length > 35 ? "..." + val.slice(-35) : val;
    }

    // Accumulate all consecutive added/removed parts
    while (i < diffParts.length && diffParts[i].type !== "unchanged") {
      const current = diffParts[i];
      if (current.type === "removed") {
        before += current.value;
      } else if (current.type === "added") {
        after += current.value;
      }
      i++;
    }

    // Context after: first 35 characters of the next unchanged part
    let contextAfter = "";
    if (i < diffParts.length && diffParts[i].type === "unchanged") {
      const val = diffParts[i].value;
      contextAfter = val.length > 35 ? val.slice(0, 35) + "..." : val;
    }

    // Clean up spaces at ends for comparison keys
    const cleanBefore = before.trim();
    const cleanAfter = after.trim();

    if (cleanBefore || cleanAfter) {
      // Content-based key to persist comments during active typing
      const id = `${cleanBefore}||${cleanAfter}`;
      
      // Avoid duplicate chunk keys in the same list
      if (!chunks.some(c => c.id === id)) {
        chunks.push({
          id,
          before,
          after,
          contextBefore,
          contextAfter
        });
      }
    }
  }

  return chunks;
}

