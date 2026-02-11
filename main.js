(function () {
  // === 遊戲模式（牌數/空札規則） ===
  const DIFFICULTY_PRESETS = {
    newbie:  { name: "新手版", hand: 9,  empty: 0,        emptyMode: "none"  },
    intro:   { name: "入門版", hand: 12, empty: 0,        emptyMode: "none"  },

    normal:  { name: "普通版", hand: 9,  empty: 9,        emptyMode: "fixed" },
    hard:    { name: "困難版", hand: 12, empty: 12,       emptyMode: "fixed" },
    extreme: { name: "極難版", hand: 20, empty: 20,       emptyMode: "fixed" },

    expert:  { name: "專家版", hand: 20, empty: Infinity, emptyMode: "all"   },
    region:  { name: "地獄版", hand: 20, empty: Infinity, emptyMode: "all"   },
  };

  // === 模式 → CPU 反應難度（只影響 CPU 的 delay/命中率等） ===
  // 你之後要怎麼配都可以，先給一個合理預設
  const MODE_TO_CPU_LEVEL = {
    newbie:  "easy",
    intro:   "easy",
    normal:  "easy",
    hard:    "easy",
    extreme: "easy",
    expert:  "normal",
    region:  "hard",
  };

  // === 1) 建立難度下拉 ===
  const sel = document.getElementById("difficultySelect");
  const restartBtn = document.getElementById("restartBtn");
  const statusText = document.getElementById("statusText");

  function fillDifficultyOptions() {
    sel.innerHTML = "";
    for (const key of Object.keys(DIFFICULTY_PRESETS)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = DIFFICULTY_PRESETS[key].name;
      sel.appendChild(opt);
    }
    sel.value = "newbie"; // 預設
  }

  // === 2) 狀態列 ===
  window.updateStatusText = function () {
    const preset = DIFFICULTY_PRESETS[sel.value];
    if (!preset) return;

    const emptyLabel =
      preset.emptyMode === "none"  ? "無空札" :
      preset.emptyMode === "fixed" ? `空札 ${preset.empty} 張` :
      "空札：全部";

    // CPU 等級顯示（方便你驗證真的有切到）
    const cpuLevel = MODE_TO_CPU_LEVEL[sel.value] || "easy";

    const pCount = window.GameDebug ? GameDebug.playerCount() : "?";
    const aCount = window.GameDebug ? GameDebug.aiCount() : "?";
    const eCount = window.GameDebug ? GameDebug.emptyCount() : "?";

    statusText.textContent =
      `${preset.name}｜玩家/電腦：${preset.hand}張｜${emptyLabel}｜空札池:${eCount}｜CPU:${cpuLevel}｜目前：玩家${pCount} 電腦${aCount}`;
  };

  // === 3) 啟動/重開 ===
  function startWithPreset() {
    const presetKey = sel.value;
    const preset = DIFFICULTY_PRESETS[presetKey];
    if (!preset) return;

    // 先切 CPU 難度（這才會讓你感覺不再都像 easy）
    const cpuLevel = MODE_TO_CPU_LEVEL[presetKey] || "easy";
    CPU.setDifficulty(cpuLevel);

    // 再初始化遊戲
    Game.init({
      data: window.PSALM_1_7,
      memorySeconds: 600,
      roundSeconds: 5,
      hand: preset.hand,
      empty: preset.empty,
      emptyMode: preset.emptyMode,
    });

    // 初始化後更新狀態列
    if (window.updateStatusText) window.updateStatusText();
  }

  fillDifficultyOptions();
  startWithPreset();

  sel.addEventListener("change", startWithPreset);
  restartBtn.addEventListener("click", startWithPreset);

  // 讓 HTML 按鈕可用（如果你還在用 onclick="startGame()"）
  window.startGame = Game.startGame;
})();
