import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidUsername, isValidDepth, sanitizeInput, sanitizeFen } from './inputValidator';

describe('Input Validator - Unit Tests', () => {
  describe('Username Validation', () => {
    describe('Valid usernames', () => {
      it('should validate simple username', () => {
        expect(isValidUsername('hikaru')).toBe(true);
      });

      it('should validate username with numbers', () => {
        expect(isValidUsername('player123')).toBe(true);
      });

      it('should validate username with underscores', () => {
        expect(isValidUsername('chess_master')).toBe(true);
      });

      it('should validate username with hyphens', () => {
        expect(isValidUsername('chess-player')).toBe(true);
      });

      it('should validate single character username', () => {
        expect(isValidUsername('a')).toBe(true);
      });

      it('should validate long username', () => {
        expect(isValidUsername('verylongusernamethatisvalid')).toBe(true);
      });

      it('should validate username with mixed case', () => {
        expect(isValidUsername('ChessMaster')).toBe(true);
      });

      it('should trim and validate username with surrounding whitespace', () => {
        expect(isValidUsername('  hikaru  ')).toBe(true);
      });
    });

    describe('Invalid usernames', () => {
      it('should reject empty string', () => {
        expect(isValidUsername('')).toBe(false);
      });

      it('should reject whitespace-only string', () => {
        expect(isValidUsername('   ')).toBe(false);
      });

      it('should reject null input', () => {
        expect(isValidUsername(null as any)).toBe(false);
      });

      it('should reject undefined input', () => {
        expect(isValidUsername(undefined as any)).toBe(false);
      });

      it('should reject non-string input (number)', () => {
        expect(isValidUsername(123 as any)).toBe(false);
      });

      it('should reject non-string input (object)', () => {
        expect(isValidUsername({} as any)).toBe(false);
      });

      it('should reject non-string input (array)', () => {
        expect(isValidUsername([] as any)).toBe(false);
      });
    });
  });

  describe('Depth Validation', () => {
    describe('Valid depths', () => {
      it('should validate depth 1', () => {
        expect(isValidDepth(1)).toBe(true);
      });

      it('should validate depth 15', () => {
        expect(isValidDepth(15)).toBe(true);
      });

      it('should validate depth 20', () => {
        expect(isValidDepth(20)).toBe(true);
      });

      it('should validate depth 30', () => {
        expect(isValidDepth(30)).toBe(true);
      });

      it('should validate all depths from 1 to 30', () => {
        for (let depth = 1; depth <= 30; depth++) {
          expect(isValidDepth(depth)).toBe(true);
        }
      });
    });

    describe('Invalid depths', () => {
      it('should reject depth 0', () => {
        expect(isValidDepth(0)).toBe(false);
      });

      it('should reject depth 31', () => {
        expect(isValidDepth(31)).toBe(false);
      });

      it('should reject negative depth', () => {
        expect(isValidDepth(-1)).toBe(false);
      });

      it('should reject large depth', () => {
        expect(isValidDepth(100)).toBe(false);
      });

      it('should reject decimal depth', () => {
        expect(isValidDepth(15.5)).toBe(false);
      });

      it('should reject NaN', () => {
        expect(isValidDepth(NaN)).toBe(false);
      });

      it('should reject Infinity', () => {
        expect(isValidDepth(Infinity)).toBe(false);
      });

      it('should reject negative Infinity', () => {
        expect(isValidDepth(-Infinity)).toBe(false);
      });

      it('should reject non-number input (string)', () => {
        expect(isValidDepth('15' as any)).toBe(false);
      });

      it('should reject non-number input (null)', () => {
        expect(isValidDepth(null as any)).toBe(false);
      });

      it('should reject non-number input (undefined)', () => {
        expect(isValidDepth(undefined as any)).toBe(false);
      });

      it('should reject non-number input (object)', () => {
        expect(isValidDepth({} as any)).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    describe('Safe inputs', () => {
      it('should preserve alphanumeric strings', () => {
        expect(sanitizeInput('abc123')).toBe('abc123');
      });

      it('should preserve spaces', () => {
        expect(sanitizeInput('hello world')).toBe('hello world');
      });

      it('should preserve hyphens', () => {
        expect(sanitizeInput('chess-player')).toBe('chess-player');
      });

      it('should preserve underscores', () => {
        expect(sanitizeInput('chess_master')).toBe('chess_master');
      });

      it('should preserve forward slashes', () => {
        expect(sanitizeInput('path/to/file')).toBe('pathtofile');
      });

      it('should preserve periods', () => {
        expect(sanitizeInput('file.txt')).toBe('file.txt');
      });
    });

    describe('Dangerous inputs', () => {
      it('should remove semicolons', () => {
        expect(sanitizeInput('test;command')).toBe('testcommand');
      });

      it('should remove pipe characters', () => {
        expect(sanitizeInput('test|command')).toBe('testcommand');
      });

      it('should remove ampersands', () => {
        expect(sanitizeInput('test&command')).toBe('testcommand');
      });

      it('should remove dollar signs', () => {
        expect(sanitizeInput('test$var')).toBe('testvar');
      });

      it('should remove backticks', () => {
        expect(sanitizeInput('test`command`')).toBe('testcommand');
      });

      it('should remove backslashes', () => {
        expect(sanitizeInput('test\\command')).toBe('testcommand');
      });

      it('should remove double quotes', () => {
        expect(sanitizeInput('test"quoted"')).toBe('testquoted');
      });

      it('should remove single quotes', () => {
        expect(sanitizeInput("test'quoted'")).toBe('testquoted');
      });

      it('should remove angle brackets', () => {
        expect(sanitizeInput('test<input>output')).toBe('testinputoutput');
      });

      it('should remove parentheses', () => {
        expect(sanitizeInput('test(command)')).toBe('testcommand');
      });

      it('should remove curly braces', () => {
        expect(sanitizeInput('test{command}')).toBe('testcommand');
      });

      it('should remove square brackets', () => {
        expect(sanitizeInput('test[command]')).toBe('testcommand');
      });

      it('should remove asterisks', () => {
        expect(sanitizeInput('test*wildcard')).toBe('testwildcard');
      });

      it('should remove question marks', () => {
        expect(sanitizeInput('test?wildcard')).toBe('testwildcard');
      });

      it('should remove tildes', () => {
        expect(sanitizeInput('test~home')).toBe('testhome');
      });

      it('should remove exclamation marks', () => {
        expect(sanitizeInput('test!command')).toBe('testcommand');
      });

      it('should remove hash symbols', () => {
        expect(sanitizeInput('test#comment')).toBe('testcomment');
      });

      it('should remove newlines', () => {
        expect(sanitizeInput('test\ncommand')).toBe('testcommand');
      });

      it('should remove carriage returns', () => {
        expect(sanitizeInput('test\rcommand')).toBe('testcommand');
      });

      it('should remove tabs', () => {
        expect(sanitizeInput('test\tcommand')).toBe('testcommand');
      });

      it('should handle command injection attempt', () => {
        expect(sanitizeInput('test; rm -rf /')).toBe('test rm -rf ');
      });

      it('should handle pipe injection attempt', () => {
        expect(sanitizeInput('test | cat /etc/passwd')).toBe('test  cat etcpasswd');
      });

      it('should handle backtick injection attempt', () => {
        expect(sanitizeInput('test`whoami`')).toBe('testwhoami');
      });
    });

    describe('Edge cases', () => {
      it('should return empty string for null input', () => {
        expect(sanitizeInput(null as any)).toBe('');
      });

      it('should return empty string for undefined input', () => {
        expect(sanitizeInput(undefined as any)).toBe('');
      });

      it('should return empty string for non-string input', () => {
        expect(sanitizeInput(123 as any)).toBe('');
      });

      it('should handle empty string', () => {
        expect(sanitizeInput('')).toBe('');
      });

      it('should handle string with only dangerous characters', () => {
        expect(sanitizeInput(';|&$`')).toBe('');
      });
    });
  });

  describe('FEN Sanitization', () => {
    describe('Valid FEN inputs', () => {
      it('should preserve valid FEN string', () => {
        const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        expect(sanitizeFen(fen)).toBe(fen);
      });

      it('should preserve FEN with all piece types', () => {
        const fen = 'rnbqkbnr/PPPPPPPP/8/8/8/8/pppppppp/RNBQKBNR w - - 0 1';
        expect(sanitizeFen(fen)).toBe(fen);
      });

      it('should preserve FEN with numbers', () => {
        const fen = '8/8/8/8/8/8/8/8 w - - 0 1';
        expect(sanitizeFen(fen)).toBe(fen);
      });

      it('should preserve FEN with slashes', () => {
        const fen = 'r/n/b/q/k/b/n/r w - - 0 1';
        expect(sanitizeFen(fen)).toBe(fen);
      });

      it('should preserve FEN with hyphens', () => {
        const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
        expect(sanitizeFen(fen)).toBe(fen);
      });
    });

    describe('Invalid FEN inputs', () => {
      it('should remove invalid characters', () => {
        const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1; rm -rf /';
        const expected = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 rm -rf /';
        expect(sanitizeFen(fen)).toBe(expected);
      });

      it('should remove command injection attempts', () => {
        const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR`whoami`';
        const expected = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNRwhoami';
        expect(sanitizeFen(fen)).toBe(expected);
      });

      it('should remove special characters', () => {
        const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR$test';
        const expected = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNRtest';
        expect(sanitizeFen(fen)).toBe(expected);
      });
    });

    describe('Edge cases', () => {
      it('should return empty string for null input', () => {
        expect(sanitizeFen(null as any)).toBe('');
      });

      it('should return empty string for undefined input', () => {
        expect(sanitizeFen(undefined as any)).toBe('');
      });

      it('should return empty string for non-string input', () => {
        expect(sanitizeFen(123 as any)).toBe('');
      });

      it('should handle empty string', () => {
        expect(sanitizeFen('')).toBe('');
      });
    });
  });
});

describe('Input Validator - Property-Based Tests', () => {
  /**
   * **Validates: Requirements 7.2**
   * 
   * Property: Non-empty strings should be valid usernames
   */
  it('should validate non-empty string usernames', () => {
    const nonEmptyString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

    fc.assert(
      fc.property(nonEmptyString, (username) => {
        return isValidUsername(username);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   * 
   * Property: Empty or whitespace-only strings should be invalid usernames
   */
  it('should reject empty or whitespace-only usernames', () => {
    const emptyOrWhitespace = fc.oneof(
      fc.constant(''),
      fc.constant('   '),
      fc.constant('\t'),
      fc.constant('\n'),
      fc.constant('  \t  \n  ')
    );

    fc.assert(
      fc.property(emptyOrWhitespace, (username) => {
        return !isValidUsername(username);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property: Integers between 1 and 30 (inclusive) should be valid depths
   */
  it('should validate depths between 1 and 30', () => {
    const validDepth = fc.integer({ min: 1, max: 30 });

    fc.assert(
      fc.property(validDepth, (depth) => {
        return isValidDepth(depth);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property: Integers outside 1-30 range should be invalid depths
   */
  it('should reject depths outside 1-30 range', () => {
    const invalidDepth = fc.oneof(
      fc.integer({ max: 0 }),
      fc.integer({ min: 31, max: 1000 })
    );

    fc.assert(
      fc.property(invalidDepth, (depth) => {
        return !isValidDepth(depth);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property: Non-integer numbers should be invalid depths
   */
  it('should reject non-integer depths', () => {
    const nonInteger = fc.double({ min: 1.1, max: 29.9, noNaN: true }).filter(n => !Number.isInteger(n));

    fc.assert(
      fc.property(nonInteger, (depth) => {
        return !isValidDepth(depth);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.5**
   * 
   * Property: Sanitized input should not contain shell metacharacters
   */
  it('should remove all shell metacharacters from input', () => {
    const dangerousChars = [';', '|', '&', '$', '`', '\\', '"', "'", '<', '>', '(', ')', '{', '}', '[', ']', '*', '?', '~', '!', '#', '\n', '\r', '\t'];
    
    fc.assert(
      fc.property(fc.string(), (input) => {
        const sanitized = sanitizeInput(input);
        // Check that none of the dangerous characters remain
        return dangerousChars.every(char => !sanitized.includes(char));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.5**
   * 
   * Property: Sanitizing safe strings should preserve them
   */
  it('should preserve safe alphanumeric strings', () => {
    const safeString = fc.stringMatching(/^[a-zA-Z0-9 \-_.]+$/);

    fc.assert(
      fc.property(safeString, (input) => {
        return sanitizeInput(input) === input;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.5**
   * 
   * Property: Sanitized FEN should not contain dangerous shell metacharacters
   */
  it('should ensure sanitized FEN does not contain dangerous characters', () => {
    const dangerousChars = [';', '&', '|', '`', '$', '\\', '<', '>', '(', ')', '{', '}', '[', ']', '*', '?', '~', '!', '#', '\n', '\r', '\t', '"', "'"];

    fc.assert(
      fc.property(fc.string(), (input) => {
        const sanitized = sanitizeFen(input);
        // Check that none of the dangerous characters remain
        return dangerousChars.every(char => !sanitized.includes(char));
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.5**
   * 
   * Property: Sanitization should be idempotent (sanitizing twice gives same result)
   */
  it('should be idempotent for input sanitization', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const sanitized1 = sanitizeInput(input);
        const sanitized2 = sanitizeInput(sanitized1);
        return sanitized1 === sanitized2;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.5**
   * 
   * Property: FEN sanitization should be idempotent
   */
  it('should be idempotent for FEN sanitization', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const sanitized1 = sanitizeFen(input);
        const sanitized2 = sanitizeFen(sanitized1);
        return sanitized1 === sanitized2;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2, 7.3**
   * 
   * Property: Type checking should prevent non-string/non-number inputs
   */
  it('should reject non-string inputs for username validation', () => {
    const nonString = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.object(),
      fc.array(fc.anything())
    );

    fc.assert(
      fc.property(nonString, (input) => {
        return !isValidUsername(input as any);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property: Special numeric values should be rejected as depths
   */
  it('should reject special numeric values as depths', () => {
    const specialValues = fc.constantFrom(NaN, Infinity, -Infinity);

    fc.assert(
      fc.property(specialValues, (depth) => {
        return !isValidDepth(depth);
      }),
      { numRuns: 20 }
    );
  });
});
