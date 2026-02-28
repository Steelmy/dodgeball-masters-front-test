const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const RoomManager = require("./RoomManager");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

const roomManager = new RoomManager(io);
const players = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  players[socket.id] = { id: socket.id };

  // --- Room Events ---

  socket.on("create_room", (settings, callback) => {
    const roomId = roomManager.createRoom(socket.id, settings);
    socket.join(roomId);
    socket.emit("player_role", { isHost: true });
    const room = roomManager.getRoom(roomId);
    socket.emit("current_players", room.players);
    callback({ success: true, roomId });
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  socket.on("join_room", (roomId, callback) => {
    const result = roomManager.joinRoom(roomId, socket.id);
    if (result.error) {
      callback({ success: false, error: result.error });
      return;
    }
    socket.join(roomId);
    const room = result.room;
    const newPlayer = room.players[socket.id];
    socket.to(roomId).emit("player_joined", newPlayer);
    socket.emit("current_players", room.players);
    socket.emit("player_role", { isHost: false });
    callback({ success: true, room });
    console.log(`Player ${socket.id} joined room ${roomId}`);
  });

  socket.on("update_room_settings", (settings) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const updatedRoom = roomManager.updateSettings(room.id, settings);
    if (updatedRoom) {
      io.to(room.id).emit("room_settings_updated", updatedRoom.settings);
    }
  });

  socket.on("switch_team", (teamId, callback) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (!room) {
      if (typeof callback === "function")
        callback({ success: false, error: "No room" });
      return;
    }
    const result = roomManager.switchTeam(room.id, socket.id, teamId);
    if (result && result.success) {
      io.to(room.id).emit("player_team_changed", result.player);
      io.to(room.id).emit("current_players", room.players);
      if (typeof callback === "function") callback({ success: true });
    } else {
      if (typeof callback === "function")
        callback({ success: false, error: result ? result.error : "Failed" });
    }
  });

  // --- Game Events ---

  socket.on("update_player_data", (data) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...data };
    }
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.players[socket.id]) {
      room.players[socket.id].name = data.name;
      socket.to(room.id).emit("player_updated", room.players[socket.id]);
    }
  });

  socket.on("player_move", (movementData) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) {
      socket
        .to(room.id)
        .emit("player_moved", { id: socket.id, ...movementData });
    }
  });

  // --- Host-Authoritative Game Events ---

  // Missile state from host → relay to all others
  socket.on("missile_update", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) {
      socket.to(room.id).emit("missile_update", data);
    }
  });

  // Round state from host → broadcast to ALL (including host for confirmation)
  socket.on("round_state", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.hostId === socket.id) {
      // Broadcast to everyone EXCEPT host (host already knows)
      socket.to(room.id).emit("round_state", data);
    }
  });

  // Player hit from host → broadcast to all others
  socket.on("player_hit", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.hostId === socket.id) {
      socket.to(room.id).emit("player_hit", data);
    }
  });

  // Deflect attempt from client → relay to host
  socket.on("deflect_attempt", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) {
      // Send to host only
      const hostSocket = io.sockets.sockets.get(room.hostId);
      if (hostSocket) {
        hostSocket.emit("deflect_attempt", {
          ...data,
          playerId: socket.id,
        });
      }
    }
  });

  // Missile deflected from host → broadcast to all others
  socket.on("missile_deflected", (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) {
      socket.to(room.id).emit("missile_deflected", data);
    }
  });

  // Start game
  socket.on("start_game", () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room && room.hostId === socket.id) {
      console.log(`Game started in room ${room.id}`);
      room.gameState = "PLAYING";
      const startData = {
        entities: roomManager.getRoomEntities(room.id),
      };
      io.to(room.id).emit("game_started", startData);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) {
      const result = roomManager.leaveRoom(room.id, socket.id);
      io.to(room.id).emit("player_disconnected", socket.id);
      if (result && result.newHostId) {
        io.to(result.newHostId).emit("player_role", { isHost: true });
        io.to(room.id).emit("host_changed", { hostId: result.newHostId });
      }
    }
    delete players[socket.id];
  });
});

app.get("/health", (req, res) => {
  res.send("Server is running!");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
