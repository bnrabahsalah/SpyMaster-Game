const http = require("http");
const { WebSocketServer } = require("ws");

/**
 * Protocole supporté (simple) :
 * - Client -> Server: { t:"JOIN", room, id, name, avatar }
 * - Client -> Server: { t:"ACTION", room, from, action }
 * - Server -> Clients: { t:"STATE", room, snapshot }
 *
 * IMPORTANT: Ton client envoie/attend déjà ce genre de messages.
 */

const PORT = process.env.PORT || 8080;

// rooms[roomCode] = { clients:Set<ws>, hostId:string|null, lastState:any|null }
const rooms = Object.create(null);

function getRoom(code) {
  if (!rooms[code]) {
    rooms[code] = { clients: new Set(), hostId: null, lastState: null };
  }
  return rooms[code];
}

function safeSend(ws, obj) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
  }
}

function broadcast(room, obj) {
  for (const ws of room.clients) safeSend(ws, obj);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("SpyMaster WS server is running.\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws._room = null;
  ws._id = null;

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
    if (!msg || !msg.t) return;

    // JOIN
    if (msg.t === "JOIN") {
      const roomCode = String(msg.room || "").trim().toUpperCase();
      if (!roomCode) return;

      const room = getRoom(roomCode);

      ws._room = roomCode;
      ws._id = String(msg.id || "");

      room.clients.add(ws);

      // host election: first connected becomes host
      if (!room.hostId) room.hostId = ws._id;

      // If we already have a state snapshot, send it to new client
      if (room.lastState) {
        safeSend(ws, { t: "STATE", room: roomCode, snapshot: room.lastState });
      }

      // Inform (optional)
      safeSend(ws, {
        t: "INFO",
        room: roomCode,
        hostId: room.hostId
      });

      return;
    }

    // Must be in a room for other messages
    const roomCode = ws._room;
    if (!roomCode) return;
    const room = getRoom(roomCode);

    // ACTION: forward to host
    if (msg.t === "ACTION") {
      // find host ws
      let hostWs = null;
      for (const c of room.clients) {
        if (c._id && c._id === room.hostId) {
          hostWs = c;
          break;
        }
      }
      // If host missing, re-elect
      if (!hostWs) {
        const first = room.clients.values().next().value || null;
        room.hostId = first?._id || null;
        hostWs = first;
      }
      if (hostWs) safeSend(hostWs, msg);
      return;
    }

    // HOST -> STATE (snapshot authority)
    if (msg.t === "STATE") {
      // accept only from host
      if (ws._id !== room.hostId) return;
      room.lastState = msg.snapshot || null;
      broadcast(room, { t: "STATE", room: roomCode, snapshot: room.lastState });
      return;
    }
  });

  ws.on("close", () => {
    const roomCode = ws._room;
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    room.clients.delete(ws);

    // if host left, re-elect
    if (ws._id && ws._id === room.hostId) {
      const next = room.clients.values().next().value || null;
      room.hostId = next?._id || null;
    }

    // cleanup empty room
    if (room.clients.size === 0) {
      delete rooms[roomCode];
    }
  });
});

server.listen(PORT, () => {
  console.log("WS server listening on port", PORT);
});
