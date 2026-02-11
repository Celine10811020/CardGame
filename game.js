(function () {
  // ===== DOM =====
  const aiBoardEl = () => document.getElementById("aiBoard");
  const playerBoardEl = () => document.getElementById("playerBoard");
  const upperTextEl = () => document.getElementById("upperText");
  const memoryScreenEl = () => document.getElementById("memoryScreen");
  const memoryTextEl = () => document.getElementById("memoryText");
  const memoryFillEl = () => document.getElementById("memoryTimerFill");
  const topTimerEl = () => document.getElementById("topTimer");
  const bottomTimerEl = () => document.getElementById("bottomTimer");
  const aiCursorEl = () => document.getElementById("aiCursor");
  const gameEl = () => document.getElementById("game");

  // ===== State =====
  const state = {
    allPairs: [],     // 全部資料庫（PSALM_1_7）
    inPlay: [],       // 本局抽出的 40 對
    emptyPool: [],    // 空札（剩下的對）
    playerCards: [],  // 20 張（物件：{id, upper, lower, ...}）
    aiCards: [],      // 20 張
    currentPair: null,
    isEmpty: false,
    roundSeconds: 10,
    memorySeconds: 600,
    memoryInterval: null,
    roundTimeout: null,
    aiTimeout: null,
    locked: false,
    roundToken: 0,
    pendingSend: null, // { from:"player"|"ai", to:"player"|"ai" } 需要送牌時用
  };

  function applyBoardLayout(hand) {
    // hand: 每方手牌數
    let cols = 5, rows = 4;

    if (hand === 9)  { cols = 3; rows = 3; }
    if (hand === 12) { cols = 3; rows = 4; }
    if (hand === 20) { cols = 5; rows = 4; } // 4*5 等價於 5 欄 4 列（更適合寬螢幕）

    state.baseFontSize = (hand === 9) ? 28 : (hand === 12) ? 22 : 20;

    aiBoardEl().style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    aiBoardEl().style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    playerBoardEl().style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    playerBoardEl().style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }

  function autoResizeText(cardEl) {
    const maxFont = state.baseFontSize || 28;
    const minFont = 10;   // 最小字體
    let fontSize = maxFont;

    cardEl.style.fontSize = fontSize + "px";

    // 只要超出高度或寬度，就一直縮小
    while (
      (cardEl.scrollHeight > cardEl.clientHeight ||
       cardEl.scrollWidth > cardEl.clientWidth) &&
      fontSize > minFont
    ) {
      fontSize--;
      cardEl.style.fontSize = fontSize + "px";
    }
  }

  // ===== Utils =====
  function shuffle(arr) {
    return arr
      .map(v => ({ v, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(x => x.v);
  }

  function removeById(arr, id) {
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) return arr.splice(idx, 1)[0];
    return null;
  }

  function inPlayer(id) { return state.playerCards.some(c => c.id === id); }
  function inAI(id) { return state.aiCards.some(c => c.id === id); }

  // ===== Render =====
  function renderBoards() {
    const aiB = aiBoardEl();
    const plB = playerBoardEl();
    aiB.innerHTML = "";
    plB.innerHTML = "";

    state.aiCards.forEach(card => {
      const div = document.createElement("div");
      div.className = "card aiCard";
      div.dataset.id = card.id;
      div.innerText = card.lower;
      div.onclick = () => onPlayerClick(card.id);
      aiB.appendChild(div);
      autoResizeText(div);
    });

    state.playerCards.forEach(card => {
      const div = document.createElement("div");
      div.className = "card";
      div.dataset.id = card.id;
      div.innerText = card.lower;

      div.onclick = () => onPlayerClick(card.id);

      // 如果玩家正在選「送哪張牌」
      if (state.pendingSend && state.pendingSend.from === "player") {
        div.style.border = "3px solid crimson";
      }

      plB.appendChild(div);
      autoResizeText(div);
    });

    if (window.updateStatusText) window.updateStatusText();

  }

  // ===== Timers =====
  function startMemoryTimer() {
    clearInterval(state.memoryInterval);
    const total = state.memorySeconds;

    state.memoryInterval = setInterval(() => {
      state.memorySeconds--;
      const min = Math.floor(state.memorySeconds / 60);
      const sec = state.memorySeconds % 60;

      if (state.memorySeconds >= 60) {
        memoryTextEl().innerText = `記憶時間 ${min}:${sec.toString().padStart(2, "0")}`;
      } else {
        memoryTextEl().innerText = `記憶時間 ${state.memorySeconds} 秒`;
      }

      memoryFillEl().style.width = (state.memorySeconds / total * 100) + "%";

      if (state.memorySeconds <= 0) {
        clearInterval(state.memoryInterval);
        startGame();
      }
    }, 1000);
  }

  function startRoundTimer(token) {
    const top = topTimerEl();
    const bottom = bottomTimerEl();

    top.style.transition = "none";
    bottom.style.transition = "none";
    top.style.width = "100%";
    bottom.style.width = "100%";

    setTimeout(() => {
      top.style.transition = state.roundSeconds + "s linear";
      bottom.style.transition = state.roundSeconds + "s linear";
      top.style.width = "0%";
      bottom.style.width = "0%";
    }, 50);

    clearTimeout(state.roundTimeout);
    state.roundTimeout = setTimeout(() => {
      if (token !== state.roundToken) return;
      if (state.pendingSend) return; // 等玩家送牌
      if (state.locked) return;
      nextRound();
    }, state.roundSeconds * 1000);
  }

  // ===== Round Flow =====
  function nextRound() {
    if (checkWin()) return;

    state.locked = false;
    state.roundToken++;
    const token = state.roundToken;

    // 題目池：全庫（含空札）
    const pool = (state.emptyPool.length === 0) ? [...state.inPlay] : [...state.inPlay, ...state.emptyPool];

    state.currentPair = pool[Math.floor(Math.random() * pool.length)];

    // 判斷本回合是否空札：該 pair 的 lower 是否在場上
    const onBoard = inPlayer(state.currentPair.id) || inAI(state.currentPair.id);
    state.isEmpty = !onBoard;

    upperTextEl().innerText = state.currentPair.upper;

    startRoundTimer(token);
    scheduleCpuMove(token);
  }

  // ===== CPU Move =====
  function moveAiCursorToCard(cardId) {
    const aiB = aiBoardEl();
    const plB = playerBoardEl();
    const all = [...aiB.querySelectorAll(".card"), ...plB.querySelectorAll(".card")];
    const target = all.find(x => parseInt(x.dataset.id) === cardId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const gRect = gameEl().getBoundingClientRect();

    aiCursorEl().style.left = (rect.left - gRect.left + rect.width / 2) + "px";
    aiCursorEl().style.top = (rect.top - gRect.top + rect.height / 2) + "px";
  }

  function scheduleCpuMove(token) {
    clearTimeout(state.aiTimeout);

    // 若正在等玩家送牌，CPU 不出手
    if (state.pendingSend) return;

    const board = {
      aiIds: state.aiCards.map(c => c.id),
      playerIds: state.playerCards.map(c => c.id),
      allIds: [...state.aiCards, ...state.playerCards].map(c => c.id),
    };

    const round = {
      isEmpty: state.isEmpty,
      correctId: state.currentPair.id,
    };

    const decision = CPU.decideMove(round, board);
    if (!decision.willAct) return;

    state.aiTimeout = setTimeout(() => {
      if (token !== state.roundToken) return;
      if (state.locked) return;
      if (state.pendingSend) return;

      if (decision.targetId != null) {
        moveAiCursorToCard(decision.targetId);
        onAiClick(decision.targetId);
      }
    }, decision.delayMs);
  }

  // ===== Click Handlers =====
  function onPlayerClick(cardId) {
    // 玩家選送牌
    if (state.pendingSend && state.pendingSend.from === "player") {
      // 只能送自己的牌
      const card = removeById(state.playerCards, cardId);
      if (!card) return;

      state.aiCards.push(card);
      state.pendingSend = null;
      renderBoards();
      setTimeout(nextRound, 300);
      return;
    }

    if (state.locked) return;
    if (state.pendingSend) return;

    state.locked = true;
    clearTimeout(state.roundTimeout);

    resolveHit("player", cardId);
  }

  function onAiClick(cardId) {
    if (state.locked) return;
    if (state.pendingSend) return;

    state.locked = true;
    clearTimeout(state.roundTimeout);

    resolveHit("ai", cardId);
  }

  // ===== Rule Resolution =====
  function getSideOfCard(id) {
    if (state.playerCards.some(c => c.id === id)) return "player";
    if (state.aiCards.some(c => c.id === id)) return "ai";
    return null; // 不在場上（例如點到不存在的 id）
  }

  function resolveHit(actor, clickedId) {
    const correctId = state.currentPair.id;

    const clickedSide = getSideOfCard(clickedId); // "player"/"ai"/null
    const correctSide = state.isEmpty ? null : getSideOfCard(correctId);

    // 防呆：點到不存在的牌（理論上不會發生）
    if (!clickedSide) {
      // 當作空拍（視為錯誤，但沒有牌可歸屬）
      // 這裡採用「點自己區錯誤」的送牌邏輯其實也不合理，所以直接下一回合
      renderBoards();
      setTimeout(nextRound, 300);
      return;
    }

    const isCorrect = (!state.isEmpty) && (Number(clickedId) === Number(correctId));

    // ========= 正確 =========
    if (isCorrect) {
      // 拍到的正確牌消失（從所在區域移除）
      if (correctSide === "player") removeById(state.playerCards, correctId);
      if (correctSide === "ai") removeById(state.aiCards, correctId);
      removeById(state.inPlay, correctId);

      // 玩家拍電腦區（正確）：玩家送電腦一張
      if (actor === "player" && correctSide === "ai") {
        triggerSend("player", "ai"); // 玩家選
        return;
      }

      // 電腦拍玩家區（正確）：電腦送玩家一張
      if (actor === "ai" && correctSide === "player") {
        triggerSend("ai", "player"); // AI 隨機
        return;
      }

      // 其餘：不送牌，進下一回合
      renderBoards();
      setTimeout(nextRound, 400);
      return;
    }

    // ========= 錯誤 or 空札 =========
    // 你的規則要看「點到哪一邊」：點自己區 vs 點對方區

    // (5) 玩家拍自己區（錯誤） => 電腦送玩家一張
    if (actor === "player" && clickedSide === "player") {
      triggerSend("ai", "player");
      return;
    }

    // (6) 玩家拍電腦區（錯誤） => 點到的牌變成玩家的（搬牌）
    if (actor === "player" && clickedSide === "ai") {
      const card = removeById(state.aiCards, clickedId);
      if (card) state.playerCards.push(card);
      renderBoards();
      setTimeout(nextRound, 400);
      return;
    }

    // (7) 電腦拍自己區（錯誤） => 玩家送電腦一張
    if (actor === "ai" && clickedSide === "ai") {
      triggerSend("player", "ai");
      return;
    }

    // (8) 電腦拍玩家區（錯誤） => 點到的牌變成電腦的（搬牌）
    if (actor === "ai" && clickedSide === "player") {
      const card = removeById(state.playerCards, clickedId);
      if (card) state.aiCards.push(card);
      renderBoards();
      setTimeout(nextRound, 400);
      return;
    }

    // 理論上不會走到這裡
    renderBoards();
    setTimeout(nextRound, 300);
  }

  function triggerSend(from, to) {
    // from: 送牌者, to: 收牌者
    state.pendingSend = { from, to };

    if (from === "ai" && to === "player") {
      // CPU 隨機送一張
      const id = CPU.pickSendCardId(state.aiCards);
      if (id == null) {
        state.pendingSend = null;
        renderBoards();
        setTimeout(nextRound, 300);
        return;
      }
      const card = removeById(state.aiCards, id);
      state.playerCards.push(card);
      state.pendingSend = null;

      renderBoards();
      setTimeout(nextRound, 400);
      return;
    }

    if (from === "player" && to === "ai") {
      // 玩家選送牌：畫面提示 + 高亮
      upperTextEl().innerText = "你需要送一張牌給電腦（請點選你的一張牌）";
      renderBoards();
      // 等玩家點擊完成送牌
      return;
    }
  }

  // ===== Win =====
  function checkWin() {
    if (state.playerCards.length === 0) {
      alert("你贏了！");
      return true;
    }
    if (state.aiCards.length === 0) {
      alert("電腦贏了！");
      return true;
    }
    return false;
  }

  // ===== Public API =====
  function init(config) {
    // config: { data, memorySeconds, roundSeconds, hand, empty, emptyMode }
    state.allPairs = config.data;
    state.memorySeconds = config.memorySeconds ?? 600;
    state.roundSeconds = config.roundSeconds ?? 5;

    const hand = config.hand ?? 20;           // 每方幾張
    const empty = config.empty ?? 0;          // 空札數
    const emptyMode = config.emptyMode ?? "all"; // none | fixed | all

    // 需要用的總牌量：兩邊手牌*2 + (fixed空札)
    const needInPlay = hand * 2;

    // 先洗牌
    const shuffled = shuffle([...state.allPairs]);

    // 先抽場上牌
    state.inPlay = shuffled.slice(0, needInPlay);

    // 空札池決定方式
    if (emptyMode === "none") {
      state.emptyPool = []; // 不用空札
    } else if (emptyMode === "fixed") {
      // 固定空札數：從剩餘資料抽 empty 張
      state.emptyPool = shuffled.slice(needInPlay, needInPlay + empty);
    } else if (emptyMode === "all") {
      // 不限制：剩下全部都算空札池
      state.emptyPool = shuffled.slice(needInPlay);
    } else {
      // 防呆：未知模式 → 當 all
      state.emptyPool = shuffled.slice(needInPlay);
    }

    // 分配手牌
    state.aiCards = state.inPlay.slice(0, hand);
    state.playerCards = state.inPlay.slice(hand, hand * 2);

    // 套用棋盤布局
    applyBoardLayout(hand);

    // 渲染初始盤面
    renderBoards();

    // 記憶畫面
    memoryScreenEl().style.display = "flex";
    memoryFillEl().style.width = "100%";
    startMemoryTimer();

    // 初始上句空白
    upperTextEl().innerText = "";

    // 讓外部 UI 看到目前設定（可選）
    if (window.updateStatusText) window.updateStatusText();
  }

  function startGame() {
    clearInterval(state.memoryInterval);
    memoryScreenEl().style.display = "none";
    nextRound();
  }

  window.Game = { init, startGame };

  window.GameDebug = {
    playerCount: () => state.playerCards.length,
    aiCount: () => state.aiCards.length,
    emptyCount: () => state.emptyPool.length,
  }

})();
