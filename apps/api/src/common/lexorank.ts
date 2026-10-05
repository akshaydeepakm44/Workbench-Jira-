/**
 * LexoRank Base-36 Fractional Indexing Engine
 * Produces lexicographically sortable compound ranks: "bucket|string:"
 */

const BASE36_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const DEFAULT_BUCKET = '0';
const MIN_RANK = '000000';
const MAX_RANK = 'zzzzzz';
const INITIAL_RANK = 'h00000';
const REBALANCE_LENGTH_THRESHOLD = 64;

export class LexoRank {
  /**
   * Parses compound rank "0|string:" into rank string
   */
  static parse(rankStr: string): { bucket: string; rank: string } {
    if (!rankStr || !rankStr.includes('|') || !rankStr.endsWith(':')) {
      return { bucket: DEFAULT_BUCKET, rank: INITIAL_RANK };
    }
    const [bucket, rest] = rankStr.split('|');
    const rank = rest.slice(0, -1);
    return { bucket, rank: rank || INITIAL_RANK };
  }

  /**
   * Formats into compound "bucket|rank:"
   */
  static format(rank: string, bucket = DEFAULT_BUCKET): string {
    return `${bucket}|${rank}:`;
  }

  /**
   * Calculates the lexicographical midpoint string between prevRank and nextRank
   */
  static calculateBetween(prevCompound?: string | null, nextCompound?: string | null): string {
    const prev = prevCompound ? LexoRank.parse(prevCompound).rank : MIN_RANK;
    const next = nextCompound ? LexoRank.parse(nextCompound).rank : MAX_RANK;

    if (prev >= next) {
      return LexoRank.format(prev + 'm');
    }

    let result = '';
    let i = 0;

    // 1. Copy common prefix
    while (i < prev.length && i < next.length && prev[i] === next[i]) {
      result += prev[i];
      i++;
    }

    const pChar = i < prev.length ? prev[i] : '0';
    const nChar = i < next.length ? next[i] : 'z';
    const pVal = BASE36_CHARS.indexOf(pChar);
    const nVal = BASE36_CHARS.indexOf(nChar);

    if (nVal - pVal > 1) {
      // Gap exists at first divergence
      const mid = Math.floor((pVal + nVal) / 2);
      result += BASE36_CHARS[mid];
      return LexoRank.format(result);
    }

    // Adjacent characters, e.g. 'y' and 'z'
    result += pChar;
    i++;

    // 2. Find gap in remainder of prev towards 'z'
    while (i < prev.length) {
      const char = prev[i];
      const val = BASE36_CHARS.indexOf(char);
      if (35 - val > 1) {
        const mid = Math.floor((val + 35) / 2);
        result += BASE36_CHARS[mid];
        return LexoRank.format(result);
      }
      result += char;
      i++;
    }

    // If prev remainder exhausted or all 'z's, append midpoint character 'm'
    result += 'm';

    // Absolute safety check: ensure strictly greater than prev
    while (result <= prev) {
      result += 'm';
    }

    return LexoRank.format(result);
  }

  /**
   * Generates evenly spaced ranks for backfill or rebalance
   */
  static generateSpacedRanks(count: number, bucket = DEFAULT_BUCKET): string[] {
    const ranks: string[] = [];
    for (let i = 0; i < count; i++) {
      const step = (i * 10).toString(36).padStart(5, '0');
      ranks.push(`${bucket}|h${step}:`);
    }
    return ranks;
  }

  /**
   * Checks if string has grown too long and requires rebalancing
   */
  static isRebalanceNeeded(rankStr: string): boolean {
    const { rank } = LexoRank.parse(rankStr);
    return rank.length > REBALANCE_LENGTH_THRESHOLD;
  }
}
