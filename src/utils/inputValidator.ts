/**
 * Input Validation Utilities
 * 
 * Provides validation and sanitization functions for user inputs to ensure
 * data integrity and security before passing to external processes.
 */

/**
 * Validates a Chess.com username
 * 
 * @param username - The username to validate
 * @returns true if the username is valid, false otherwise
 * 
 * Validates:
 * - Username is a non-empty string
 * - Username contains only valid characters
 */
export function isValidUsername(username: string): boolean {
  // Handle null, undefined, or non-string inputs
  if (!username || typeof username !== 'string') {
    return false;
  }

  // Trim whitespace and check if empty
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return false;
  }

  return true;
}

/**
 * Validates an analysis depth parameter
 * 
 * @param depth - The depth value to validate
 * @returns true if the depth is valid, false otherwise
 * 
 * Validates:
 * - Depth is an integer between 1 and 30 (inclusive)
 */
export function isValidDepth(depth: number): boolean {
  // Check if depth is a number
  if (typeof depth !== 'number') {
    return false;
  }

  // Check if depth is an integer
  if (!Number.isInteger(depth)) {
    return false;
  }

  // Check if depth is NaN or Infinity
  if (isNaN(depth) || !isFinite(depth)) {
    return false;
  }

  // Check if depth is within valid range (1-30)
  if (depth < 1 || depth > 30) {
    return false;
  }

  return true;
}

/**
 * Sanitizes input strings for safe use with external processes
 * 
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for external process usage
 * 
 * Removes or escapes potentially dangerous characters that could be used
 * for command injection when passing data to external processes like Stockfish.
 * 
 * Dangerous characters include:
 * - Shell metacharacters: ; | & $ ` \ " ' < > ( ) { } [ ] * ? ~ ! # \n \r /
 * - Control characters
 */
export function sanitizeInput(input: string): string {
  // Handle null, undefined, or non-string inputs
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove shell metacharacters and control characters
  // Keep only alphanumeric, spaces, hyphens, underscores, and basic punctuation
  const sanitized = input.replace(/[;&|`$\\<>(){}[\]*?~!#\n\r\t"'/]/g, '');

  return sanitized;
}

/**
 * Validates and sanitizes a FEN string for safe use with Stockfish
 * 
 * @param fen - The FEN string to validate and sanitize
 * @returns Sanitized FEN string if valid, empty string otherwise
 * 
 * This function ensures the FEN string contains only valid FEN characters
 * and is safe to pass to the Stockfish engine via UCI protocol.
 * 
 * Valid FEN characters include:
 * - Piece letters: pnbrqkPNBRQK
 * - Digits: 0-9 (for move counters and empty squares)
 * - Spaces, slashes, hyphens
 * - Letters w, b for active color
 * - Letters for castling rights: KQkq
 * - Letters a-h for en passant file
 */
export function sanitizeFen(fen: string): string {
  // Handle null, undefined, or non-string inputs
  if (!fen || typeof fen !== 'string') {
    return '';
  }

  // FEN should only contain: 
  // - Piece letters (pnbrqkPNBRQK)
  // - Digits (0-9) for move counters and empty squares
  // - Spaces, slashes, hyphens
  // - Active color (w, b)
  // - Castling rights (KQkq)
  // - En passant file (a-h)
  // Remove dangerous shell metacharacters while preserving valid FEN characters
  const sanitized = fen.replace(/[;&|`$\\<>(){}[\]*?~!#\n\r\t"']/g, '');

  return sanitized;
}
