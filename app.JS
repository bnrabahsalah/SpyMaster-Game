(() => {
  // =========================================================
  // CONFIG
  // =========================================================
  const DEFAULT_WORDS = [
    "KNIFE","KIWI","SPRING","CRANE","LITTER",
    "RULER","LOCK","TOWEL","DICE","GLOVE",
    "BLOCK","PENCIL","BAR","GREECE","WATER",
    "PIPE","LAWYER","CIRCLE","CAP","GIANT",
    "CHECK","BOND","TURKEY","STRING","MISSILE",
    "MERCURY","MOON","SNOW","COPPER","TOOTH",
    "JAGUAR","ROBOT","PIRATE","CLOWN","NINJA",
    "HOSPITAL","CEMENT","BOOK","FIRE","BEACH",
    "ARROW","STATION","COBRA","ROSE","VIOLET",
    "VAMPIRE","BUTTON","WATCH","TOWER","SAND",
    "BAMBOO","PLANE","MACHINE","SCHOOL","BOAT",
    "APPLE","RADIO","PIANO","CABLE","ENGINE"
  ];

  const AVATARS = ["😎","🦊","🐺","🐼","🐯","🦁","🦉","🦅","🐸","🐙","🤖","👽","🧠","⚡","🔥","🌙","⭐","🍀","🎮","🎯"];

  // =========================================================
  // DOM
  // =========================================================
  const $ = (id) => document.getElementById(id);

  const el = {
    center: $("center"),
    board: $("board"),
    titleText: $("titleText"),

    meRole: $("meRole"),
    connStatus: $("connStatus"),
    hostStatus: $("hostStatus"),

    redCount: $("redCount"),
    blueCount: $("blueCount"),
    redPlayers: $("redPlayers"),
    bluePlayers: $("bluePlayers"),

    joinBlueOps: $("joinBlueOps"),
    joinBlueSpy: $("joinBlueSpy"),
    joinRedOps: $("joinRedOps"),
    joinRedSpy: $("joinRedSpy"),
    joinWordMaster: $("joinWordMaster"),

    clueWordBlue: $("clueWord"),
    clueNumBlue: $("clueNum"),
    btnSetClueBlue: $("btnSetClueBlue"),

    clueWordRed: $("clueWordRed"),
    clueNumRed: $("clueNumRed"),
    btnSetClueRed: $("btnSetClueRed"),

    btnEndTurn: $("btnEndTurn"),
    btnNewGame: $("btnNewGame"),
    turnHint: $("turnHint"),

    btnAdmin: $("btnAdmin"),
    btnResetConn: $("btnResetConn"),

    tabLocal: $("tabLocal"),
    tabWs: $("tabWs"),
    localBox: $("localBox"),
    wsBox: $("wsBox"),

    roomCode: $("roomCode"),
    btnConnectLocal: $("btnConnectLocal"),
    btnDisconnect: $("btnDisconnect"),
    btnDisconnect2: $("btnDisconnect2"),

    wsUrl: $("wsUrl"),
    wsRoom: $("wsRoom"),
    btnConnectWs: $("btnConnectWs"),

    btnOpenWords: $("btnOpenWords"),
    wmBox: $("wmBox"),
    wmWords: $("wmWords"),
    btnPick25: $("btnPick25"),
    btnUseSelected: $("btnUseSelected"),
    wmInfo: $("wmInfo"),
    pickGrid: $("pickGrid"),

    clueOverlay: $("clueOverlay"),
    clueOverlayTeam: $("clueOverlayTeam"),
    clueOverlayText: $("clueOverlayText"),

    clueBadge: $("clueBadge"),
    clueBadgeTeam: $("clueBadgeTeam"),
    clueBadgeText: $("clueBadgeText"),

    // profile modal
    profileModal: $("profileModal"),
    avatarGrid: $("avatarGrid"),
    playerName: $("playerName"),
    profileError: $("profileError"),
    btnEnterGame: $("btnEnterGame"),
  };

  // =========================================================
  // STATE
  // =========================================================
  const state = {
    game: {
      startTeam: "red",
      activeTeam: "red",
      clue: null,
      guessesLeft: 0,
      gameOver: false,
      cards: [],
      _clueFlashToken: null,
      _winner: null
    },
    players: {},
    me: {
      id: makeId(),
      name: null,
      avatar: null,
      team: null,
      role: null,
    },
    wordmaster: {
      customWords: [],
      selected25: [],
    },
    conn: {
      mode: "none", // "none" | "local" | "ws"
      room: null,
      host: true,
      transport: null
    }
  };

  // =========================================================
  // UTILS
  // =========================================================
  function show(x){ if(x) x.classList.remove("hide"); }
  function hide(x){ if(x) x.classList.add("hide"); }

  function makeId(){
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function rolesForStart(startTeam){
    const redCount = startTeam === "red" ? 9 : 8;
    const blueCount = startTeam === "blue" ? 9 : 8;
    const roles = [
      ...Array(redCount).fill("red"),
      ...Array(blueCount).fill("blue"),
      ...Array(7).fill("neutral"),
      "assassin"
    ];
    return shuffle(roles);
  }

  function computeRemaining(){
    let red=0, blue=0;
    for(const c of state.game.cards){
      if(!c.revealed){
        if(c.role === "red") red++;
        if(c.role === "blue") blue++;
      }
    }
    return { red, blue };
  }

  function connected(){
    return state.conn.mode !== "none" && !!state.conn.transport;
  }

  function randomRoomCode(n=4){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for(let i=0;i<n;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  function resetMeForNewSession(){
    state.me.name = null;
    state.me.avatar = null;
    state.me.team = null;
    state.me.role = null;
  }

  // =========================================================
  // START MENU MODAL (created dynamically)
  // =========================================================
  let startMenuEl = null;

  function openStartMenu(){
    if(startMenuEl) startMenuEl.remove();

    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "startMenuModal";

    const card = document.createElement("div");
    card.className = "modalCard";
    card.style.textAlign = "left";

    card.innerHTML = `
      <div class="modalTitle" style="text-align:center;">SpyMaster Game</div>
      <div class="modalSub" style="text-align:center;margin-bottom:10px;">
        Créer une partie (code auto) ou rejoindre avec un code.
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btnPrimary" id="btnStartNewGame">NEW GAME (créer code)</button>

        <div style="display:flex;gap:10px;align-items:center;">
          <input class="input" id="joinCodeInput" maxlength="8" placeholder="CODE (ex: ABCD)" style="margin-top:0;flex:1;">
          <button class="btnSmall" id="btnJoinByCode" style="height:44px;">JOIN</button>
        </div>

        <div class="smallNote" id="startMenuError"></div>

        <div style="opacity:.75;font-size:12px;line-height:1.3;margin-top:6px;">
          Mode local : ouvre plusieurs onglets et utilise le même code.
        </div>
      </div>
    `;

    wrap.appendChild(card);
    document.body.appendChild(wrap);
    startMenuEl = wrap;

    const setErr = (m) => {
      const e = document.getElementById("startMenuError");
      if(e) e.textContent = m || "";
    };

    document.getElementById("btnStartNewGame")?.addEventListener("click", (e) => {
      e.preventDefault();
      setErr("");
      enterRoomAsHost(randomRoomCode(4));
    });

    document.getElementById("btnJoinByCode")?.addEventListener("click", (e) => {
      e.preventDefault();
      const code = (document.getElementById("joinCodeInput")?.value || "").trim().toUpperCase();
      if(!code) return setErr("Entre un code.");
      setErr("");
      enterRoomAsClient(code);
    });

    document.getElementById("joinCodeInput")?.addEventListener("keydown", (e) => {
      if(e.key === "Enter") document.getElementById("btnJoinByCode")?.click();
    });
  }

  function closeStartMenu(){
    if(startMenuEl) startMenuEl.remove();
    startMenuEl = null;
  }

  // =========================================================
  // PROFILE MODAL (2 steps) - NOT saved
  // =========================================================
  let profileStep = 1;
  let chosenName = "";
  let chosenAvatar = "";

  function buildAvatarButtons(){
    if(!el.avatarGrid) return;
    el.avatarGrid.innerHTML = "";
    AVATARS.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "avatarBtn";
      b.textContent = a;
      b.addEventListener("click", () => {
        chosenAvatar = a;
        Array.from(el.avatarGrid.querySelectorAll(".avatarBtn")).forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
        if(el.profileError) el.profileError.textContent = "";
      });
      el.avatarGrid.appendChild(b);
    });
  }

  function setProfileStep(step){
    profileStep = step;
    if(el.profileError) el.profileError.textContent = "";

    if(step === 1){
      if(el.avatarGrid) el.avatarGrid.style.display = "none";
      if(el.playerName){
        el.playerName.disabled = false;
        el.playerName.value = "";
        el.playerName.focus();
      }
      if(el.btnEnterGame) el.btnEnterGame.textContent = "Suivant";
      return;
    }

    if(el.avatarGrid) el.avatarGrid.style.display = "";
    if(el.playerName) el.playerName.disabled = true;
    if(el.btnEnterGame) el.btnEnterGame.textContent = "Entrer";
  }

  function openProfile(){
    buildAvatarButtons();
    chosenName = "";
    chosenAvatar = "";
    if(el.profileModal){
      el.profileModal.setAttribute("aria-hidden","false");
      show(el.profileModal);
    }
    setProfileStep(1);
  }

  function closeProfile(){
    if(el.profileModal){
      el.profileModal.setAttribute("aria-hidden","true");
      hide(el.profileModal);
    }
    setProfileStep(1);
  }

  function validateName(v){
    const name = (v || "").trim();
    if(!name) return null;
    if(name.length > 16) return null;
    return name;
  }

  function onProfileConfirm(){
    if(profileStep === 1){
      const name = validateName(el.playerName?.value);
      if(!name){
        if(el.profileError) el.profileError.textContent = "Entre un pseudo (1 à 16 caractères).";
        return;
      }
      chosenName = name;
      setProfileStep(2);
      return;
    }

    if(!chosenAvatar){
      if(el.profileError) el.profileError.textContent = "Choisis un avatar.";
      return;
    }

    state.me.name = chosenName;
    state.me.avatar = chosenAvatar;

    // announce
    applyActionAsHost({ kind:"HELLO", id: state.me.id, name: state.me.name, avatar: state.me.avatar });
    sendHello();
    renderAll();

    closeProfile();
  }

  // =========================================================
  // TRANSPORT (LOCAL)
  // =========================================================
  function makeLocalTransport(room){
    const bc = new BroadcastChannel("spymaster_room_" + room);
    return {
      close: () => bc.close(),
      send: (obj) => bc.postMessage(obj),
      onMessage: (fn) => { bc.onmessage = (ev) => fn(ev.data); }
    };
  }

  function setConnStatus(text){ if(el.connStatus) el.connStatus.textContent = text; }
  function setHostStatus(){
    if(!el.hostStatus) return;
    el.hostStatus.textContent = (state.conn.mode === "none") ? "—" : (state.conn.host ? "HOST" : "CLIENT");
  }

  function makeSnapshot(){
    return { game: state.game, players: state.players };
  }

  function applySnapshot(snap){
    if(!snap) return;
    state.game = snap.game;
    state.players = snap.players || state.players;
    renderAll();
  }

  function broadcastStateLocal(){
    if(!connected() || state.conn.mode !== "local" || !state.conn.host) return;
    state.conn.transport.send({
      t:"STATE",
      room: state.conn.room,
      from: state.me.id,
      snapshot: makeSnapshot()
    });
  }

  function requestStateLocal(){
    if(!connected() || state.conn.mode !== "local") return;
    state.conn.transport.send({ t:"REQ_STATE", room: state.conn.room, from: state.me.id });
  }

  function sendAction(action){
    if(!connected()){
      state.conn.host = true;
      applyActionAsHost(action);
      renderAll();
      return;
    }

    if(state.conn.mode === "local"){
      if(state.conn.host){
        applyActionAsHost(action);
        broadcastStateLocal();
      } else {
        state.conn.transport.send({ t:"ACTION", room: state.conn.room, from: state.me.id, action });
      }
    }
  }

  // =========================================================
  // ROLES - 1 per role max
  // =========================================================
  function isRoleTakenGlobal(role){
    return Object.values(state.players).some(p => p.role === role);
  }

  function isRoleTakenInTeam(team, role){
    return Object.values(state.players).some(p => p.role === role && p.team === team);
  }

  function hasSpy(team){
    return Object.values(state.players).some(p => p.role === "spy" && p.team === team);
  }

  function roleLabel(p){
    if(!p || !p.role) return "Spectator";
    if(p.role === "wordmaster") return "WORD MASTER";
    return `${(p.team||"").toUpperCase()} ${p.role === "spy" ? "SPYMASTER" : "OPERATIVE"}`.trim();
  }

  // =========================================================
  // HOST ACTIONS
  // =========================================================
  function applyActionAsHost(action){
    if(!action || !action.kind) return;

    switch(action.kind){
      case "HELLO": {
        const { id, name, avatar } = action;
        if(!state.players[id]) state.players[id] = { name, avatar, team:null, role:null };
        state.players[id].name = name;
        state.players[id].avatar = avatar;
        break;
      }

      case "JOIN_ROLE": {
        const { id, name, avatar, team, role } = action;

        if(!state.players[id]) state.players[id] = { name, avatar, team:null, role:null };
        state.players[id].name = name;
        state.players[id].avatar = avatar;

        // ✅ Unicité stricte :
        // - wordmaster : 1 total
        // - spy : 1 par équipe
        // - ops : 1 par équipe
        if(role === "wordmaster"){
          const exists = Object.entries(state.players).some(([pid,p]) => p.role==="wordmaster" && pid !== id);
          if(exists) return;
        }

        if((role === "spy" || role === "ops") && (team === "red" || team === "blue")){
          const existsTeamRole = Object.entries(state.players).some(([pid,p]) =>
            p.role === role && p.team === team && pid !== id
          );
          if(existsTeamRole) return;
        }

        state.players[id].team = team || null;
        state.players[id].role = role || null;
        break;
      }

      case "NEW_GAME": {
        hostNewGame({ words25: null });
        break;
      }

      case "SET_CLUE": {
        const { fromId, clue } = action;
        const p = state.players[fromId];
        if(!p || p.role !== "spy" || p.team !== state.game.activeTeam) return;
        if(!clue || !clue.word || !Number.isFinite(Number(clue.num))) return;

        // improvement: can't overwrite clue
        if(state.game.clue) return;

        const word = String(clue.word).toUpperCase().trim();
        const num = Number(clue.num);

        state.game.clue = { word, num, byTeam: p.team };
        state.game.guessesLeft = (num === 0) ? 0 : (num + 1);
        state.game._clueFlashToken = makeId();
        break;
      }

      case "END_TURN": {
        const { fromId } = action;
        const p = state.players[fromId];
        if(!p || p.team !== state.game.activeTeam) return;
        hostEndTurn();
        break;
      }

      case "REVEAL": {
        const { fromId, index } = action;
        const p = state.players[fromId];

        if(state.game.gameOver) return;
        if(!p || p.role !== "ops" || p.team !== state.game.activeTeam) return;

        // improvement: must have clue to guess
        if(!state.game.clue) return;

        hostReveal(index);
        break;
      }

      default:
        break;
    }
  }

  function hostNewGame({ words25 }){
    state.game.gameOver = false;
    state.game.clue = null;
    state.game.guessesLeft = 0;
    state.game.activeTeam = state.game.startTeam;

    const roles = rolesForStart(state.game.startTeam);

    let words = Array.isArray(words25) && words25.length === 25
      ? words25.map(w => String(w).toUpperCase())
      : shuffle(DEFAULT_WORDS).slice(0,25);

    words = shuffle(words);

    state.game.cards = words.map((w,i) => ({
      word: w,
      role: roles[i],      // red|blue|neutral|assassin
      revealed: false,
      blank: false         // used for neutral -> white
    }));

    state.game._clueFlashToken = null;
    state.game._winner = null;
  }

  function hostEndTurn(){
    if(state.game.gameOver) return;
    state.game.activeTeam = (state.game.activeTeam === "red") ? "blue" : "red";
    state.game.clue = null;
    state.game.guessesLeft = 0;
  }

  // ✅ RULES: opponent colors show normally; neutral becomes white
  function hostReveal(index){
    const c = state.game.cards[index];
    if(!c || c.revealed || state.game.gameOver) return;

    c.revealed = true;
    c.blank = (c.role === "neutral"); // neutral => white

    if(c.role === "assassin"){
      state.game.gameOver = true;
      state.game._winner = (state.game.activeTeam === "red") ? "BLUE" : "RED";
      return;
    }

    if(state.game.clue && state.game.guessesLeft > 0){
      state.game.guessesLeft--;
    }

    const rem = computeRemaining();
    if(rem.red === 0){ state.game.gameOver = true; state.game._winner = "RED"; return; }
    if(rem.blue === 0){ state.game.gameOver = true; state.game._winner = "BLUE"; return; }

    if(state.game.clue && state.game.guessesLeft <= 0){
      hostEndTurn();
    }
  }

  // =========================================================
  // RENDER
  // =========================================================
  function playersText(team){
    const lines = [];
    for(const p of Object.values(state.players)){
      if(p.team !== team) continue;
      if(p.role === "spy") lines.push(`SPY: ${p.avatar||"🙂"} ${p.name}`);
      if(p.role === "ops") lines.push(`OPS: ${p.avatar||"🙂"} ${p.name}`);
      if(p.role === "wordmaster") lines.push(`WM: ${p.avatar||"🙂"} ${p.name}`);
    }
    return lines.length ? lines.join("\n") : "No players";
  }

  let lastClueFlashToken = null;
  let overlayTimer = null;

  function showClueOverlayFor3s(){
    if(!el.clueOverlay || !el.clueOverlayTeam || !el.clueOverlayText) return;

    const team = (state.game.clue?.byTeam || state.game.activeTeam || "").toUpperCase();
    const word = state.game.clue?.word || "—";
    const num = state.game.clue?.num ?? "—";

    el.clueOverlayTeam.textContent = `${team} CLUE`;
    el.clueOverlayText.textContent = `${word} ${num}`;

    show(el.clueOverlay);
    if(overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => hide(el.clueOverlay), 3000);
  }

  function renderClueBadge(){
    if(!el.clueBadge || !el.clueBadgeTeam || !el.clueBadgeText) return;

    if(!state.game.clue){
      hide(el.clueBadge);
      el.clueBadgeTeam.textContent = "—";
      el.clueBadgeText.textContent = "CLUE: —";
      return;
    }

    const team = (state.game.clue?.byTeam || state.game.activeTeam || "").toUpperCase();
    el.clueBadgeTeam.textContent = team;
    el.clueBadgeText.textContent = `CLUE: ${state.game.clue.word} ${state.game.clue.num}`;
    show(el.clueBadge);
  }

  // ✅ board ALWAYS shows if cards exist
  function renderBoard(){
    if(!el.board) return;
    el.board.innerHTML = "";

    state.game.cards.forEach((c, idx) => {
      const div = document.createElement("div");
      div.className = "card";

      if(c.revealed){
        if(c.role === "neutral" || c.blank){
          div.classList.add("revealed","blank"); // white
        } else {
          div.classList.add("revealed", c.role); // red/blue/assassin
        }
      } else {
        if(state.me.role === "spy"){
          div.classList.add(c.role);
        }
      }

      div.innerHTML = `<span class="w">${escapeHtml(c.word)}</span>`;
      div.onclick = () => onCardClick(idx);
      el.board.appendChild(div);
    });
  }

  function renderAll(){
    // ✅ Guarantee a board exists
    if(!Array.isArray(state.game.cards) || state.game.cards.length !== 25){
      hostNewGame({ words25: null });
      if(state.conn.mode === "local" && state.conn.host) broadcastStateLocal();
    }

    if(el.center){
      if(state.me.role === "spy") el.center.classList.add("spymaster-view");
      else el.center.classList.remove("spymaster-view");
    }

    const active = state.game.activeTeam;
    const needSpy = (active === "red" && !hasSpy("red")) || (active === "blue" && !hasSpy("blue"));
    const teamName = active.toUpperCase();

    if(el.titleText){
      el.titleText.textContent = state.game.gameOver
        ? `${(state.game._winner || "—")} WINS`
        : (needSpy ? `${teamName} TEAM NEEDS A SPYMASTER` : `${teamName} TEAM TURN`);
    }

    const rem = computeRemaining();
    if(el.redCount) el.redCount.textContent = rem.red;
    if(el.blueCount) el.blueCount.textContent = rem.blue;

    if(el.redPlayers) el.redPlayers.textContent = playersText("red");
    if(el.bluePlayers) el.bluePlayers.textContent = playersText("blue");

    const meP = { name: state.me.name, avatar: state.me.avatar, team: state.me.team, role: state.me.role };
    if(el.meRole) el.meRole.textContent = `You: ${roleLabel(meP)} — ${state.me.avatar || "🙂"} ${state.me.name || "?"}`;

    if(state.conn.mode === "none") setConnStatus("Offline");
    else setConnStatus(`${state.conn.mode.toUpperCase()} · Room ${state.conn.room}`);
    setHostStatus();

    if(el.turnHint){
      if(state.game.gameOver){
        el.turnHint.textContent = `Game Over · Winner: ${state.game._winner || "—"}`;
      } else {
        const g = state.game.clue ? ` · guesses left: ${state.game.guessesLeft}` : "";
        el.turnHint.textContent = `Active: ${state.game.activeTeam.toUpperCase()}${g}`;
      }
    }

    // ✅ Disable JOIN buttons if role already taken (1 max per role)
    if(el.joinBlueOps) el.joinBlueOps.disabled = isRoleTakenInTeam("blue","ops") && !(state.me.team==="blue" && state.me.role==="ops");
    if(el.joinBlueSpy) el.joinBlueSpy.disabled = isRoleTakenInTeam("blue","spy") && !(state.me.team==="blue" && state.me.role==="spy");
    if(el.joinRedOps) el.joinRedOps.disabled = isRoleTakenInTeam("red","ops") && !(state.me.team==="red" && state.me.role==="ops");
    if(el.joinRedSpy) el.joinRedSpy.disabled = isRoleTakenInTeam("red","spy") && !(state.me.team==="red" && state.me.role==="spy");
    if(el.joinWordMaster) el.joinWordMaster.disabled = isRoleTakenGlobal("wordmaster") && state.me.role !== "wordmaster";

    // clue input enable only for active spymaster and no clue set
    const canSetClue =
      !state.game.gameOver &&
      state.me.role === "spy" &&
      state.me.team === state.game.activeTeam &&
      !state.game.clue;

    if(el.btnSetClueBlue) el.btnSetClueBlue.disabled = !canSetClue || state.me.team !== "blue";
    if(el.clueWordBlue) el.clueWordBlue.disabled = !canSetClue || state.me.team !== "blue";
    if(el.clueNumBlue) el.clueNumBlue.disabled = !canSetClue || state.me.team !== "blue";

    if(el.btnSetClueRed) el.btnSetClueRed.disabled = !canSetClue || state.me.team !== "red";
    if(el.clueWordRed) el.clueWordRed.disabled = !canSetClue || state.me.team !== "red";
    if(el.clueNumRed) el.clueNumRed.disabled = !canSetClue || state.me.team !== "red";

    const canEnd =
      !state.game.gameOver &&
      state.me.team === state.game.activeTeam &&
      (state.me.role === "spy" || state.me.role === "ops");
    if(el.btnEndTurn) el.btnEndTurn.disabled = !canEnd;

    if(el.btnNewGame) el.btnNewGame.disabled = connected() && !state.conn.host;

    renderClueBadge();
    renderBoard();

    const token = state.game._clueFlashToken || null;
    if(token && token !== lastClueFlashToken){
      lastClueFlashToken = token;
      showClueOverlayFor3s();
    }
  }

  // =========================================================
  // GAME INPUT
  // =========================================================
  function ensureProfileBeforePlay(){
    if(state.me.name && state.me.avatar) return true;
    openProfile();
    return false;
  }

  function join(team, role){
    if(!ensureProfileBeforePlay()) return;

    state.me.team = team;
    state.me.role = role;

    sendAction({
      kind: "JOIN_ROLE",
      id: state.me.id,
      name: state.me.name,
      avatar: state.me.avatar,
      team,
      role
    });

    renderAll();
  }

  function onCardClick(idx){
    if(state.game.gameOver) return;
    if(!(state.me.role === "ops" && state.me.team === state.game.activeTeam)) return;

    sendAction({ kind:"REVEAL", fromId: state.me.id, index: idx });
  }

  // =========================================================
  // CONNECT LOCAL
  // =========================================================
  function disconnect(){
    if(state.conn.transport){
      try{ state.conn.transport.close(); }catch{}
    }
    state.conn.mode = "none";
    state.conn.room = null;
    state.conn.transport = null;
    state.conn.host = true;
    setConnStatus("Offline");
    setHostStatus();
    renderAll();
  }

  function connectLocalWithCode(code){
    disconnect();

    state.conn.mode = "local";
    state.conn.room = code;
    state.conn.transport = makeLocalTransport(code);
    state.conn.host = true;

    state.conn.transport.onMessage((msg) => {
      if(!msg || msg.room !== state.conn.room) return;

      if(msg.t === "STATE"){
        if(msg.from !== state.me.id){
          state.conn.host = false;
          applySnapshot(msg.snapshot);
        }
        renderAll();
        return;
      }

      if(msg.t === "REQ_STATE"){
        if(state.conn.host) broadcastStateLocal();
        return;
      }

      if(msg.t === "ACTION"){
        if(state.conn.host){
          applyActionAsHost(msg.action);
          broadcastStateLocal();
          renderAll();
        }
        return;
      }
    });

    setConnStatus(`LOCAL · Room ${code}`);
    setHostStatus();
    renderAll();

    sendHello();
    requestStateLocal();

    setTimeout(() => {
      if(state.conn.mode === "local" && state.conn.host){
        broadcastStateLocal();
      }
    }, 80);
  }

  function sendHello(){
    sendAction({
      kind:"HELLO",
      id: state.me.id,
      name: state.me.name || "?",
      avatar: state.me.avatar || "🙂"
    });
  }

  // =========================================================
  // ROOM FLOW
  // =========================================================
  function enterRoomAsHost(code){
    resetMeForNewSession();
    connectLocalWithCode(code);

    state.conn.host = true;
    hostNewGame({ words25: null });
    broadcastStateLocal();
    renderAll();

    closeStartMenu();
    openProfile();
  }

  function enterRoomAsClient(code){
    resetMeForNewSession();
    connectLocalWithCode(code);

    closeStartMenu();
    openProfile();
  }

  // =========================================================
  // UI WIRING
  // =========================================================
  function wireUI(){
    // profile modal
    el.btnEnterGame?.addEventListener("click", (e) => { e.preventDefault(); onProfileConfirm(); });
    el.playerName?.addEventListener("keydown", (e) => {
      if(e.key === "Enter" && profileStep === 1){
        e.preventDefault();
        onProfileConfirm();
      }
    });

    // join roles
    el.joinBlueOps && (el.joinBlueOps.onclick = () => join("blue","ops"));
    el.joinBlueSpy && (el.joinBlueSpy.onclick = () => join("blue","spy"));
    el.joinRedOps  && (el.joinRedOps.onclick  = () => join("red","ops"));
    el.joinRedSpy  && (el.joinRedSpy.onclick  = () => join("red","spy"));
    el.joinWordMaster && (el.joinWordMaster.onclick = () => join(null,"wordmaster"));

    // set clue blue
    el.btnSetClueBlue && (el.btnSetClueBlue.onclick = () => {
      if(state.game.gameOver) return;
      if(!(state.me.role==="spy" && state.me.team==="blue" && state.me.team===state.game.activeTeam)) return;
      if(state.game.clue) return;

      const word = (el.clueWordBlue?.value || "").trim();
      const num = Number(el.clueNumBlue?.value);

      if(!word) return alert("Enter a clue word.");
      if(!Number.isFinite(num) || num < 0 || num > 9) return alert("Invalid number (0-9).");

      sendAction({ kind:"SET_CLUE", fromId: state.me.id, clue:{ word, num } });
    });

    // set clue red
    el.btnSetClueRed && (el.btnSetClueRed.onclick = () => {
      if(state.game.gameOver) return;
      if(!(state.me.role==="spy" && state.me.team==="red" && state.me.team===state.game.activeTeam)) return;
      if(state.game.clue) return;

      const word = (el.clueWordRed?.value || "").trim();
      const num = Number(el.clueNumRed?.value);

      if(!word) return alert("Enter a clue word.");
      if(!Number.isFinite(num) || num < 0 || num > 9) return alert("Invalid number (0-9).");

      sendAction({ kind:"SET_CLUE", fromId: state.me.id, clue:{ word, num } });
    });

    // end turn
    el.btnEndTurn && (el.btnEndTurn.onclick = () => {
      if(state.game.gameOver) return;
      if(!(state.me.team === state.game.activeTeam && (state.me.role==="spy" || state.me.role==="ops"))) return;
      sendAction({ kind:"END_TURN", fromId: state.me.id });
    });

    // new game (host only if connected) => also reset profile (as you wanted)
    el.btnNewGame && (el.btnNewGame.onclick = () => {
      if(connected() && !state.conn.host) return;
      hostNewGame({ words25: null });
      if(state.conn.mode === "local" && state.conn.host) broadcastStateLocal();
      renderAll();

      resetMeForNewSession();
      openProfile();
    });

    // admin toggle start team
    el.btnAdmin && (el.btnAdmin.onclick = () => {
      if(connected() && !state.conn.host) return;
      state.game.startTeam = (state.game.startTeam === "red") ? "blue" : "red";
      hostNewGame({ words25: null });
      if(state.conn.mode === "local" && state.conn.host) broadcastStateLocal();
      renderAll();
    });

    // reset to menu
    el.btnResetConn && (el.btnResetConn.onclick = () => {
      disconnect();
      resetMeForNewSession();
      openStartMenu();
    });

    // manual local connect (optional)
    el.btnConnectLocal && (el.btnConnectLocal.onclick = () => {
      const code = (el.roomCode?.value || "").trim().toUpperCase();
      if(!code) return alert("Entre un room code (ex: ABCD)");
      enterRoomAsClient(code);
    });

    el.btnDisconnect && (el.btnDisconnect.onclick = () => {
      disconnect();
      resetMeForNewSession();
      openStartMenu();
    });
    el.btnDisconnect2 && (el.btnDisconnect2.onclick = () => {
      disconnect();
      resetMeForNewSession();
      openStartMenu();
    });

    // tabs
    el.tabLocal && (el.tabLocal.onclick = () => {
      el.tabLocal.classList.add("active");
      el.tabWs?.classList.remove("active");
      el.localBox?.classList.remove("hide");
      el.wsBox?.classList.add("hide");
    });
    el.tabWs && (el.tabWs.onclick = () => {
      el.tabWs.classList.add("active");
      el.tabLocal?.classList.remove("active");
      el.wsBox?.classList.remove("hide");
      el.localBox?.classList.add("hide");
    });
  }

  // =========================================================
  // INIT
  // =========================================================
  function init(){
    // ensure profile hidden on boot
    el.profileModal && hide(el.profileModal);

    // create initial board so words always show behind menu
    hostNewGame({ words25: null });

    disconnect();
    wireUI();
    renderAll();

    openStartMenu();
  }

  init();
})();
