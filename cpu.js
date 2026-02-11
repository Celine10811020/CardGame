// cpu.js  (global)
// Exports: window.CPU = { setDifficulty, decideMove, pickSendCardId, getDelayMs }

(function () {
  const LEVELS = {
    easy: {
      delayMs: [3000, 6000],
      actChance: 0.70,
      hitChance: 0.70,
      falseHitChance: 0.18, // 空札誤拍率
      aggression: 0.15,
    },
    normal: {
      delayMs: [2000, 4000],
      actChance: 0.85,
      hitChance: 0.88,
      falseHitChance: 0.08,
      aggression: 0.35,
    },
    hard: {
      delayMs: [500, 2000],
      actChance: 0.95,
      hitChance: 0.97,
      falseHitChance: 0.02,
      aggression: 0.65,
    },
  };

  let difficulty = "easy";

  function randInt(a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
  }
  function roll(p) {
    return Math.random() < p;
  }

  function setDifficulty(level) {
    difficulty = LEVELS[level] ? level : "easy";
  }

  function getLevel() {
    return LEVELS[difficulty];
  }

  function getDelayMs() {
    const L = getLevel();
    return randInt(L.delayMs[0], L.delayMs[1]);
  }

  // board: { aiIds:[], playerIds:[], allIds:[] }
  // round: { isEmpty:boolean, correctId:number|null }
  function decideMove(round, board) {
    const L = getLevel();
    const delayMs = getDelayMs();

    // 空札：大多數情況不出手
    if (round.isEmpty) {
      if (!roll(L.falseHitChance)) {
        return { willAct: false, delayMs, targetId: null };
      }
      // 誤拍：偏向點自己區（像手滑），偶爾點玩家區
      const pool = roll(0.7) ? board.aiIds : board.playerIds;
      const targetId = pool[Math.floor(Math.random() * pool.length)];
      return { willAct: true, delayMs, targetId };
    }

    // 有正確牌在場上
    if (!roll(L.actChance)) return { willAct: false, delayMs, targetId: null };

    const hit = roll(L.hitChance);
    if (hit) {
      return { willAct: true, delayMs, targetId: round.correctId };
    }

    // 拍錯：從同側或隨機錯牌挑一張
    const pool = board.allIds.filter(id => id !== round.correctId);
    const targetId = pool[Math.floor(Math.random() * pool.length)];
    return { willAct: true, delayMs, targetId };
  }

  // CPU 送牌：隨機
  function pickSendCardId(aiCards) {
    if (!aiCards.length) return null;
    const c = aiCards[Math.floor(Math.random() * aiCards.length)];
    return c.id;
  }

  window.CPU = { setDifficulty, decideMove, pickSendCardId };
})();
