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

    // BLUE clue controls
    clueWordBlue: $("clueWord"),
    clueNumBlue: $("clueNum"),
    btnSetClueBlue: $("btnSetClueBlue"),

    // RED clue controls
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

    wordmasterPanel: $("wordmasterPanel"),
    btnOpenWords: $("btnOpenWords"),
    wmBox: $("wmBox"),
    wmWords: $("wmWords"),
    btnPick25: $("btnPick25"),
    btnUseSelected: $("btnUseSelected"),
    wmInfo: $("wmInfo"),
    pickGrid: $("pickGrid"),

    // CLUE overlay/badge
    clueOverlay: $("clueOverlay"),
    clueOverlayTeam: $("clueOverlayTeam"),
    clueOverlayText: $("clueOverlayText"),

    clueBadge: $("clueBadge"),
    clueBadgeTeam: $("clueBadgeTeam"),
    clueBadgeText: $("clueBadgeText"),

    // PROFILE modal
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
      clue: null,             // {word,num, byTeam}
      guessesLeft: 0,
      gameOver: false,
      cards: [],              // {word, role, revealed, blank}
      _clueFlashToken: null,
      _winner: null
    },

    players: {
      // id: { name, avatar, team, role }
    },

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
  // BASIC UTILS
  // =========================================================
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
  function normalizeWords(text){
    const raw = text
      .replaceAll("\r","\n")
      .split(/[\n,]+/g)
      .map(w => w.trim())
      .filter(Boolean);

    const seen = new Set();
    const out = [];
    for(const w of raw){
      const up = w.toUpperCase();
      if(!seen.has(up)){
        seen.add(up);
        out.push(up);
      }
    }
    return out;
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
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function show(elem){ if(elem) elem.classList.remove("hide"); }
  function hide(elem){ if(elem) elem.classList.add("hide"); }

  function randomRoomCode(n=4){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for(let i=0;i<n;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  // =========================================================
  // START MENU (NEW GAME / JOIN BY CODE)
  // =========================================================
  let startMenuEl = null;

  function closeStartMenu(){
    if(startMenuEl) startMenuEl.remove();
    startMenuEl = null;
  }

  function openStartMenu(){
    closeStartMenu();

    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "startMenuModal";
    wrap.setAttribute("aria-hidden","false");

    const card = document.createElement("div");
    card.className = "modalCard";
    card.style.textAlign = "left";

    card.innerHTML = `
      <div class="modalTitle" style="text-align:center;">SpyMaster Game</div>
      <div class="modalSub" style="text-align:center;margin-bottom:10px;">
        Choisis : créer une partie (nouveau code) ou rejoindre avec un code.
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btnPrimary" id="btnStartNewGame">NEW GAME (créer code)</button>

        <div style="display:flex;gap:10px;align-items:center;">
          <input class="input" id="joinCodeInput" maxlength="8" placeholder="CODE (ex: ABCD)" style="margin-top:0;flex:1;">
          <button class="btnSmall" id="btnJoinByCode" style="height:44px;">JOIN</button>
        </div>

        <div class="smallNote" id="startMenuError"></div>

        <div style="opacity:.75;font-size:12px;line-height:1.3;margin-top:6px;">
          Mode local : ouvre plusieurs onglets et utilise le même code.<br>
          L’hôte est le premier onglet qui crée la partie.
        </div>
      </div>
    `;

    wrap.appendChild(card);
    document.body.appendChild(wrap);
    startMenuEl = wrap;

    const err = () => document.getElementById("startMenuError");
    const setErr = (m) => { const e = err(); if(e) e.textContent = m || ""; };

    document.getElementById("btnStartNewGame")?.addEventListener("click", (e) => {
      e.preventDefault();
      setErr("");
      const code = randomRoomCode(4);
      // host: connect + start new game
      enterRoomAsHost(code);
    });

    document.getElementById("btnJoinByCode")?.addEventListener("click", (e) => {
      e.preventDefault();
      const input = document.getElementById("joinCodeInput");
      const code = (input?.value || "").trim().toUpperCase();
      if(!code){
        setErr("Entre un code.");
        return;
      }
      setErr("");
      enterRoomAsClient(code);
    });

    document.getElementById("joinCodeInput")?.addEventListener("keydown", (e) => {
      if(e.key === "Enter") document.getElementById("btnJoinByCode")?.click();
    });
  }

  function resetMeForNewSession(){
    // IMPORTANT: profile changes every time (not fixed)
    state.me.name = null;
    state.me.avatar = null;
    state.me.team = null;
    state.me.role = null;
  }

  // =========================================================
  // PROFILE MODAL (2 steps: NAME then AVATAR) - NO localStorage
  // =========================================================
  let profileStep = 1; // 1=name, 2=avatar
  let chosenName = "";
  let chosenAvatar = "";

  function openProfileModal(){
    if(!el.profileModal) return;
    el.profileModal.setAttribute("aria-hidden","false");
    show(el.profileModal);
  }
  function closeProfileModal(){
    if(!el.profileModal) return;
    el.profileModal.setAttribute("aria-hidden","true");
    hide(el.profileModal);
    setProfileStep(1);
  }
  function setProfileError(msg){
    if(el.profileError) el.profileError.textContent = msg || "";
  }
  function setProfileStep(step){
    profileStep = step;
    setProfileError("");

    if(step === 1){
      if(el.avatarGrid) el.avatarGrid.style.display = "none";
      if(el.playerName){
        el.playerName.disabled = false;
        el.playerName.value = chosenName || "";
        el.playerName.focus();
      }
      if(el.btnEnterGame) el.btnEnterGame.textContent = "Suivant";
      return;
    }

    if(el.avatarGrid) el.avatarGrid.style.display = "";
    if(el.playerName) el.playerName.disabled = true;
    if(el.btnEnterGame) el.btnEnterGame.textContent = "Entrer";
  }

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
        setProfileError("");
      });
      el.avatarGrid.appendChild(b);
    });
  }

  function requireFreshProfile(){
    buildAvatarButtons();
    chosenName = "";
    chosenAvatar = "";
    openProfileModal();
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
        setProfileError("Entre un pseudo (1 à 16 caractères).");
        return;
      }
      chosenName = name;
      setProfileStep(2);
      return;
    }

    if(!chosenAvatar){
      setProfileError("Choisis un avatar.");
      return;
    }

    state.me.name = chosenName;
    state.me.avatar = chosenAvatar;

    // Register / announce
    applyActionAsHost({ kind:"HELLO", id: state.me.id, name: state.me.name, avatar: state.me.avatar });
    sendHello();
    renderAll();

    closeProfileModal();
  }

  // =========================================================
  // TRANSPORTS
  // =========================================================
  function makeLocalTransport(room){
    const bc = new BroadcastChannel("spymaster_room_" + room);
    return {
      type: "local",
      close: () => bc.close(),
      send: (obj) => bc.postMessage(obj),
      onMessage: (fn) => { bc.onmessage = (ev) => fn(ev.data); }
    };
  }

  function makeWSTransport(url){
    const ws = new WebSocket(url);
    return {
      type: "ws",
      ws,
      close: () => ws.close(),
      send: (obj) => { if(ws.readyState === 1) ws.send(JSON.stringify(obj)); },
      onOpen: (fn) => ws.addEventListener("open", fn),
      onClose: (fn) => ws.addEventListener("close", fn),
      onMessage: (fn) => ws.addEventListener("message", (ev) => {
        try{ fn(JSON.parse(ev.data)); }catch{}
      })
    };
  }

  function setConnStatus(text){ if(el.connStatus) el.connStatus.textContent = text; }
  function setHostStatus(){
    if(!el.hostStatus) return;
    el.hostStatus.textContent = (state.conn.mode === "none") ? "—" : (state.conn.host ? "HOST" : "CLIENT");
  }

  // =========================================================
  // ONLINE PROTOCOL
  // =========================================================
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
      t: "STATE",
      room: state.conn.room,
      from: state.me.id,
      snapshot: makeSnapshot()
    });
  }

  function requestStateLocal(){
    if(!connected() || state.conn.mode !== "local") return;
    state.conn.transport.send({
      t: "REQ_STATE",
      room: state.conn.room,
      from: state.me.id
    });
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
      return;
    }

    // ws
    state.conn.transport.send({ t:"ACTION", room: state.conn.room, from: state.me.id, action });
  }

  // =========================================================
  // HOST RULES / ACTIONS
  // =========================================================
  function roleLabel(p){
    if(!p || !p.role) return "Spectator";
    if(p.role === "wordmaster") return "WORD MASTER";
    return `${(p.team||"").toUpperCase()} ${p.role === "spy" ? "SPYMASTER" : "OPERATIVE"}`.trim();
  }

  function hasSpy(team){
    return Object.values(state.players).some(p => p.role === "spy" && p.team === team);
  }

  function applyActionAsHost(action){
    if(!action || !action.kind) return;

    switch(action.kind){
      case "HELLO": {
        const { id, name, avatar } = action;
        if(!state.players[id]){
          state.players[id] = { name, avatar, team:null, role:null };
        } else {
          state.players[id].name = name;
          state.players[id].avatar = avatar;
        }
        break;
      }

      case "JOIN_ROLE": {
        const { id, name, avatar, team, role } = action;

        if(!state.players[id]) state.players[id] = { name, avatar, team:null, role:null };
        state.players[id].name = name;
        state.players[id].avatar = avatar;

        // uniqueness: 1 spy per team, 1 wordmaster total
        if(role === "wordmaster"){
          const exists = Object.entries(state.players).some(([pid,p]) => p.role === "wordmaster" && pid !== id);
          if(exists) return;
        }
        if(role === "spy" && (team === "red" || team === "blue")){
          const existsSpy = Object.entries(state.players).some(([pid,p]) => p.role==="spy" && p.team===team && pid !== id);
          if(existsSpy) return;
        }

        state.players[id].team = team || null;
        state.players[id].role = role || null;
        break;
      }

      case "NEW_GAME": {
        // only host online (but offline ok)
        hostNewGame({ words25: null });
        break;
      }

      case "SET_WORDS_25": {
        const { fromId, words25 } = action;
        const p = state.players[fromId];
        if(!p || p.role !== "wordmaster") return;
        if(!Array.isArray(words25) || words25.length !== 25) return;
        hostNewGame({ words25 });
        break;
      }

      case "SET_CLUE": {
        const { fromId, clue } = action;
        const p = state.players[fromId];

        if(!p || p.role !== "spy" || p.team !== state.game.activeTeam) return;
        if(!clue || !clue.word || !Number.isFinite(Number(clue.num))) return;

        // block setting a new clue if one already active (logic improvement)
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

        // require clue before guessing (logic improvement)
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
      role: roles[i],     // "red" | "blue" | "neutral" | "assassin"
      revealed: false,
      blank: false        // used ONLY for neutral -> show white
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

  function hostReveal(index){
  const c = state.game.cards[index];
  if(!c || c.revealed || state.game.gameOver) return;

  c.revealed = true;

  // ✅ Règles demandées :
  // - RED / BLUE / ASSASSIN => couleur normale
  // - NEUTRAL => WHITE (blank)
  c.blank = (c.role === "neutral");

  if(c.role === "assassin"){
    state.game.gameOver = true;
    state.game._winner = (state.game.activeTeam === "red") ? "BLUE" : "RED";
    return;
  }

  // consomme une tentative si clue active
  if(state.game.clue && state.game.guessesLeft > 0){
    state.game.guessesLeft--;
  }

  // win check
  const rem = computeRemaining();
  if(rem.red === 0){
    state.game.gameOver = true;
    state.game._winner = "RED";
    return;
  }
  if(rem.blue === 0){
    state.game.gameOver = true;
    state.game._winner = "BLUE";
    return;
  }

  // auto end si plus d’essais
  if(state.game.clue && state.game.guessesLeft <= 0){
    hostEndTurn();
  }
}

  // =========================================================
  // RENDER (incl. clue overlay/badge)
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

  function isRoleTaken(role){
    return Object.values(state.players).some(p => p.role === role);
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

  function renderBoard(){
  if(!el.board) return;
  el.board.innerHTML = "";

  state.game.cards.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "card";

    if(c.revealed){
      // ✅ Si neutral => blanc
      if(c.role === "neutral" || c.blank){
        div.classList.add("revealed", "blank");
      } else {
        // ✅ red / blue / assassin => couleur exacte
        div.classList.add("revealed", c.role);
      }
    } else {
      // spymaster voit les couleurs avant révélation
      if(state.me.role === "spy"){
        div.classList.add(c.role);
      }
    }

    div.innerHTML = `<span class="w">${escapeHtml(c.word)}</span>`;
    div.onclick = () => onCardClick(idx);
    el.board.appendChild(div);
  });
}


  function renderPickGrid(){
    if(!el.wmInfo || !el.pickGrid || !el.wmBox) return;

    const words = state.wordmaster.customWords;
    const selectedSet = new Set(state.wordmaster.selected25);

    el.wmInfo.textContent = `${words.length} mots détectés · sélection: ${selectedSet.size}/25`;
    if(el.wmBox.classList.contains("hide")) return;

    el.pickGrid.innerHTML = "";

    if(words.length === 0){
      el.pickGrid.innerHTML = `<div class="small">Colle une liste de mots puis sélectionne.</div>`;
      return;
    }

    for(const w of words){
      const label = document.createElement("label");
      label.className = "pickItem";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selectedSet.has(w);

      cb.onchange = () => {
        const s = new Set(state.wordmaster.selected25);
        if(cb.checked){
          if(s.size >= 25){
            cb.checked = false;
            return;
          }
          s.add(w);
        } else {
          s.delete(w);
        }
        state.wordmaster.selected25 = Array.from(s);
        renderPickGrid();
      };

      const span = document.createElement("span");
      span.textContent = w;

      label.appendChild(cb);
      label.appendChild(span);
      el.pickGrid.appendChild(label);
    }
  }

  function renderAll(){
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

    const canSetClue =
      !state.game.gameOver &&
      state.me.role === "spy" &&
      state.me.team === state.game.activeTeam &&
      !state.game.clue; // improvement: only if no clue set yet

    // Blue set
    if(el.btnSetClueBlue) el.btnSetClueBlue.disabled = !canSetClue || state.me.team !== "blue";
    if(el.clueWordBlue) el.clueWordBlue.disabled = !canSetClue || state.me.team !== "blue";
    if(el.clueNumBlue) el.clueNumBlue.disabled = !canSetClue || state.me.team !== "blue";

    // Red set
    if(el.btnSetClueRed) el.btnSetClueRed.disabled = !canSetClue || state.me.team !== "red";
    if(el.clueWordRed) el.clueWordRed.disabled = !canSetClue || state.me.team !== "red";
    if(el.clueNumRed) el.clueNumRed.disabled = !canSetClue || state.me.team !== "red";

    const canEnd =
      !state.game.gameOver &&
      state.me.team === state.game.activeTeam &&
      (state.me.role === "spy" || state.me.role === "ops");
    if(el.btnEndTurn) el.btnEndTurn.disabled = !canEnd;

    // host-only for NEW GAME when connected
    if(el.btnNewGame) el.btnNewGame.disabled = connected() && !state.conn.host;

    if(el.joinWordMaster) el.joinWordMaster.disabled = isRoleTaken("wordmaster") && state.me.role !== "wordmaster";
    if(el.btnUseSelected) el.btnUseSelected.disabled = state.me.role !== "wordmaster";

    renderClueBadge();
    renderBoard();
    renderPickGrid();

    const token = state.game._clueFlashToken || null;
    if(token && token !== lastClueFlashToken){
      lastClueFlashToken = token;
      showClueOverlayFor3s();
    }
  }

  // =========================================================
  // WORDMASTER UI
  // =========================================================
  function openWordsPanel(){
    if(!el.wmBox) return;
    el.wmBox.classList.toggle("hide");
    renderPickGrid();
  }

  function pick25Random(){
    if(state.wordmaster.customWords.length < 25){
      alert("Il faut au moins 25 mots.");
      return;
    }
    state.wordmaster.selected25 = shuffle(state.wordmaster.customWords).slice(0,25);
    renderPickGrid();
  }

  function useSelected25(){
    if(state.me.role !== "wordmaster"){
      alert("Tu dois être Word Master.");
      return;
    }
    if(state.wordmaster.selected25.length !== 25){
      alert("Sélectionne exactement 25 mots.");
      return;
    }
    sendAction({
      kind: "SET_WORDS_25",
      fromId: state.me.id,
      words25: state.wordmaster.selected25
    });
  }

  // =========================================================
  // JOIN / CLICK
  // =========================================================
  function ensureProfileBeforePlay(){
    if(state.me.name && state.me.avatar) return true;
    requireFreshProfile();
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

    // only active team operatives can click
    if(!(state.me.role === "ops" && state.me.team === state.game.activeTeam)) return;

    sendAction({ kind: "REVEAL", fromId: state.me.id, index: idx });
  }

  // =========================================================
  // CONNECT / DISCONNECT
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

    // optimistic host; first STATE received will switch you to client
    state.conn.host = true;

    state.conn.transport.onMessage((msg) => {
      if(!msg || msg.room !== state.conn.room) return;

      if(msg.t === "STATE"){
        if(msg.from !== state.me.id){
          state.conn.host = false;
          applySnapshot(msg.snapshot);
          renderAll();
        }
        return;
      }

      if(msg.t === "REQ_STATE"){
        if(state.conn.host){
          broadcastStateLocal();
        }
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

    // always announce
    sendHello();

    // ask for state (if there is already a host)
    requestStateLocal();

    // if we truly are host, broadcast state quickly
    setTimeout(() => {
      if(state.conn.mode === "local" && state.conn.host){
        broadcastStateLocal();
      }
    }, 80);
  }

  function connectWs(){
    const url = (el.wsUrl?.value || "").trim();
    const room = (el.wsRoom?.value || "").trim().toUpperCase();
    if(!url || !room){
      alert("Entre ws://... et un room code");
      return;
    }

    disconnect();

    state.conn.mode = "ws";
    state.conn.room = room;
    state.conn.host = false;

    const t = makeWSTransport(url);
    state.conn.transport = t;

    t.onOpen(() => {
      setConnStatus(`WS · Room ${room}`);
      setHostStatus();
      t.send({ t:"JOIN", room, id: state.me.id, name: state.me.name, avatar: state.me.avatar });
      renderAll();
    });

    t.onClose(() => disconnect());

    t.onMessage((msg) => {
      if(!msg) return;
      if(msg.room && msg.room !== state.conn.room) return;

      if(msg.t === "STATE"){
        applySnapshot(msg.snapshot);
        renderAll();
        return;
      }
    });
  }

  function sendHello(){
    // safe even if profile not chosen yet
    sendAction({
      kind: "HELLO",
      id: state.me.id,
      name: state.me.name || "?",
      avatar: state.me.avatar || "🙂"
    });
  }

  // =========================================================
  // ROOM ENTRY FLOW (menu -> room -> profile)
  // =========================================================
  function enterRoomAsHost(code){
    resetMeForNewSession();
    connectLocalWithCode(code);

    // host starts a fresh board
    state.conn.host = true;
    hostNewGame({ words25: null });
    broadcastStateLocal();
    renderAll();

    closeStartMenu();
    requireFreshProfile();
  }

  function enterRoomAsClient(code){
    resetMeForNewSession();
    connectLocalWithCode(code);

    closeStartMenu();
    requireFreshProfile();
  }

  // =========================================================
  // UI WIRING
  // =========================================================
  function wireUI(){
    // PROFILE modal controls
    if(el.btnEnterGame) el.btnEnterGame.addEventListener("click", (e) => {
      e.preventDefault();
      onProfileConfirm();
    });
    if(el.playerName) el.playerName.addEventListener("keydown", (e) => {
      if(e.key === "Enter" && profileStep === 1){
        e.preventDefault();
        onProfileConfirm();
      }
    });

    // Join buttons
    if(el.joinBlueOps) el.joinBlueOps.onclick = () => join("blue","ops");
    if(el.joinBlueSpy) el.joinBlueSpy.onclick = () => join("blue","spy");
    if(el.joinRedOps) el.joinRedOps.onclick = () => join("red","ops");
    if(el.joinRedSpy) el.joinRedSpy.onclick = () => join("red","spy");
    if(el.joinWordMaster) el.joinWordMaster.onclick = () => join(null,"wordmaster");

    // Set clue Blue
    if(el.btnSetClueBlue) el.btnSetClueBlue.onclick = () => {
      if(state.game.gameOver) return;
      if(!(state.me.role === "spy" && state.me.team === "blue" && state.me.team === state.game.activeTeam)) return;
      if(state.game.clue) return;

      const word = (el.clueWordBlue?.value || "").trim();
      const num = Number(el.clueNumBlue?.value);

      if(!word){ alert("Enter a clue word."); return; }
      if(!Number.isFinite(num) || num < 0 || num > 9){ alert("Invalid number (0-9)."); return; }

      sendAction({ kind:"SET_CLUE", fromId: state.me.id, clue: { word, num } });
    };

    // Set clue Red
    if(el.btnSetClueRed) el.btnSetClueRed.onclick = () => {
      if(state.game.gameOver) return;
      if(!(state.me.role === "spy" && state.me.team === "red" && state.me.team === state.game.activeTeam)) return;
      if(state.game.clue) return;

      const word = (el.clueWordRed?.value || "").trim();
      const num = Number(el.clueNumRed?.value);

      if(!word){ alert("Enter a clue word."); return; }
      if(!Number.isFinite(num) || num < 0 || num > 9){ alert("Invalid number (0-9)."); return; }

      sendAction({ kind:"SET_CLUE", fromId: state.me.id, clue: { word, num } });
    };

    // End turn
    if(el.btnEndTurn) el.btnEndTurn.onclick = () => {
      if(state.game.gameOver) return;
      if(!(state.me.team === state.game.activeTeam && (state.me.role === "spy" || state.me.role === "ops"))) return;
      sendAction({ kind:"END_TURN", fromId: state.me.id });
    };

    // New game (host only when connected)
    if(el.btnNewGame) el.btnNewGame.onclick = () => {
      if(connected() && !state.conn.host) return;
      hostNewGame({ words25: null });
      if(state.conn.mode === "local" && state.conn.host) broadcastStateLocal();
      renderAll();

      // profile must change each time you "start a party"
      // (if you want it every NEW GAME too)
      resetMeForNewSession();
      requireFreshProfile();
    };

    // Admin toggle start team (host only online)
    if(el.btnAdmin) el.btnAdmin.onclick = () => {
      if(connected() && !state.conn.host) return;
      state.game.startTeam = (state.game.startTeam === "red") ? "blue" : "red";
      hostNewGame({ words25: null });
      if(state.conn.mode === "local" && state.conn.host) broadcastStateLocal();
      renderAll();
    };

    // Reset conn
    if(el.btnResetConn) el.btnResetConn.onclick = () => {
      disconnect();
      resetMeForNewSession();
      openStartMenu();
    };

    // Tabs
    if(el.tabLocal) el.tabLocal.onclick = () => {
      el.tabLocal.classList.add("active");
      el.tabWs?.classList.remove("active");
      el.localBox?.classList.remove("hide");
      el.wsBox?.classList.add("hide");
    };
    if(el.tabWs) el.tabWs.onclick = () => {
      el.tabWs.classList.add("active");
      el.tabLocal?.classList.remove("active");
      el.wsBox?.classList.remove("hide");
      el.localBox?.classList.add("hide");
    };

    // (optional) manual local connect still works
    if(el.btnConnectLocal) el.btnConnectLocal.onclick = () => {
      const code = (el.roomCode?.value || "").trim().toUpperCase();
      if(!code) return alert("Entre un room code (ex: ABCD)");
      enterRoomAsClient(code);
    };
    if(el.btnDisconnect) el.btnDisconnect.onclick = () => {
      disconnect();
      resetMeForNewSession();
      openStartMenu();
    };
    if(el.btnDisconnect2) el.btnDisconnect2.onclick = () => {
      disconnect();
      resetMeForNewSession();
      openStartMenu();
    };

    // WS connect
    if(el.btnConnectWs) el.btnConnectWs.onclick = () => connectWs();

    // Wordmaster controls
    if(el.btnOpenWords) el.btnOpenWords.onclick = () => openWordsPanel();

    if(el.wmWords) el.wmWords.oninput = () => {
      state.wordmaster.customWords = normalizeWords(el.wmWords.value || "");
      const set = new Set(state.wordmaster.customWords);
      state.wordmaster.selected25 = state.wordmaster.selected25.filter(w => set.has(w));
      renderPickGrid();
    };

    if(el.btnPick25) el.btnPick25.onclick = () => pick25Random();
    if(el.btnUseSelected) el.btnUseSelected.onclick = () => useSelected25();
  }

  // =========================================================
  // INIT
  // =========================================================
  function init(){
    // start disconnected; show menu first
    disconnect();

    // ensure profile modal hidden at boot
    if(el.profileModal) hide(el.profileModal);

    // build a board so UI isn't empty behind menu
    hostNewGame({ words25: null });

    wireUI();
    renderAll();

    // show start menu first
    openStartMenu();
  }

  init();
})();
