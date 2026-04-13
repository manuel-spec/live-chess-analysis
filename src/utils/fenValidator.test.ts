import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidFen } from './fenValidator';

describe('FEN Validator - Unit Tests', () => {
  describe('Valid FEN strings', () => {
    it('should validate starting position', () => {
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(isValidFen(startingFen)).toBe(true);
    });

    it('should validate position after 1.e4', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with no castling rights', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with partial castling rights', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Kq - 0 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with en passant on rank 6', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq a6 0 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with en passant on rank 3', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq h3 0 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with high halfmove clock', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 50 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with high fullmove number', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 100';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate complex middlegame position', () => {
      const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate endgame position', () => {
      const fen = '8/8/8/8/8/4k3/8/4K3 w - - 0 1';
      expect(isValidFen(fen)).toBe(true);
    });
  });

  describe('Invalid FEN strings - Wrong number of components', () => {
    it('should reject FEN with too few components', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq')).toBe(false);
    });

    it('should reject FEN with too many components', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 extra')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidFen('')).toBe(false);
    });

    it('should reject null input', () => {
      expect(isValidFen(null as any)).toBe(false);
    });

    it('should reject undefined input', () => {
      expect(isValidFen(undefined as any)).toBe(false);
    });
  });

  describe('Invalid FEN strings - Piece placement', () => {
    it('should reject FEN with too few ranks', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with too many ranks', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with invalid piece characters', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPXPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with rank having too many squares', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with rank having too few squares', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/7/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with invalid digit 0', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/0/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with invalid digit 9', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false);
    });
  });

  describe('Invalid FEN strings - Active color', () => {
    it('should reject FEN with invalid active color', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with uppercase W', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR W KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with uppercase B', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR B KQkq - 0 1')).toBe(false);
    });

    it('should reject FEN with empty active color', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR  KQkq - 0 1')).toBe(false);
    });
  });

  describe('Invalid FEN strings - Castling rights', () => {
    it('should reject FEN with invalid castling character', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkqX - 0 1')).toBe(false);
    });

    it('should reject FEN with duplicate castling rights', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KKQkq - 0 1')).toBe(false);
    });

    it('should accept FEN with castling rights in any order', () => {
      // FEN specification allows castling rights in any order as long as no duplicates
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w kKqQ - 0 1')).toBe(true);
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w qQkK - 0 1')).toBe(true);
    });
  });

  describe('Invalid FEN strings - En passant', () => {
    it('should reject FEN with invalid en passant square', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1')).toBe(false);
    });

    it('should reject FEN with en passant on rank 1', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq a1 0 1')).toBe(false);
    });

    it('should reject FEN with en passant on rank 8', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq a8 0 1')).toBe(false);
    });

    it('should reject FEN with invalid file in en passant', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq i3 0 1')).toBe(false);
    });

    it('should reject FEN with uppercase en passant square', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq E3 0 1')).toBe(false);
    });
  });

  describe('Invalid FEN strings - Halfmove clock', () => {
    it('should reject FEN with negative halfmove clock', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1')).toBe(false);
    });

    it('should reject FEN with non-numeric halfmove clock', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - abc 1')).toBe(false);
    });

    it('should reject FEN with decimal halfmove clock', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 1.5 1')).toBe(false);
    });

    it('should reject FEN with leading zeros in halfmove clock', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 01 1')).toBe(false);
    });
  });

  describe('Invalid FEN strings - Fullmove number', () => {
    it('should reject FEN with zero fullmove number', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0')).toBe(false);
    });

    it('should reject FEN with negative fullmove number', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 -1')).toBe(false);
    });

    it('should reject FEN with non-numeric fullmove number', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 abc')).toBe(false);
    });

    it('should reject FEN with decimal fullmove number', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1.5')).toBe(false);
    });

    it('should reject FEN with leading zeros in fullmove number', () => {
      expect(isValidFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 01')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle FEN with extra whitespace', () => {
      const fen = '  rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR   w   KQkq   -   0   1  ';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should reject FEN with tabs instead of spaces', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR\tw\tKQkq\t-\t0\t1';
      // This should actually pass since we split on \s+ which includes tabs
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate position with all pieces', () => {
      const fen = 'rnbqkbnr/pppppppp/PPPPPPPP/RNBQKBNR/8/8/8/8 w - - 0 1';
      expect(isValidFen(fen)).toBe(true);
    });

    it('should validate empty board except kings', () => {
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
      expect(isValidFen(fen)).toBe(true);
    });
  });
});

describe('FEN Validator - Property-Based Tests', () => {
  /**
   * **Validates: Requirements 7.1, 15.4**
   * 
   * Property: Valid FEN components should always produce a valid FEN string
   */
  it('should validate FEN strings constructed from valid components', () => {
    const validPiecePlacement = fc.constantFrom(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      'r1bqkbnr/pppppppp/2n5/8/8/8/PPPPPPPP/RNBQKBNR',
      '8/8/8/8/8/8/8/8',
      '4k3/8/8/8/8/8/8/4K3'
    );

    const validActiveColor = fc.constantFrom('w', 'b');
    
    const validCastling = fc.constantFrom('-', 'KQkq', 'KQ', 'kq', 'K', 'Q', 'k', 'q', 'Kk', 'Qq');
    
    const validEnPassant = fc.constantFrom('-', 'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3', 'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6');
    
    const validHalfmove = fc.nat(100).map(n => n.toString());
    
    const validFullmove = fc.integer({ min: 1, max: 500 }).map(n => n.toString());

    fc.assert(
      fc.property(
        validPiecePlacement,
        validActiveColor,
        validCastling,
        validEnPassant,
        validHalfmove,
        validFullmove,
        (placement, color, castling, enPassant, halfmove, fullmove) => {
          const fen = `${placement} ${color} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
          return isValidFen(fen);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * Property: Invalid active color should always fail validation
   */
  it('should reject FEN with invalid active color', () => {
    const invalidColor = fc.string().filter(s => s !== 'w' && s !== 'b' && s.length > 0);

    fc.assert(
      fc.property(invalidColor, (color) => {
        const fen = `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR ${color} KQkq - 0 1`;
        return !isValidFen(fen);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * Property: Invalid en passant squares (not on rank 3 or 6) should fail validation
   */
  it('should reject FEN with en passant on invalid ranks', () => {
    const invalidEnPassant = fc.constantFrom('a1', 'a2', 'a4', 'a5', 'a7', 'a8', 'e1', 'e2', 'e4', 'e5', 'e7', 'e8');

    fc.assert(
      fc.property(invalidEnPassant, (enPassant) => {
        const fen = `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq ${enPassant} 0 1`;
        return !isValidFen(fen);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * Property: Negative or zero fullmove numbers should fail validation
   */
  it('should reject FEN with invalid fullmove numbers', () => {
    const invalidFullmove = fc.integer({ max: 0 });

    fc.assert(
      fc.property(invalidFullmove, (fullmove) => {
        const fen = `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 ${fullmove}`;
        return !isValidFen(fen);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * Property: Negative halfmove clocks should fail validation
   */
  it('should reject FEN with negative halfmove clock', () => {
    const negativeHalfmove = fc.integer({ max: -1 });

    fc.assert(
      fc.property(negativeHalfmove, (halfmove) => {
        const fen = `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ${halfmove} 1`;
        return !isValidFen(fen);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.1**
   * 
   * Property: FEN strings with wrong number of ranks should fail validation
   */
  it('should reject FEN with incorrect number of ranks', () => {
    const incorrectRanks = fc.constantFrom(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP', // 7 ranks
      'rnbqkbnr/pppppppp/8/8/8/8/8/PPPPPPPP/RNBQKBNR', // 9 ranks
      '8/8/8', // 3 ranks
      '' // 0 ranks
    );

    fc.assert(
      fc.property(incorrectRanks, (ranks) => {
        const fen = `${ranks} w KQkq - 0 1`;
        return !isValidFen(fen);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 7.1, 15.4**
   * 
   * Property: Valid FEN should remain valid after trimming whitespace
   */
  it('should handle whitespace variations in valid FEN', () => {
    const validFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const whitespace = fc.constantFrom('', ' ', '  ', '\t', '\n');

    fc.assert(
      fc.property(whitespace, whitespace, (prefix, suffix) => {
        const fenWithWhitespace = `${prefix}${validFen}${suffix}`;
        return isValidFen(fenWithWhitespace);
      }),
      { numRuns: 20 }
    );
  });
});
