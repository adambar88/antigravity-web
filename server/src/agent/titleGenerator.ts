import { spawn } from 'node:child_process';

// In-flight promise cache to deduplicate simultaneous requests for the same prompt
const inFlightRequests = new Map<string, Promise<string>>();

/**
 * Strips formatting, markdown, quotes, prefixes, and normalizes AI generated title.
 */
export function cleanGeneratedTitle(raw: string): string {
  if (!raw) return '';

  // Take the first non-empty line
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let line = lines[0] || '';

  // Remove common AI prefixes like "Tytuł:", "Tytuł zadania:", "Title:", "Zadanie:"
  line = line.replace(/^(tytuł zadania|tytuł|title|zadanie|sugerowany tytuł)\s*:\s*/i, '');

  // Remove surrounding quotes, backticks, asterisks
  line = line.replace(/^["'`„”«»*]+|["'`„”«»*]+$/g, '').trim();

  // Strip internal markdown bold/italics
  line = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();

  // Remove trailing period if present
  line = line.replace(/\.+$/, '').trim();

  // Capitalize first letter
  if (line.length > 0) {
    line = line.charAt(0).toUpperCase() + line.slice(1);
  }

  // Safety length cap
  if (line.length > 60) {
    line = line.slice(0, 60).trim();
  }

  return line;
}

/**
 * Intelligent heuristic fallback if AI CLI is temporarily unavailable or times out.
 * Converts conversational prompt commands into concise action titles without verbatim copying.
 */
export function smartHeuristicTitle(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return 'Nowe zadanie';

  // Take the first sentence/line
  const firstLine = trimmed.split(/\r?\n/)[0].trim();
  const firstClause = firstLine.split(/[.!?;,]/)[0].trim();

  // Remove conversational Polish prefixes
  let cleaned = firstClause
    .replace(/^(proszę( cię)?|prosze|chcę( aby| żeby)?|chce( aby| żeby)?|weź|musisz|mógłbyś|czy możesz|zrób tak żeby|zrób aby|potrzebuję)\s+/i, '')
    .trim();

  // Pick first 4-5 meaningful words
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 5) {
    cleaned = words.slice(0, 5).join(' ');
  }

  if (!cleaned) return 'Nowe zadanie';

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned;
}

/**
 * Generates a concise, semantic Polish task title using AI (via agy CLI with gemini-3.6-flash-low).
 * Resembles the title generation behavior of Antigravity and Claude.
 */
export async function generateSessionTitle(
  prompt: string,
  timeoutMs: number = 15000
): Promise<string> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    return 'Nowe zadanie';
  }

  // Very short prompt (1-3 words, under 25 chars) can directly serve as a clean title
  const words = cleanPrompt.split(/\s+/);
  if (words.length <= 3 && cleanPrompt.length <= 25 && !/[.!?]/.test(cleanPrompt)) {
    return cleanPrompt.charAt(0).toUpperCase() + cleanPrompt.slice(1);
  }

  // Deduplicate identical in-flight title generation requests
  const cacheKey = cleanPrompt.slice(0, 150);
  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const agyBin = process.env.AGY_BIN || 'agy';
    const truncatedPrompt = cleanPrompt.slice(0, 600);
    const instruction = `Stwórz bardzo krótki, zwięzły tytuł zadania (maksymalnie 2-5 słów, bez cudzysłowów, kropek i formatowania markdown, po polsku) najlepiej oddający istotę tego polecenia:\n"${truncatedPrompt}"\nZwróć WYŁĄCZNIE treść tytułu.`;

    return new Promise<string>((resolve) => {
      let resolved = false;
      const safeResolve = (title: string) => {
        if (!resolved) {
          resolved = true;
          inFlightRequests.delete(cacheKey);
          resolve(title);
        }
      };

      const timer = setTimeout(() => {
        safeResolve(smartHeuristicTitle(cleanPrompt));
      }, timeoutMs);

      try {
        const child = spawn(
          agyBin,
          [
            '--model',
            'gemini-3.6-flash-low',
            '--disable-slash-commands',
            '-p',
            instruction,
          ],
          {
            env: {
              ...process.env,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        let stdout = '';

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        child.on('error', () => {
          clearTimeout(timer);
          safeResolve(smartHeuristicTitle(cleanPrompt));
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0 && stdout.trim()) {
            const cleaned = cleanGeneratedTitle(stdout);
            if (cleaned) {
              safeResolve(cleaned);
              return;
            }
          }
          safeResolve(smartHeuristicTitle(cleanPrompt));
        });
      } catch {
        clearTimeout(timer);
        safeResolve(smartHeuristicTitle(cleanPrompt));
      }
    });
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}
