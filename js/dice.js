/* ============================================================
   Abberanth Companion — Dice Engine
   Custom d10 pool system.

   Rules:
   Skill 0  → 1d10, no explosions, keep 1, +0 bonus
   Skill 1  → 1d10, explosions on 10s, keep 1, +0 bonus
   Skill 2-10 → skill×d10, explosions, keep 1
   Skill 11  → 10d10 (pool caps at 10), keep 1
   Skill 12  → 10d10, keep 2
   Skill 14  → 10d10, keep 3
   ...every +2 skill above 10 adds 1 to keep count...
   Skill 28  → 10d10, keep 10 (all)
   Skill 32  → 10d10, keep 10, +1 bonus
   Skill 36  → 10d10, keep 10, +2 bonus
   ...every +4 skill above 28 adds +1 flat bonus...
   ============================================================ */

const Dice = (() => {

  /**
   * Compute pool statistics for a given skill level (0+).
   * @param   {number} skill
   * @returns {{ skill, poolSize, keepCount, bonus, canExplode }}
   */
  function getPoolStats(skill) {
    const s = Math.max(0, Math.floor(skill));

    // Pool grows with skill up to 10, then stays at 10
    const poolSize = s === 0 ? 1 : Math.min(s, 10);

    // Explosions kick in at skill 1+
    const canExplode = s >= 1;

    // Keep count:
    //   skill 0–10 → keep 1
    //   skill 11+  → keep = 1 + floor((skill − 10) / 2), capped at 10
    //   milestone check: skill 12 → keep 2, skill 14 → keep 3, ..., skill 28 → keep 10
    let keepCount;
    if (s <= 10) {
      keepCount = 1;
    } else {
      keepCount = Math.min(10, 1 + Math.floor((s - 10) / 2));
    }

    // Flat bonus starts after keep reaches 10 (skill 28)
    // Every 4 skill points above 28 → +1 bonus, capped at +10 (reached at skill 68)
    const bonus = s > 28 ? Math.min(10, Math.floor((s - 28) / 4)) : 0;

    return { skill: s, poolSize, keepCount, bonus, canExplode };
  }

  /** Roll a single d10 (1–10). */
  function d10() {
    return Math.floor(Math.random() * 10) + 1;
  }

  /**
   * Roll one die, chaining explosions if canExplode.
   * A 10 explodes: keep rolling and summing until a non-10 appears.
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
   * Return indices of dice to keep automatically (highest or lowest).
   * @param {DieResult[]}  dice
   * @param {number}       keepCount
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
   * @param {DieResult[]}       dice
   * @param {Iterable<number>}  keptIndices
   * @param {number}            bonus
   * @returns {number}
   */
  function calcTotal(dice, keptIndices, bonus) {
    return [...keptIndices].reduce((acc, i) => acc + dice[i].total, 0) + bonus;
  }

  return { getPoolStats, rollPool, autoSelect, calcTotal };

})();