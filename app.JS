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

  // =========================================================
  // STATE
  // =========================================================
  const state = {
    game: {
      startTeam: "red",
      activeTeam: "red",
      clue: null,           // {word,num}
      guessesLeft: 0,
      gameOver: false,
      cards: []             // {word, role, revealed}
    },
    players: {
      // id: {name, team, role}
      // role: "ops" | "spy" | "wordmaster"
    },
    wordmaster: {
      customWords: [],
      selected25: []
    },
    me: {
      id: makeId(),
      name: randomName(),
      team: null,
      role: null
    },
    conn: {
      mode: "none",  // "none" | "local" | "ws"
      room: null,
      host: false,
      transport: null
    },
    log: []
  };

  // =========================================================
  // DOM
  // =========================================================
  const $ = (id) => document.getElementById(id);
  const centerEl = $("center");

  // =========================================================
  // Helpers
  // =========================================================
  function nowStamp(){
    const d = new Date();
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"});
  }
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function pushLog(msg){
    state.log.unshift({ t: nowStamp(), msg });
    state.log = state.log.slice(0, 250);
    renderLog();
  }
  function renderLog(){
    $("log").innerHTML = state.log
      .map(e => `<div class="entry"><span class="t">${e.t}</span>${escapeHtml(e.msg)}</div>`)
      .join("");
  }

  function makeId(){
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  function randomName(){
    const a = ["Blue","Red","Fast","Silent","Iron","Nova","Pixel","Shadow","Lucky","Neo"];
    const b = ["Fox","Wolf","Tiger","Eagle","Koala","Panda","Viper","Otter","Hawk","Crow"];
    return a[Math.floor(Math.random()*a.length)] + b[Math.floor(Math.random()*b.length)];
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
    return shuffle([
      ...Array(redCount).fill("red"),
      ...Array(blueCount).fill("blue"),
      ...Array(7).fill("neutral"),
      "assassin"
    ]);
  }
  function computeRemaining(){
    let red=0, blue=0;
    for(const c of state.game.cards){
      if(!c.revealed){
        if(c.role==="red") red++;
        if(c.role==="blue") blue++;
      }
    }
    return { red, blue };
  }

  // =========================================================
  // Connection status UI
  // =========================================================
  function setConnStatus(text){ $("connStatus").textContent = text; }
  function setHostStatus(){
    $("hostStatus").textContent =
      (state.conn.mode === "none") ? "—" : (state.conn.host ? "HOST" : "CLIENT");
  }

  // =========================================================
  // TRANSPORTS
  // =========================================================
  function makeLocalTransport(room){
    const bc = new BroadcastChannel("codenames_room_" + room);
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
      send: (obj) => (ws.readyState === 1) && ws.send(JSON.stringify(obj)),
      onOpen: (fn) => ws.addEventListener("open", fn),
      onClose: (fn) => ws.addEventListener("close", fn),
      onMessage: (fn) => ws.addEventListener("message", (ev) => {
        try { fn(JSON.parse(ev.data)); } catch {}
      })
    };
  }

  function connected(){
    return state.conn.mode !== "none" && !!state.conn.transport;
  }

  // =========================================================
  // ONLINE PROTOCOL
  // =========================================================
  function makeSnapshot(){
    return {
      game: state.game,
      players: state.players,
      log: state.log
    };
  }

  function applySnapshot(snapshot){
    if(!snapshot) return;
    state.game = snapshot.game;
    state.players = snapshot.players;
    state.log = snapshot.log || state.log;
    renderAll();
    renderLog();
  }

  function broadcastStateLocal(){
    if(!connected() || state.conn.mode !== "local") return;
    state.conn.transport.send({
      t: "STATE",
      room: state.conn.room,
      from: state.me.id,
      snapshot: makeSnapshot()
    });
  }

  function sendAction(action){
    // offline => we act as host locally
    if(!connected()){
      if(!state.conn.host){
        state.conn.host = true;
        setHostStatus();
      }
      applyActionAsHost(action);
      renderAll();
      return;
    }

    // local mode
    if(state.conn.mode === "local"){
      if(state.conn.host){
        applyActionAsHost(action);
        broadcastStateLocal();
      } else {
        state.conn.transport.send({ t:"ACTION", room: state.conn.room, from: state.me.id, action });
      }
      return;
    }

    // websocket mode
    if(state.conn.mode === "ws"){
      state.conn.transport.send({ t:"ACTION", room: state.conn.room, from: state.me.id, action });
    }
  }

  // =========================================================
  // HOST ACTIONS (rules enforced here)
  // =========================================================
  function roleLabel(team, role){
    if(role === "wordmaster") return "WORD MASTER";
    if(!team || !role) return "SPECTATOR";
    return `${team.toUpperCase()} ${role === "spy" ? "SPYMASTER" : "OPERATIVE"}`;
  }

  function applyActionAsHost(action){
    if(!action || !action.kind) return;

    switch(action.kind){

      case "REQUEST_STATE": {
        // local host will broadcast on its own anyway
        break;
      }

      case "HELLO": {
        const { id, name } = action;
        if(!state.players[id]){
          state.players[id] = { name, team: null, role: null };
          pushLog(`[JOIN] ${name} connected.`);
        }
        break;
      }

      case "JOIN_ROLE": {
        const { id, name, team, role } = action;
        if(!state.players[id]) state.players[id] = { name, team:null, role:null };

        // 1 WordMaster max
        if(role === "wordmaster"){
          const existsWM = Object.entries(state.players)
            .some(([pid,p]) => p.role === "wordmaster" && pid !== id);
          if(existsWM){
            pushLog(`[DENY] Word Master already taken.`);
            break;
          }
        }

        // 1 spymaster per team
        if(role === "spy" && (team === "red" || team === "blue")){
          const existsSpy = Object.entries(state.players)
            .some(([pid,p]) => p.role === "spy" && p.team === team && pid !== id);
          if(existsSpy){
            pushLog(`[DENY] ${team.toUpperCase()} Spymaster already taken.`);
            break;
          }
        }

        state.players[id] = { name, team: team || null, role: role || null };
        pushLog(`[ROLE] ${name} -> ${roleLabel(team, role)}`);
        break;
      }

      case "NEW_GAME": {
        hostNewGame({ words25: null });
        break;
      }

      case "END_TURN": {
        hostEndTurn("manual");
        break;
      }

      case "SET_CLUE": {
        const { fromId, clue } = action;
        const p = state.players[fromId];

        if(!p || p.role !== "spy" || p.team !== state.game.activeTeam){
          pushLog(`[DENY] Only active team spymaster can set clue.`);
          break;
        }

        if(!clue?.word || typeof clue.num !== "number" || clue.num < 0){
          pushLog(`[DENY] Invalid clue.`);
          break;
        }

        state.game.clue = { word: String(clue.word).toUpperCase(), num: Number(clue.num) };
        state.game.guessesLeft = (state.game.clue.num === 0) ? 0 : (state.game.clue.num + 1);
        pushLog(`[CLUE] ${p.team.toUpperCase()} -> ${state.game.clue.word} ${state.game.clue.num}`);
        break;
      }

      case "REVEAL": {
        const { fromId, index } = action;
        const p = state.players[fromId];
        if(!p || p.role !== "ops" || p.team !== state.game.activeTeam) return;
        hostReveal(index);
        break;
      }

      case "SET_WORDS_25": {
        const { fromId, words25 } = action;
        const p = state.players[fromId];
        if(!p || p.role !== "wordmaster"){
          pushLog(`[DENY] Only Word Master can set words.`);
          break;
        }
        if(!Array.isArray(words25) || words25.length !== 25){
          pushLog(`[DENY] Need exactly 25 words.`);
          break;
        }
        hostNewGame({ words25 });
        pushLog(`[WORDS] Word Master selected 25 words. New game started.`);
        break;
      }

      default: break;
    }
  }

  function hostNewGame({ words25 }){
    state.game.gameOver = false;
    state.game.clue = null;
    state.game.guessesLeft = 0;
    state.game.activeTeam = state.game.startTeam;

    const roles = rolesForStart(state.game.startTeam);

    let words = words25;
    if(!Array.isArray(words) || words.length !== 25){
      words = shuffle(DEFAULT_WORDS).slice(0, 25);
    }
    words = shuffle(words);

    state.game.cards = words.map((w, i) => ({
      word: String(w).toUpperCase(),
      role: roles[i],
      revealed: false
    }));

    pushLog(`[GAME] New game. ${state.game.startTeam.toUpperCase()} starts.`);
  }

  function hostEndTurn(reason){
    if(state.game.gameOver) return;
    state.game.activeTeam = (state.game.activeTeam === "red") ? "blue" : "red";
    state.game.clue = null;
    state.game.guessesLeft = 0;
    pushLog(`[TURN] End turn${reason ? " ("+reason+")" : ""} -> ${state.game.activeTeam.toUpperCase()}`);
  }

  function hostReveal(index){
    const c = state.game.cards[index];
    if(!c || c.revealed || state.game.gameOver) return;

    c.revealed = true;

    if(c.role === "assassin"){
      state.game.gameOver = true;
      const winner = (state.game.activeTeam === "red") ? "BLUE" : "RED";
      pushLog(`[ASSASSIN] ${winner} wins.`);
      return;
    }

    if(state.game.clue && state.game.guessesLeft > 0) state.game.guessesLeft--;

    pushLog(`[REVEAL] ${c.word} -> ${c.role.toUpperCase()}`);

    const rem = computeRemaining();
    if(rem.red === 0){
      state.game.gameOver = true;
      pushLog(`[WIN] RED wins!`);
      return;
    }
    if(rem.blue === 0){
      state.game.gameOver = true;
      pushLog(`[WIN] BLUE wins!`);
      return;
    }

    if(c.role !== state.game.activeTeam){
      hostEndTurn("wrong");
      return;
    }
    if(state.game.clue && state.game.guessesLeft <= 0){
      hostEndTurn("no guesses");
      return;
    }
  }

  // =========================================================
  // RENDER
  // =========================================================
  function hasSpy(team){
    return Object.values(state.players).some(p => p.role === "spy" && p.team === team);
  }

  function playersText(team){
    const lines = [];
    for(const p of Object.values(state.players)){
      if(p.team !== team) continue;
      if(p.role === "spy") lines.push(`SPY: ${p.name}`);
      if(p.role === "ops") lines.push(`OPS: ${p.name}`);
      if(p.role === "wordmaster") lines.push(`WM: ${p.name}`);
    }
    return lines.length ? lines.join("\n") : "No players";
  }

  function renderAll(){
    // spymaster view
    if(state.me.role === "spy") centerEl.classList.add("spymaster-view");
    else centerEl.classList.remove("spymaster-view");

    const active = state.game.activeTeam;
    const needSpy = (active === "red" && !hasSpy("red")) || (active === "blue" && !hasSpy("blue"));
    $("titleText").textContent = needSpy ? `${active.toUpperCase()} TEAM NEEDS A SPYMASTER` : `${active.toUpperCase()} TEAM TURN`;

    $("clueDisplay").textContent = state.game.clue
      ? `CLUE: ${state.game.clue.word} ${state.game.clue.num}`
      : "CLUE: —";

    const rem = computeRemaining();
    $("redCount").textContent = rem.red;
    $("blueCount").textContent = rem.blue;

    $("bluePlayers").textContent = playersText("blue");
    $("redPlayers").textContent  = playersText("red");

    $("meRole").textContent = `You: ${roleLabel(state.me.team, state.me.role)} (${state.me.name})`;

    if(state.game.gameOver){
      $("turnHint").textContent = "Game Over.";
    } else {
      const clueTxt = state.game.clue ? ` | guesses: ${state.game.guessesLeft}` : "";
      $("turnHint").textContent = `Active: ${state.game.activeTeam.toUpperCase()}${clueTxt}`;
    }

    const canSetClue = !state.game.gameOver
      && state.me.role === "spy"
      && state.me.team === state.game.activeTeam;

    $("btnSetClue").disabled = !canSetClue;
    $("clueWord").disabled = !canSetClue;
    $("clueNum").disabled = !canSetClue;

    renderBoard();
    setHostStatus();
  }

  function renderBoard(){
    const board = $("board");
    board.innerHTML = "";

    state.game.cards.forEach((c, idx) => {
      const div = document.createElement("div");
      div.className = "card";

      if(c.revealed){
        div.classList.add("revealed", c.role);
      } else {
        if(state.me.role === "spy") div.classList.add(c.role);
      }

      div.innerHTML = `<span class="w">${escapeHtml(c.word)}</span>`;
      div.onclick = () => onCardClick(idx);

      board.appendChild(div);
    });
  }

  // =========================================================
  // GAME UI EVENTS
  // =========================================================
  function join(team, role){
    state.me.team = team;
    state.me.role = role;

    sendAction({
      kind: "JOIN_ROLE",
      id: state.me.id,
      name: state.me.name,
      team,
      role
    });

    renderAll();
  }

  function onCardClick(idx){
    if(state.game.gameOver) return;
    if(!(state.me.role === "ops" && state.me.team === state.game.activeTeam)) return;

    sendAction({
      kind: "REVEAL",
      fromId: state.me.id,
      index: idx
    });

    // offline host updates immediately
    if(!connected()) renderAll();
  }

  // =========================================================
  // WORD MASTER UI
  // =========================================================
  function renderPickGrid(){
    const grid = $("pickGrid");
    grid.innerHTML = "";

    const words = state.wordmaster.customWords;
    const selected = new Set(state.wordmaster.selected25);

    $("wmInfo").textContent = `${words.length} mots détectés`;

    if(words.length === 0){
      grid.innerHTML = `<div class="small">Colle des mots puis ouvre la sélection.</div>`;
      return;
    }

    for(const w of words){
      const lab = document.createElement("label");
      lab.className = "pickItem";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(w);

      cb.onchange = () => {
        const s = new Set(state.wordmaster.selected25);
        if(cb.checked) s.add(w); else s.delete(w);
        state.wordmaster.selected25 = Array.from(s);
      };

      const sp = document.createElement("span");
      sp.textContent = w;

      lab.appendChild(cb);
      lab.appendChild(sp);
      grid.appendChild(lab);
    }
  }

  function openWordsPanel(){
    $("wmBox").classList.toggle("hide");
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
      alert("Sélectionne exactement 25 mots (ou 'PICK 25 RANDOM').");
      return;
    }
    sendAction({
      kind: "SET_WORDS_25",
      fromId: state.me.id,
      words25: state.wordmaster.selected25
    });
  }

  // =========================================================
  // CONNECT / DISCONNECT
  // =========================================================
  function disconnect(){
    try{
      if(state.conn.transport) state.conn.transport.close();
    }catch{}
    state.conn.mode = "none";
    state.conn.room = null;
    state.conn.transport = null;
    state.conn.host = false;
    setConnStatus("Offline");
    setHostStatus();
  }

  function connectLocal(){
    const code = String($("roomCode").value || "").trim().toUpperCase();
    if(!code){ alert("Enter room code"); return; }

    disconnect();

    state.conn.mode = "local";
    state.conn.room = code;
    state.conn.transport = makeLocalTransport(code);

    // Host election (simple):
    // first tab that connects becomes host UNTIL it receives a STATE from someone else
    state.conn.host = true;

    state.conn.transport.onMessage((msg) => {
      if(!msg || msg.room !== code) return;

      if(msg.t === "STATE"){
        // if someone else broadcasts state -> they are host => I'm client
        if(msg.from && msg.from !== state.me.id){
          state.conn.host = false;
          applySnapshot(msg.snapshot);
          setHostStatus();
        }
        return;
      }

      if(msg.t === "ACTION"){
        if(state.conn.host){
          applyActionAsHost(msg.action);
          broadcastStateLocal();
          renderAll();
        }
      }
    });

    setConnStatus(`LOCAL: ${code}`);
    setHostStatus();

    // register me
    sendAction({ kind:"HELLO", id: state.me.id, name: state.me.name });

    // if I'm host, create game if empty
    if(state.conn.host && (!state.game.cards || state.game.cards.length !== 25)){
      hostNewGame({ words25: null });
      broadcastStateLocal();
    } else {
      // ask for state
      state.conn.transport.send({ t:"ACTION", room: code, from: state.me.id, action:{ kind:"REQUEST_STATE" } });
    }

    renderAll();
  }

  function connectWs(){
    const url = String($("wsUrl").value || "").trim();
    const room = String($("wsRoom").value || "").trim().toUpperCase();
    if(!url){ alert("Enter ws url"); return; }
    if(!room){ alert("Enter room code"); return; }

    disconnect();

    state.conn.mode = "ws";
    state.conn.room = room;
    state.conn.host = false; // server should decide host (or first client)
    state.conn.transport = makeWSTransport(url);

    setConnStatus(`WS: connecting...`);
    setHostStatus();

    state.conn.transport.onOpen(() => {
      setConnStatus(`WS: ${room}`);
      // hello + join room
      state.conn.transport.send({
        t:"HELLO",
        room,
        from: state.me.id,
        name: state.me.name
      });
      renderAll();
    });

    state.conn.transport.onClose(() => {
      disconnect();
      renderAll();
      pushLog("[WS] Disconnected.");
    });

    state.conn.transport.onMessage((msg) => {
      if(!msg || msg.room !== room) return;

      if(msg.t === "STATE"){
        // server snapshot
        applySnapshot(msg.snapshot);
        // server may tell host
        if(typeof msg.host === "boolean"){
          state.conn.host = msg.host;
          setHostStatus();
        }
        return;
      }

      if(msg.t === "LOG" && msg.msg){
        pushLog(msg.msg);
        return;
      }
    });

    renderAll();
  }

  // =========================================================
  // UI WIRES
  // =========================================================
  // Join buttons
  $("joinBlueOps").onclick = () => join("blue","ops");
  $("joinBlueSpy").onclick = () => join("blue","spy");
  $("joinRedOps").onclick  = () => join("red","ops");
  $("joinRedSpy").onclick  = () => join("red","spy");
  $("joinWordMaster").onclick = () => join(null,"wordmaster");

  // Clue / turn / game
  $("btnSetClue").onclick = () => {
    const w = $("clueWord").value.trim();
    const n = Number($("clueNum").value);

    if(!w){ alert("Enter a clue word."); return; }
    if(!Number.isFinite(n) || n < 0){ alert("Invalid number."); return; }

    sendAction({
      kind: "SET_CLUE",
      fromId: state.me.id,
      clue: { word: w.toUpperCase(), num: n }
    });

    if(!connected()) renderAll();
  };

  $("btnEndTurn").onclick = () => {
    sendAction({ kind:"END_TURN" });
    if(!connected()) renderAll();
  };

  $("btnNewGame").onclick = () => {
    sendAction({ kind:"NEW_GAME" });
    if(!connected()) renderAll();
  };

  // WordMaster panel
  $("btnOpenWords").onclick = () => openWordsPanel();
  $("wmWords").addEventListener("input", () => {
    state.wordmaster.customWords = normalizeWords($("wmWords").value);
    // keep selected only if still exists
    const set = new Set(state.wordmaster.customWords);
    state.wordmaster.selected25 = state.wordmaster.selected25.filter(w => set.has(w));
    renderPickGrid();
  });
  $("btnPick25").onclick = () => pick25Random();
  $("btnUseSelected").onclick = () => useSelected25();

  // Tabs local/ws
  $("tabLocal").onclick = () => {
    $("tabLocal").classList.add("active");
    $("tabWs").classList.remove("active");
    $("localBox").classList.remove("hide");
    $("wsBox").classList.add("hide");
  };
  $("tabWs").onclick = () => {
    $("tabWs").classList.add("active");
    $("tabLocal").classList.remove("active");
    $("wsBox").classList.remove("hide");
    $("localBox").classList.add("hide");
  };

  // Online buttons
  $("btnConnectLocal").onclick = () => connectLocal();
  $("btnDisconnect").onclick = () => { disconnect(); renderAll(); };
  $("btnDisconnect2").onclick = () => { disconnect(); renderAll(); };
  $("btnConnectWs").onclick = () => connectWs();

  // Admin + reset
  $("btnResetConn").onclick = () => { disconnect(); renderAll(); pushLog("[CONN] Reset."); };
  $("btnAdmin").onclick = () => {
    // Toggle startTeam for next game
    state.game.startTeam = (state.game.startTeam === "red") ? "blue" : "red";
    pushLog(`[ADMIN] Start team set to ${state.game.startTeam.toUpperCase()} (next NEW GAME).`);
    renderAll();
    if(state.conn.host && state.conn.mode === "local") broadcastStateLocal();
  };

  // =========================================================
  // INIT
  // =========================================================
  function init(){
    // register myself locally
    state.players[state.me.id] = { name: state.me.name, team: null, role: null };

    // start an offline game immediately
    state.conn.host = true;
    hostNewGame({ words25: null });

    setConnStatus("Offline");
    setHostStatus();
    pushLog(`[YOU] Name: ${state.me.name}`);

    renderAll();
    renderLog();
  }

  init();
})();
