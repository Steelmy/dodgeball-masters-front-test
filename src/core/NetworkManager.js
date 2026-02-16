import { io } from "socket.io-client";

/**
 * NetworkManager
 * Handles all multiplayer communication with the backend server.
 */
class NetworkManagerClass {
  constructor() {
    this.socket = null;
    this.isConnected = false;

    // Server URL
    this.serverUrl =
      import.meta.env.VITE_SERVER_URL ||
      `http://${window.location.hostname}:3000`;

    // Event callbacks
    this.callbacks = {
      onConnect: [],
      onDisconnect: [],
      onPlayerJoined: [],
      onPlayerMoved: [],
      onPlayerDisconnected: [],
      onCurrentPlayers: [],
      onMissileUpdate: [],
      onMissileDeflected: [],
      onPlayerRole: [],
      onGameStarted: [],
      onPlayerTeamChanged: [],
      onRoomSettingsUpdated: [],
      // Host-authoritative events
      onRoundState: [],
      onPlayerHit: [],
      onDeflectAttempt: [],
    };

    this.connectedPlayers = {};
    this.isHost = false;
  }

  /**
   * Connect to the game server
   */
  connect() {
    console.log(`Connecting to server at ${this.serverUrl}...`);
    this.socket = io(this.serverUrl);

    this.socket.on("connect", () => {
      console.log(`Connected to server! ID: ${this.socket.id}`);
      this.isConnected = true;
      this.connectedPlayers = {};
      this.trigger("onConnect", this.socket.id);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.isConnected = false;
      this.isHost = false;
      this.connectedPlayers = {};
      this.trigger("onDisconnect");
    });

    // --- Room/Lobby Events ---
    this.socket.on("current_players", (players) => {
      this.connectedPlayers = players;
      this.trigger("onCurrentPlayers", players);
    });

    this.socket.on("player_joined", (player) => {
      this.connectedPlayers[player.id] = player;
      this.trigger("onPlayerJoined", player);
    });

    this.socket.on("player_moved", (player) =>
      this.trigger("onPlayerMoved", player),
    );

    this.socket.on("player_team_changed", (player) => {
      if (!this.connectedPlayers[player.id]) {
        this.connectedPlayers[player.id] = player;
      } else {
        this.connectedPlayers[player.id].team = player.team;
      }
      this.trigger("onPlayerTeamChanged", player);
    });

    this.socket.on("player_disconnected", (id) => {
      delete this.connectedPlayers[id];
      this.trigger("onPlayerDisconnected", id);
    });

    this.socket.on("player_role", (data) => {
      this.isHost = data.isHost;
      console.log("Role assigned: Host =", this.isHost);
      this.trigger("onPlayerRole", data);
    });

    // --- Game Events ---
    this.socket.on("game_started", (data) =>
      this.trigger("onGameStarted", data),
    );

    this.socket.on("room_settings_updated", (data) =>
      this.trigger("onRoomSettingsUpdated", data),
    );

    // --- Host-Authoritative Events ---
    this.socket.on("missile_update", (data) =>
      this.trigger("onMissileUpdate", data),
    );

    this.socket.on("missile_deflected", (data) =>
      this.trigger("onMissileDeflected", data),
    );

    // Round lifecycle from host (countdown, playing, round_end with scores)
    this.socket.on("round_state", (data) => this.trigger("onRoundState", data));

    // Player hit from host (target ID, damage)
    this.socket.on("player_hit", (data) => this.trigger("onPlayerHit", data));

    // Deflect attempt from client (only received by host)
    this.socket.on("deflect_attempt", (data) =>
      this.trigger("onDeflectAttempt", data),
    );
  }

  // --- Send Methods ---

  joinGame(userData) {
    if (!this.socket) return;
    this.socket.emit("join_game", userData);
  }

  switchTeam(teamId) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        resolve({ success: false, error: "Not connected" });
        return;
      }
      this.socket.emit("switch_team", teamId, (response) => {
        resolve(response);
      });
    });
  }

  sendMovement(position, rotation) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("player_move", {
      x: position.x,
      y: position.y,
      z: position.z,
      rotation: rotation,
    });
  }

  sendPlayerData(data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("update_player_data", data);
  }

  sendMissileUpdate(data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("missile_update", data);
  }

  sendMissileDeflect(data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("missile_deflected", data);
  }

  /**
   * Host broadcasts round state to all clients
   * @param {Object} data - { type: 'countdown'|'playing'|'round_end', ... }
   */
  sendRoundState(data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("round_state", data);
  }

  /**
   * Host broadcasts that a player was hit
   * @param {Object} data - { targetId, damage }
   */
  sendPlayerHit(data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("player_hit", data);
  }

  /**
   * Client sends deflect attempt to host for evaluation
   * @param {Object} data - { position, facingDirection }
   */
  sendDeflectAttempt(data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit("deflect_attempt", data);
  }

  updateRoomSettings(settings) {
    if (!this.socket || !this.isConnected || !this.isHost) return;
    this.socket.emit("update_room_settings", settings);
  }

  createRoom(settings) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        resolve({ success: false, error: "Not connected" });
        return;
      }
      this.socket.emit("create_room", settings, (response) => {
        if (response.success) {
          this.isHost = true;
        }
        resolve(response);
      });
    });
  }

  joinRoom(roomId) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        resolve({ success: false, error: "Not connected" });
        return;
      }
      this.socket.emit("join_room", roomId, (response) => {
        if (response.success) {
          this.isHost = false;
        }
        resolve(response);
      });
    });
  }

  startGame() {
    if (!this.socket || !this.isConnected || !this.isHost) return;
    this.socket.emit("start_game");
  }

  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((cb) => cb(data));
    }
  }
}

export const NetworkManager = new NetworkManagerClass();
