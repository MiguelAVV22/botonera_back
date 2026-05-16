const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

const availableColors = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "pink",
  "cyan"
];

app.get("/", (req, res) => {
  res.send("Backend de botonera funcionando");
});

io.on("connection", (socket) => {
  console.log("Dispositivo conectado:", socket.id);

  socket.on("join_room", ({ roomId, deviceName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        selectedColors: {},
        teams: {
          A: { socketId: null, color: null, score: 0 },
          B: { socketId: null, color: null, score: 0 }
        },
        winner: null,
        locked: false
      };
    }

    rooms[roomId].players[socket.id] = {
      deviceName,
      color: null,
      team: null
    };

    io.to(roomId).emit("room_state", rooms[roomId]);
  });

  socket.on("select_team", ({ roomId, team }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Check if team is already taken
    if (room.teams[team].socketId && room.teams[team].socketId !== socket.id) {
      socket.emit("error_message", `El Equipo ${team} ya fue seleccionado.`);
      return;
    }

    // Free previous team if changing
    const player = room.players[socket.id];
    if (player.team && player.team !== team) {
      room.teams[player.team].socketId = null;
      room.teams[player.team].color = null;
    }

    player.team = team;
    room.teams[team].socketId = socket.id;

    io.to(roomId).emit("room_state", room);
    socket.emit("team_confirmed", { team });
  });

  socket.on("select_color", ({ roomId, color }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player || !player.team) {
      socket.emit("error_message", "Primero debes elegir un equipo");
      return;
    }

    if (!availableColors.includes(color)) {
      socket.emit("error_message", "Color no válido");
      return;
    }

    if (room.selectedColors[color]) {
      socket.emit("error_message", "Ese color ya fue elegido");
      return;
    }

    player.color = color;
    room.selectedColors[color] = socket.id;
    room.teams[player.team].color = color;

    io.to(roomId).emit("room_state", room);
    socket.emit("color_confirmed", { color });
  });

  socket.on("press_button", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.locked) return;

    const player = room.players[socket.id];

    if (!player || !player.color) {
      socket.emit("error_message", "Primero debes elegir un color");
      return;
    }

    room.locked = true;
    room.winner = {
      socketId: socket.id,
      deviceName: player.deviceName,
      color: player.color,
      team: player.team
    };

    io.to(roomId).emit("winner_selected", room.winner);
    io.to(roomId).emit("room_state", room);
  });

  socket.on("reset_game", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.winner = null;
    room.locked = false;

    io.to(roomId).emit("game_reset");
    io.to(roomId).emit("room_state", room);
  });

  socket.on("change_color", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (player.color) {
      delete room.selectedColors[player.color];
    }

    if (player.team) {
      room.teams[player.team].color = null;
    }

    player.color = null;

    socket.emit("color_released");
    io.to(roomId).emit("room_state", room);
  });

  socket.on("change_team", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (player.color) {
      delete room.selectedColors[player.color];
    }
    if (player.team) {
      room.teams[player.team].socketId = null;
      room.teams[player.team].color = null;
    }

    player.color = null;
    player.team = null;

    socket.emit("team_released");
    io.to(roomId).emit("room_state", room);
  });

  socket.on("reset_scores", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    if(room.teams.A) room.teams.A.score = 0;
    if(room.teams.B) room.teams.B.score = 0;
    io.to(roomId).emit("room_state", room);
  });

  socket.on("add_points", ({ roomId, team, points }) => {
    const room = rooms[roomId];
    if (!room || !room.teams[team]) return;

    room.teams[team].score += points;
    io.to(roomId).emit("room_state", room);
  });

  socket.on("disconnect", () => {
    console.log("Dispositivo desconectado:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.players[socket.id]) {
        const player = room.players[socket.id];

        if (player.color) {
          delete room.selectedColors[player.color];
        }

        if (player.team && room.teams[player.team].socketId === socket.id) {
          room.teams[player.team].socketId = null;
          room.teams[player.team].color = null;
        }

        delete room.players[socket.id];

        io.to(roomId).emit("room_state", room);
      }
    }
  });
});

const PORT = 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Socket.IO corriendo en puerto ${PORT}`);
});