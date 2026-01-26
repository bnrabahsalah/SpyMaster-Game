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

  const CLUE_OVERLAY_MS = 1200;

  // =========================================================
  // STATE
  // =========================================================
  const state = {
    game: {
      startTeam: "red",
      activeTeam: "red",
      clue: null,           // {word,num,byTeam}
      guessesLeft: 0,
      gameOver: false,
      cards: []             // {word, role, revealed}
    },
    players: {
      // clientId: {name, team, role} role = "ops" | "spy" | "wordmaster"
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
      host: true,    // offline => host = true
      transport: null
    }
  };

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

    // BLUE spymaster controls (existing in your HTML)
    clueWordB: $("clueWord"),
    clueNumB: $("clueNum"),
    btnSetClueB: $("btnSetClue"),
    btnEndTurnB: $("btnEndTurn"),
    btnNewGameB: $("btnNewGame"),
    clueDisplay: $("clueDisplay"),
    turnHint: $("turnHint"),

    // RED spymaster controls (optional, if you duplicated with these IDs)
    clueWordR: $("clueWordR"),
    clueNumR: $("clueNumR"),
    btnSetClueR: $("btnSetClueR"),
    btnEndTurnR: $("btnEndTurnR"),
    btnNewGameR: $("btnNewGameR"),
    clueDisplayR: $("clueDisplayR"), // optional

    // joins
    joinBlueOps: $("joinBlueOps"),
    joinBlueSpy: $("joinBlueSpy"),
    joinRedOps: $("joinRedOps"),
    joinRedSpy: $("joinRedSpy"),
    joinWordMaster: $("joinWordMaster"),

    // word master
    wordmasterPanel: $("wordmasterPanel"),
    btnOpenWords: $("btnOpenWords"),
    wmBox: $("wmBox"),
    wmWords: $("wmWords"),
    btnPick25: $("btnPick25"),
    btnUseSelected: $("btnUseSelected"),
    pickGrid: $("pickGrid"),
    wmInfo: $("wmInfo"),

    // admin + tabs
    btnAdmin: $("btnAdmin"),
    btnResetConn: $("btnResetConn"),

    tabLocal: $("tabLocal"),
    tabWs: $("tabWs"),
    localBox: $("localBox"),
    wsBox: $("wsBox"),

    // local connect
    roomCode: $("roomCode"),
    btnConnectLocal: $("btnConnectLocal"),
    btnDisconnect: $("btnDisconnect"),
    btnDisconnect2: $("btnDisconnect2"),

    // ws connect
    wsUrl: $("wsUrl"),
    wsRoom: $("wsRoom"),
    btnConnectWs: $("btnConnectWs")
  };

  // =========================================================
  // UI: Clue Overlay (created dynamically; no HTML needed)
  // =========================================================
  const clueUI = (() => {
    const overlay = document.createElement("div");
    overlay.className = "clueOverlay";
    overlay.innerHTML = `
      <div class="box">
        <div class="big" id="clueBigText">—</div>
        <div class="sub" id="clueBigSub">—</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const float = document.createElement("div");
    float.style.position = "fixed";
    float.style.top = "70px";
    float.style.right = "18px";
    float.style.zIndex = "9998";
    float.style.display = "none";
    float.style.padding = "10px 14px";
    float.style.borderRadius = "999px";
    float.style.border = "1px solid rgba(255,255,255,.25)";
    float.style.background = "rgba(0,0,0,.45)";
    float.style.boxShadow = "0 10px 30px rgba(0,0,0,.45)";
    float.style.fontWeight = "1000";
    float.style.letterSpacing = ".6px";
    float.style.textTransform = "uppercase";
    float.style.backdropFilter = "blur(3px)";
    document.body.appendChild(float);

    const bigText = overlay.querySelector("#clueBigText");
    const bigSub = overlay.querySelector("#clueBigSub");

    function showBigThenFloat(text, sub) {
      bigText.textContent = text;
      bigSub.textContent = sub;

      overlay.classList.add("show");
      setTimeout(() => {
        overlay.classList.remove("show");
        float.textContent = text;
        float.style.display = "block";
      }, CLUE_OVERLAY_MS);
    }

    function clearFloat() {
      float.style.display = "none";
      float.textContent = "";
      overlay.classList.remove("show");
    }

    return { showBigThenFloat, clearFloat };
  })();

  // =========================================================
  // HELPERS
  // =========================================================
  function makeId(){
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function randomName(){
    const a = ["Blue","Red","Fast","Silent","Iron","Nova","Pixel","Shadow","Lucky","Neo"];
    const b = ["Fox","Wolf","Tiger","Eagle","Koala","Panda","Viper","Otter","Hawk","Crow"];
    return a[Math.floor(Math.random()*a.length)] + b[Math.floor(Math.random()*b.length)];
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
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
    const raw = String(text || "")
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

  function roleLabel(team, role){
    if(role === "wordmaster") return "WORD MASTER";
    if(!team || !role) return "SPECTATOR";
    return `${team.toUpperCase()} ${role === "spy" ? "SPYMASTER" : "OPERATIVE"}`;
  }

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

  // =========================================================
  // TRANSPORTS
  // =========================================================
  function setConnStatus(text){
    if(el.connStatus) el.connStatus.textContent = text;
  }
  function setHostStatus(){
    if(!el.hostStatus) return;
    if(state.conn.mode === "none") el.hostStatus.textContent = "—";
    else el.hostStatus.textContent = state.conn.host ? "HOST" : "CLIENT";
  }

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
      send: (obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj)),
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
  // SYNC PROTOCOL
  // - Local: one tab is HOST, others CLIENT
  // - WS: we assume server relays messages; we still use host-election
  // =========================================================
  function sendToTransport(obj){
    if(!connected()) return;
    state.conn.transport.send(obj);
  }

  function makeSnapshot(){
    return {
      game: state.game,
      players: state.players,
      wm: { customWords: state.wordmaster.customWords, selected25: state.wordmaster.selected25 }
    };
  }

  function applySnapshot(snap){
    if(!snap) return;
    if(snap.game) state.game = snap.game;
    if(snap.players) state.players = snap.players;
    if(snap.wm) {
      state.wordmaster.customWords = Array.isArray(snap.wm.customWords) ? snap.wm.customWords : state.wordmaster.customWords;
      state.wordmaster.selected25 = Array.isArray(snap.wm.selected25) ? snap.wm.selected25 : state.wordmaster.selected25;
    }
    renderAll();
    renderPickGrid();
  }

  function broadcastState(){
    if(!connected()) return;
    if(!state.conn.host) return;
    sendToTransport({
      t: "STATE",
      room: state.conn.room,
      from: state.me.id,
      snapshot: makeSnapshot()
    });
  }

  function sendAction(action){
    // Offline => apply as host
    if(!connected()){
      state.conn.host = true;
      applyActionAsHost(action);
      renderAll();
      return;
    }

    // Connected:
    if(state.conn.host){
      applyActionAsHost(action);
      broadcastState();
      renderAll();
    } else {
      sendToTransport({
        t: "ACTION",
        room: state.conn.room,
        from: state.me.id,
        action
      });
    }
  }

  function hostElectionPing(){
    // Host announces itself + pushes snapshot
    if(!connected()) return;
    if(!state.conn.host) return;
    sendToTransport({ t:"HOST", room: state.conn.room, from: state.me.id });
    broadcastState();
  }

  function connectLocal(room){
    room = String(room || "").trim().toUpperCase();
    if(!room) return alert("Room code ?");
    disconnectAny();

    state.conn.mode = "local";
    state.conn.room = room;
    state.conn.transport = makeLocalTransport(room);
    state.conn.host = true; // tentative

    setConnStatus(`Local: ${room}`);
    setHostStatus();

    state.conn.transport.onMessage((msg) => {
      if(!msg || msg.room !== room) return;

      // Host ping received => if not me, I become client
      if(msg.t === "HOST" && msg.from !== state.me.id){
        state.conn.host = false;
        setHostStatus();
        // ask snapshot
        sendToTransport({ t:"REQ_STATE", room, from: state.me.id });
        return;
      }

      if(msg.t === "REQ_STATE"){
        if(state.conn.host) broadcastState();
        return;
      }

      if(msg.t === "STATE"){
        if(msg.from === state.me.id && state.conn.host) return; // ignore my own
        applySnapshot(msg.snapshot);
        return;
      }

      if(msg.t === "ACTION"){
        // host applies client action then rebroadcasts
        if(state.conn.host && msg.action){
          applyActionAsHost(msg.action, msg.from);
          broadcastState();
          renderAll();
        }
        return;
      }
    });

    // register self
    if(!state.players[state.me.id]){
      state.players[state.me.id] = { name: state.me.name, team: null, role: null };
    }

    // Host election window: if another host already exists, he will ping
    setTimeout(() => {
      // announce host status
      hostElectionPing();
      // send HELLO (even if client)
      sendToTransport({ t:"ACTION", room, from: state.me.id, action: { kind:"HELLO", id: state.me.id, name: state.me.name } });
      // ask state
      sendToTransport({ t:"REQ_STATE", room, from: state.me.id });
    }, 100);

    renderAll();
  }

  function connectWs(url, room){
    url = String(url||"").trim();
    room = String(room||"").trim().toUpperCase();
    if(!url || !room) return alert("WS URL + room code ?");

    disconnectAny();

    state.conn.mode = "ws";
    state.conn.room = room;
    state.conn.transport = makeWSTransport(url);
    state.conn.host = true; // tentative

    setConnStatus(`WS: ${room}`);
    setHostStatus();

    state.conn.transport.onOpen(() => {
      // announce & ask state
      sendToTransport({ t:"HOST", room, from: state.me.id });
      sendToTransport({ t:"REQ_STATE", room, from: state.me.id });
      sendToTransport({ t:"ACTION", room, from: state.me.id, action: { kind:"HELLO", id: state.me.id, name: state.me.name } });
    });

    state.conn.transport.onClose(() => {
      setConnStatus("Offline");
      state.conn.mode = "none";
      state.conn.room = null;
      state.conn.transport = null;
      state.conn.host = true;
      setHostStatus();
    });

    state.conn.transport.onMessage((msg) => {
      if(!msg || msg.room !== room) return;

      if(msg.t === "HOST" && msg.from !== state.me.id){
        // someone else host => I become client
        state.conn.host = false;
        setHostStatus();
        sendToTransport({ t:"REQ_STATE", room, from: state.me.id });
        return;
      }

      if(msg.t === "REQ_STATE"){
        if(state.conn.host) broadcastState();
        return;
      }

      if(msg.t === "STATE"){
        applySnapshot(msg.snapshot);
        return;
      }

      if(msg.t === "ACTION"){
        // if I'm host, apply; otherwise ignore (host will push STATE)
        if(state.conn.host && msg.action){
          applyActionAsHost(msg.action, msg.from);
          broadcastState();
          renderAll();
        }
        return;
      }
    });

    renderAll();
  }

  function disconnectAny(){
    try{
      if(state.conn.transport) state.conn.transport.close();
    } catch {}
    state.conn.mode = "none";
    state.conn.room = null;
    state.conn.transport = null;
    state.conn.host = true;
    setConnStatus("Offline");
    setHostStatus();
  }

  // =========================================================
  // HOST: APPLY ACTIONS (rules enforced here)
  // =========================================================
  function applyActionAsHost(action, fromTransportId){
    if(!action || !action.kind) return;

    switch(action.kind){

      case "HELLO": {
        const { id, name } = action;
        if(!state.players[id]){
          state.players[id] = { name, team: null, role: null };
        } else {
          state.players[id].name = name || state.players[id].name;
        }
        break;
      }

      case "JOIN_ROLE": {
        const { id, name, team, role } = action;

        if(!state.players[id]) state.players[id] = { name, team:null, role:null };
        state.players[id].name = name || state.players[id].name;

        // constraints: 1 WM max, 1 spy per team
        if(role === "wordmaster"){
          const existsWM = Object.entries(state.players).some(([pid,p]) => p.role === "wordmaster" && pid !== id);
          if(existsWM) return;
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
        hostNewGame({ words25: null });
        clueUI.clearFloat();
        break;
      }

      case "END_TURN": {
        hostEndTurn("manual");
        break;
      }

      case "SET_CLUE": {
        const fromId = action.fromId || fromTransportId;
        const p = state.players[fromId];
        if(!p || p.role !== "spy" || p.team !== state.game.activeTeam) return;
        const clue = action.clue;
        if(!clue?.word || typeof clue.num !== "number") return;

        state.game.clue = {
          word: String(clue.word).toUpperCase(),
          num: Number(clue.num),
          byTeam: p.team
        };
        state.game.guessesLeft = (state.game.clue.num === 0) ? 0 : (state.game.clue.num + 1);

        // Show big clue for everyone (clients will show when they receive STATE)
        break;
      }

      case "REVEAL": {
        const fromId = action.fromId || fromTransportId;
        const p = state.players[fromId];

        // only operatives of active team
        if(!p || p.role !== "ops" || p.team !== state.game.activeTeam) return;

        hostReveal(action.index);
        break;
      }

      case "SET_WORDS_25": {
        const fromId = action.fromId || fromTransportId;
        const p = state.players[fromId];
        if(!p || p.role !== "wordmaster") return;
        if(!Array.isArray(action.words25) || action.words25.length !== 25) return;

        hostNewGame({ words25: action.words25 });
        clueUI.clearFloat();
        break;
      }

      case "WM_WORDS_TEXT": {
        // optional: host can store list, purely for UI sync (not required)
        const fromId = action.fromId || fromTransportId;
        const p = state.players[fromId];
        if(!p || p.role !== "wordmaster") return;
        const list = Array.isArray(action.list) ? action.list : [];
        state.wordmaster.customWords = list.slice(0, 500);
        state.wordmaster.selected25 = [];
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

    let words = Array.isArray(words25) && words25.length === 25
      ? words25.map(String)
      : shuffle(DEFAULT_WORDS).slice(0,25);

    words = shuffle(words).map(w => String(w).toUpperCase());

    state.game.cards = words.map((w,i)=>({
      word: w,
      role: roles[i],
      revealed: false
    }));
  }

  function hostEndTurn(){
    if(state.game.gameOver) return;
    state.game.activeTeam = state.game.activeTeam === "red" ? "blue" : "red";
    state.game.clue = null;
    state.game.guessesLeft = 0;
  }

  function hostReveal(index){
    const c = state.game.cards[index];
    if(!c || c.revealed || state.game.gameOver) return;

    c.revealed = true;

    if(c.role === "assassin"){
      state.game.gameOver = true;
      // Clear clue float? keep it until end; you can choose
      return;
    }

    if(state.game.clue && state.game.guessesLeft > 0) state.game.guessesLeft--;

    const rem = computeRemaining();
    if(rem.red === 0 || rem.blue === 0){
      state.game.gameOver = true;
      return;
    }

    // wrong color ends turn
    if(c.role !== state.game.activeTeam){
      hostEndTurn();
      return;
    }

    // out of guesses ends turn
    if(state.game.clue && state.game.guessesLeft <= 0){
      hostEndTurn();
      return;
    }
  }

  // =========================================================
  // RENDER
  // =========================================================
  let lastRenderedClueKey = "";

  function renderAll(){
    // spymaster view
    if(el.center){
      if(state.me.role === "spy") el.center.classList.add("spymaster-view");
      else el.center.classList.remove("spymaster-view");
    }

    // title
    const active = state.game.activeTeam;
    const needSpy = (active === "red" && !hasSpy("red")) || (active === "blue" && !hasSpy("blue"));
    const teamName = active.toUpperCase();
    if(el.titleText) el.titleText.textContent = needSpy ? `${teamName} TEAM NEEDS A SPYMASTER` : `${teamName} TEAM TURN`;

    // role pills
    if(el.meRole) el.meRole.textContent = `You: ${roleLabel(state.me.team, state.me.role)} (${state.me.name})`;
    setHostStatus();

    // counts & players
    const rem = computeRemaining();
    if(el.redCount) el.redCount.textContent = rem.red;
    if(el.blueCount) el.blueCount.textContent = rem.blue;

    if(el.redPlayers) el.redPlayers.textContent = playersText("red");
    if(el.bluePlayers) el.bluePlayers.textContent = playersText("blue");

    // clue display lines (blue + optional red)
    const clueText = state.game.clue ? `CLUE: ${state.game.clue.word} ${state.game.clue.num}` : "CLUE: —";
    if(el.clueDisplay) el.clueDisplay.textContent = clueText;
    if(el.clueDisplayR) el.clueDisplayR.textContent = clueText;

    // hint line
    if(el.turnHint){
      if(state.game.gameOver) el.turnHint.textContent = "Game Over.";
      else el.turnHint.textContent = state.game.clue ? `Active: ${active.toUpperCase()} | guesses: ${state.game.guessesLeft}` : `Active: ${active.toUpperCase()}`;
    }

    // enable/disable clue inputs for blue + red controls if exist
    const canSet = !state.game.gameOver && state.me.role === "spy" && state.me.team === state.game.activeTeam;

    if(el.btnSetClueB) el.btnSetClueB.disabled = !canSet;
    if(el.clueWordB) el.clueWordB.disabled = !canSet;
    if(el.clueNumB) el.clueNumB.disabled = !canSet;

    if(el.btnSetClueR) el.btnSetClueR.disabled = !canSet;
    if(el.clueWordR) el.clueWordR.disabled = !canSet;
    if(el.clueNumR) el.clueNumR.disabled = !canSet;

    // show clue overlay + float exactly once per new clue update
    if(state.game.clue){
      const key = `${state.game.clue.byTeam || ""}|${state.game.clue.word}|${state.game.clue.num}`;
      if(key !== lastRenderedClueKey){
        lastRenderedClueKey = key;
        const sub = `Team ${String(state.game.clue.byTeam || "").toUpperCase()} set the clue`;
        clueUI.showBigThenFloat(`${state.game.clue.word} ${state.game.clue.num}`, sub);
      }
    }

    // render board
    renderBoard();
  }

  function renderBoard(){
    if(!el.board) return;
    el.board.innerHTML = "";

    // Always show 25 cards if game.cards empty => create quick game offline
    if(!state.game.cards || state.game.cards.length !== 25){
      hostNewGame({ words25: null });
    }

    state.game.cards.forEach((c, idx) => {
      const div = document.createElement("div");
      div.className = "card";

      if(c.revealed){
        div.classList.add("revealed", c.role);
      } else if(state.me.role === "spy"){
        div.classList.add(c.role);
      }

      div.innerHTML = `<span class="w">${escapeHtml(c.word)}</span>`;
      div.onclick = () => onCardClick(idx);
      el.board.appendChild(div);
    });
  }

  // =========================================================
  // GAME INPUT
  // =========================================================
  function join(team, role){
    state.me.team = team;
    state.me.role = role;

    // ensure registered locally
    if(!state.players[state.me.id]) state.players[state.me.id] = { name: state.me.name, team: null, role: null };

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
    // only operative of active team reveals
    if(!(state.me.role === "ops" && state.me.team === state.game.activeTeam)) return;

    sendAction({
      kind: "REVEAL",
      fromId: state.me.id,
      index: idx
    });
  }

  function setClueFromInputs(which){
    // which: "blue" | "red" (just to pick inputs)
    if(state.game.gameOver) return;
    if(!(state.me.role === "spy" && state.me.team === state.game.activeTeam)) return;

    const wEl = which === "red" ? el.clueWordR : el.clueWordB;
    const nEl = which === "red" ? el.clueNumR : el.clueNumB;
    if(!wEl || !nEl) return;

    const word = String(wEl.value || "").trim();
    const num = Number(nEl.value);

    if(!word) return alert("Enter a clue word.");
    if(!Number.isFinite(num) || num < 0) return alert("Invalid number.");

    sendAction({
      kind: "SET_CLUE",
      fromId: state.me.id,
      clue: { word: word.toUpperCase(), num: num }
    });

    renderAll();
  }

  // =========================================================
  // WORD MASTER UI
  // =========================================================
  function renderPickGrid(){
    if(!el.pickGrid || !el.wmInfo) return;

    const grid = el.pickGrid;
    grid.innerHTML = "";

    const words = state.wordmaster.customWords;
    const selected = new Set(state.wordmaster.selected25);

    el.wmInfo.textContent = `${words.length} mots détectés`;

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
        if(cb.checked) s.add(w);
        else s.delete(w);
        state.wordmaster.selected25 = Array.from(s);

        // refresh info
        el.wmInfo.textContent = `${words.length} mots détectés | sélection: ${state.wordmaster.selected25.length}/25`;
      };

      const sp = document.createElement("span");
      sp.textContent = w;

      lab.appendChild(cb);
      lab.appendChild(sp);
      grid.appendChild(lab);
    }

    el.wmInfo.textContent = `${words.length} mots détectés | sélection: ${state.wordmaster.selected25.length}/25`;
  }

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
      alert("Sélectionne exactement 25 mots (ou 'PICK 25 RANDOM').");
      return;
    }
    sendAction({
      kind: "SET_WORDS_25",
      fromId: state.me.id,
      words25: state.wordmaster.selected25
    });
  }

  function onWordsTextChange(){
    const list = normalizeWords(el.wmWords ? el.wmWords.value : "");
    state.wordmaster.customWords = list;
    state.wordmaster.selected25 = [];
    renderPickGrid();

    // optional sync: if WordMaster, push list to host so others see it too
    if(state.me.role === "wordmaster"){
      sendAction({
        kind: "WM_WORDS_TEXT",
        fromId: state.me.id,
        list
      });
    }
  }

  // =========================================================
  // TABS UI (local/ws)
  // =========================================================
  function showTab(mode){
    if(!el.tabLocal || !el.tabWs || !el.localBox || !el.wsBox) return;

    if(mode === "local"){
      el.tabLocal.classList.add("active");
      el.tabWs.classList.remove("active");
      el.localBox.classList.remove("hide");
      el.wsBox.classList.add("hide");
    } else {
      el.tabWs.classList.add("active");
      el.tabLocal.classList.remove("active");
      el.wsBox.classList.remove("hide");
      el.localBox.classList.add("hide");
    }
  }

  // =========================================================
  // EVENTS WIRING
  // =========================================================
  function wire(){
    // joins
    el.joinBlueOps && (el.joinBlueOps.onclick = () => join("blue","ops"));
    el.joinBlueSpy && (el.joinBlueSpy.onclick = () => join("blue","spy"));
    el.joinRedOps && (el.joinRedOps.onclick = () => join("red","ops"));
    el.joinRedSpy && (el.joinRedSpy.onclick = () => join("red","spy"));
    el.joinWordMaster && (el.joinWordMaster.onclick = () => join(null,"wordmaster"));

    // spymaster actions blue
    el.btnSetClueB && (el.btnSetClueB.onclick = () => setClueFromInputs("blue"));
    el.btnEndTurnB && (el.btnEndTurnB.onclick = () => sendAction({ kind:"END_TURN" }));
    el.btnNewGameB && (el.btnNewGameB.onclick = () => sendAction({ kind:"NEW_GAME" }));

    // spymaster actions red (optional)
    el.btnSetClueR && (el.btnSetClueR.onclick = () => setClueFromInputs("red"));
    el.btnEndTurnR && (el.btnEndTurnR.onclick = () => sendAction({ kind:"END_TURN" }));
    el.btnNewGameR && (el.btnNewGameR.onclick = () => sendAction({ kind:"NEW_GAME" }));

    // wordmaster ui
    el.btnOpenWords && (el.btnOpenWords.onclick = openWordsPanel);
    el.btnPick25 && (el.btnPick25.onclick = pick25Random);
    el.btnUseSelected && (el.btnUseSelected.onclick = useSelected25);
    el.wmWords && (el.wmWords.addEventListener("input", () => onWordsTextChange()));

    // tabs
    el.tabLocal && (el.tabLocal.onclick = () => showTab("local"));
    el.tabWs && (el.tabWs.onclick = () => showTab("ws"));

    // connect local
    el.btnConnectLocal && (el.btnConnectLocal.onclick = () => connectLocal(el.roomCode?.value));
    el.btnDisconnect && (el.btnDisconnect.onclick = disconnectAny);
    el.btnDisconnect2 && (el.btnDisconnect2.onclick = disconnectAny);

    // connect ws
    el.btnConnectWs && (el.btnConnectWs.onclick = () => connectWs(el.wsUrl?.value, el.wsRoom?.value));

    // admin: toggle startTeam
    el.btnAdmin && (el.btnAdmin.onclick = () => {
      state.game.startTeam = (state.game.startTeam === "red") ? "blue" : "red";
      // only host changes: broadcast
      if(state.conn.host){
        hostNewGame({ words25: null });
        broadcastState();
      } else {
        // if client, just inform (no authority)
        alert("Seul le HOST peut changer l'équipe de départ (en mode online).");
      }
      renderAll();
    });

    el.btnResetConn && (el.btnResetConn.onclick = () => {
      disconnectAny();
      clueUI.clearFloat();
      // reset identity
      state.me.id = makeId();
      state.me.name = randomName();
      state.me.team = null;
      state.me.role = null;
      // keep current game offline
      renderAll();
    });
  }

  // =========================================================
  // INIT
  // =========================================================
  function init(){
    // register self
    state.players[state.me.id] = { name: state.me.name, team: null, role: null };

    // offline initial game => 25 words visible right away
    hostNewGame({ words25: null });

    setConnStatus("Offline");
    setHostStatus();
    showTab("local");

    wire();
    renderAll();
    renderPickGrid();
  }

  init();
})();
