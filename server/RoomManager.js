class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = {};
  }

  createRoom(hostId, settings = {}) {
    const roomId = this.generateRoomId();
    const teamSize = settings.teamSize || 1;
    this.rooms[roomId] = {
      id: roomId,
      hostId: hostId,
      players: {},
      gameState: "LOBBY",
      settings: {
        maxPlayers: teamSize * 2,
        teamSize: teamSize,
        map: settings.map || "orbital",
      },
      createdAt: Date.now(),
    };

    // Add host to Blue team
    this.addPlayerToRoom(roomId, hostId, true);

    return roomId;
  }

  updateSettings(roomId, settings) {
    const room = this.rooms[roomId];
    if (!room) return;

    const newTeamSize = parseInt(settings.teamSize) || room.settings.teamSize;

    room.settings = {
      ...room.settings,
      map: settings.map || room.settings.map,
      teamSize: newTeamSize,
      maxPlayers: newTeamSize * 2,
    };

    // Re-balance teams if needed after team size change
    this.rebalanceTeams(room);

    return room;
  }

  joinRoom(roomId, playerId) {
    const room = this.rooms[roomId];
    if (!room) return { error: "Room not found" };
    if (room.gameState !== "LOBBY") return { error: "Game already started" };

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= room.settings.maxPlayers) return { error: "Room full" };

    this.addPlayerToRoom(roomId, playerId, false);
    return { success: true, room };
  }

  addPlayerToRoom(roomId, playerId, isHost) {
    const room = this.rooms[roomId];

    // Auto-assign team: always put on the team with fewer players
    const blueCount = Object.values(room.players).filter(
      (p) => p.team === "BLUE",
    ).length;
    const redCount = Object.values(room.players).filter(
      (p) => p.team === "RED",
    ).length;

    const team = blueCount <= redCount ? "BLUE" : "RED";

    room.players[playerId] = {
      id: playerId,
      team: team,
      isBot: false,
      isHost: isHost,
      name: null,
    };

    console.log(
      `[RoomManager] Player ${playerId} added to ${team} (blue=${blueCount}, red=${redCount})`,
    );
  }

  /**
   * Re-balance teams after settings change.
   */
  rebalanceTeams(room) {
    const teamSize = room.settings.teamSize;
    const players = Object.values(room.players);
    const blue = players.filter((p) => p.team === "BLUE");
    const red = players.filter((p) => p.team === "RED");

    while (blue.length > teamSize && red.length < teamSize) {
      const moved = blue.pop();
      moved.team = "RED";
      red.push(moved);
    }

    while (red.length > teamSize && blue.length < teamSize) {
      const moved = red.pop();
      moved.team = "BLUE";
      blue.push(moved);
    }
  }

  switchTeam(roomId, playerId, targetTeam) {
    const room = this.rooms[roomId];
    if (!room || !room.players[playerId]) return;

    const player = room.players[playerId];
    const newTeam = targetTeam || (player.team === "BLUE" ? "RED" : "BLUE");

    if (player.team === newTeam) return { success: true, player };

    // Check if new team is full
    const teamCount = Object.values(room.players).filter(
      (p) => p.team === newTeam,
    ).length;
    if (teamCount >= room.settings.teamSize) return { error: "Team full" };

    player.team = newTeam;
    console.log(`[RoomManager] Player ${playerId} switched to ${newTeam}`);
    return { success: true, player };
  }

  leaveRoom(roomId, playerId) {
    const room = this.rooms[roomId];
    if (!room) return;

    delete room.players[playerId];

    if (Object.keys(room.players).length === 0) {
      delete this.rooms[roomId];
      return;
    }

    if (room.hostId === playerId) {
      const nextPlayerId = Object.keys(room.players)[0];
      room.hostId = nextPlayerId;
      room.players[nextPlayerId].isHost = true;
      return { newHostId: nextPlayerId };
    }
  }

  getRoom(roomId) {
    return this.rooms[roomId];
  }

  /**
   * Get entities for a game room — multiplayer = players only, NO bots.
   */
  getRoomEntities(roomId) {
    const room = this.rooms[roomId];
    if (!room) return {};

    const entities = {};
    Object.keys(room.players).forEach((id) => {
      entities[id] = { ...room.players[id] };
    });

    console.log(
      `[RoomManager] getRoomEntities: ${Object.keys(entities).length} players`,
      Object.keys(entities),
    );
    return entities;
  }

  getPlayerRoom(playerId) {
    return Object.values(this.rooms).find((r) => r.players[playerId]);
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }
}

module.exports = RoomManager;
