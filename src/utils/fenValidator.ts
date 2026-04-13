/**
 * FEN Validator Utility
 * 
 * Validates Forsyth-Edwards Notation (FEN) strings according to standard chess notation rules.
 * FEN format: <piece placement> <active color> <castling> <en passant> <halfmove> <fullmove>
 * 
 * Example: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
 */

/**
 * Validates a FEN string for correctness
 * 
 * @param fen - The FEN string to validate
 * @returns true if the FEN is valid, false otherwise
 * 
 * Validates:
 * - Piece placement (8 ranks, valid pieces and empty square counts)
 * - Active color (w or b)
 * - Castling rights (combination of KQkq or -)
 * - En passant target square (algebraic notation or -)
 * - Halfmove clock (non-negative integer)
 * - Fullmove number (positive integer)
 */
export function isValidFen(fen: string): boolean {
  // Handle null, undefined, or non-string inputs
  if (!fen || typeof fen !== 'string') {
    return false;
  }

  // Trim whitespace and split into components
  const parts = fen.trim().split(/\s+/);

  // FEN must have exactly 6 components
  if (parts.length !== 6) {
    return false;
  }

  const [piecePlacement, activeColor, castling, enPassant, halfmove, fullmove] = parts;

  // Validate piece placement
  if (!isValidPiecePlacement(piecePlacement)) {
    return false;
  }

  // Validate active color
  if (!isValidActiveColor(activeColor)) {
    return false;
  }

  // Validate castling rights
  if (!isValidCastling(castling)) {
    return false;
  }

  // Validate en passant
  if (!isValidEnPassant(enPassant)) {
    return false;
  }

  // Validate halfmove clock
  if (!isValidHalfmove(halfmove)) {
    return false;
  }

  // Validate fullmove number
  if (!isValidFullmove(fullmove)) {
    return false;
  }

  return true;
}

/**
 * Validates the piece placement component of FEN
 * Must have exactly 8 ranks separated by '/'
 * Each rank must have valid pieces (pPnNbBrRqQkK) and/or digits (1-8)
 * Each rank must sum to exactly 8 squares
 */
function isValidPiecePlacement(placement: string): boolean {
  const ranks = placement.split('/');

  // Must have exactly 8 ranks
  if (ranks.length !== 8) {
    return false;
  }

  const validPieces = /^[pnbrqkPNBRQK12345678]+$/;

  for (const rank of ranks) {
    // Check if rank contains only valid characters
    if (!validPieces.test(rank)) {
      return false;
    }

    // Calculate the number of squares in this rank
    let squareCount = 0;
    for (const char of rank) {
      if (/\d/.test(char)) {
        const digit = parseInt(char, 10);
        // Digits must be 1-8
        if (digit < 1 || digit > 8) {
          return false;
        }
        squareCount += digit;
      } else {
        squareCount += 1;
      }
    }

    // Each rank must have exactly 8 squares
    if (squareCount !== 8) {
      return false;
    }
  }

  return true;
}

/**
 * Validates the active color component
 * Must be either 'w' (white) or 'b' (black)
 */
function isValidActiveColor(color: string): boolean {
  return color === 'w' || color === 'b';
}

/**
 * Validates the castling rights component
 * Must be '-' (no castling rights) or a combination of K, Q, k, q
 * K = white kingside, Q = white queenside, k = black kingside, q = black queenside
 * No duplicates allowed
 */
function isValidCastling(castling: string): boolean {
  if (castling === '-') {
    return true;
  }

  // Must only contain valid castling characters
  if (!/^[KQkq]+$/.test(castling)) {
    return false;
  }

  // Check for duplicates
  const chars = castling.split('');
  const uniqueChars = new Set(chars);
  if (chars.length !== uniqueChars.size) {
    return false;
  }

  // Castling rights should be in standard order (optional but good practice)
  // We'll allow any order but check for duplicates above
  return true;
}

/**
 * Validates the en passant target square
 * Must be '-' (no en passant) or a valid square in algebraic notation
 * En passant squares must be on rank 3 (for black) or rank 6 (for white)
 */
function isValidEnPassant(enPassant: string): boolean {
  if (enPassant === '-') {
    return true;
  }

  // Must be in algebraic notation: file (a-h) + rank (1-8)
  const match = /^([a-h])([1-8])$/.exec(enPassant);
  if (!match) {
    return false;
  }

  const rank = match[2];
  // En passant target squares must be on rank 3 or 6
  if (rank !== '3' && rank !== '6') {
    return false;
  }

  return true;
}

/**
 * Validates the halfmove clock
 * Must be a non-negative integer (0 or greater)
 * Counts moves since last pawn move or capture (for 50-move rule)
 */
function isValidHalfmove(halfmove: string): boolean {
  const num = parseInt(halfmove, 10);
  
  // Must be a valid integer
  if (isNaN(num) || !Number.isInteger(num)) {
    return false;
  }

  // Must be non-negative
  if (num < 0) {
    return false;
  }

  // String representation must match the parsed number (no leading zeros except "0")
  if (halfmove !== num.toString()) {
    return false;
  }

  return true;
}

/**
 * Validates the fullmove number
 * Must be a positive integer (1 or greater)
 * Increments after black's move
 */
function isValidFullmove(fullmove: string): boolean {
  const num = parseInt(fullmove, 10);
  
  // Must be a valid integer
  if (isNaN(num) || !Number.isInteger(num)) {
    return false;
  }

  // Must be positive (at least 1)
  if (num < 1) {
    return false;
  }

  // String representation must match the parsed number (no leading zeros)
  if (fullmove !== num.toString()) {
    return false;
  }

  return true;
}
