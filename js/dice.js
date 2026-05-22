/* ============================================================
   Abberanth Companion — Dice Engine
   Custom d10 pool system.

   Rules:
   - Skill 0  → roll 1d10, no explosions, keep 1, +0 bonus
   - Skill 1+ → roll skill×d10 (max 10), any 10 chain-explodes,
                keep floor(skill/2) min 1, bonus floor(skill/4)
   ============================================================ */

const Dice = (() => {

  /**
   * Compute pool statistics for a given skill level (0–10).
   * @param   {number} skill
   * @returns {{ skill, poolSize, keepCount, bonus, canExplode }}
   */
  function getPoolStats(skill) {
    const s = Math.max(0, Math.min(10, Math.floor(skill)));
    return {
      skill:      s,
      poolSize:   s === 0 ? 1 : s,
      keepCount:  Math.max(1, Math.floor(s / 2)),
      bonus:      Math.floor(s / 4),
      canExplode: s > 0,
    };
  }

  /** Roll a single d10 (1–10). */
  function d10() {
    return Math.floor(Math.random() * 10) + 1;
  }

  /**
   * Roll one die, chaining explosions if canExplode.
   * @returns {{ chain: number[], total: number, exploded: boolean }}
   */
  function rollOneDie(canExplode) {
    const chain = [];
    let face = d10();
    chain.push(face);

    if (canExplode) {
      while (face === 10) {
        face = d10();
        chain.push(face);
      }
    }

    return {
      chain,
      total:    chain.reduce((a, b) => a + b, 0),
      exploded: chain.length > 1,
    };
  }

  /**
   * Roll the full pool for a skill level.
   * @returns {{ dice: DieResult[], stats: PoolStats }}
   */
  function rollPool(skill) {
    const stats = getPoolStats(skill);
    const dice  = Array.from({ length: stats.poolSize }, () => rollOneDie(stats.canExplode));
    return { dice, stats };
  }

  /**
   * Return indices of dice to keep automatically.
   * @param {DieResult[]} dice
   * @param {number}      keepCount
   * @param {'high'|'low'} preference
   * @returns {number[]}
   */
  function autoSelect(dice, keepCount, preference = 'high') {
    return dice
      .map((d, i) => ({ ...d, i }))
      .sort((a, b) => preference === 'high' ? b.total - a.total : a.total - b.total)
      .slice(0, keepCount)
      .map(d => d.i);
  }

  /**
   * Sum kept dice + bonus.
   * @param {DieResult[]} dice
   * @param {Iterable<number>} keptIndices
   * @param {number} bonus
   * @returns {number}
   */
  function calcTotal(dice, keptIndices, bonus) {
    return [...keptIndices].reduce((acc, i) => acc + dice[i].total, 0) + bonus;
  }

  return { getPoolStats, rollPool, autoSelect, calcTotal };
})();
