import { WebSocketServer } from "ws";
import http from "http";

const server = http.createServer();
const wss = new WebSocketServer({ server });

const rooms = {}; 
// rooms[roomCode] = { clients: Set<ws>, state: {...} }

wss.on("connection", (ws) => {
  ws.room = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    const { t, room } = msg;
    if (!room) return;

    // JOIN ROOM
    if (t === "JOIN") {
      ws.room = room;

      if (!rooms[room]) {
        rooms[room] = {
          clients: new Set(),
          state: null
        };
      }

      rooms[room].clients.add(ws);

      // envoyer l’état existant si présent
      if (rooms[room].state) {
        ws.send(JSON.stringify({
          t: "STATE",
          snapshot: rooms[room].state
        }));
      }

      return;
    }

    // ACTION
    if (t === "ACTION") {
      if (!ws.room || !rooms[ws.room]) return;

      // sauvegarder le dernier état
      if (msg.snapshot) {
        rooms[ws.room].state = msg.snapshot;
      }

      // broadcast à la room
      rooms[ws.room].clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(msg));
        }
      });
    }
  });

  ws.on("close", () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room].clients.delete(ws);
      if (rooms[ws.room].clients.size === 0) {
        delete rooms[ws.room]; // nettoyage
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("WS server running on port", PORT);
});
