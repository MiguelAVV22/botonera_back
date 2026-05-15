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
        winner: null,
        locked: false
      };
    }

    rooms[roomId].players[socket.id] = {
      deviceName,
      color: null
    };

    io.to(roomId).emit("room_state", rooms[roomId]);
  });

  socket.on("select_color", ({ roomId, color }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (!availableColors.includes(color)) {
      socket.emit("error_message", "Color no válido");
      return;
    }

    if (room.selectedColors[color]) {
      socket.emit("error_message", "Ese color ya fue elegido");
      return;
    }

    room.players[socket.id].color = color;
    room.selectedColors[color] = socket.id;

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
      color: player.color
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

  socket.on("disconnect", () => {
    console.log("Dispositivo desconectado:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.players[socket.id]) {
        const color = room.players[socket.id].color;

        if (color) {
          delete room.selectedColors[color];
        }

        delete room.players[socket.id];

        io.to(roomId).emit("room_state", room);
      }
    }
  });
});

const PORT = 3001;

server.listen(PORT, () => {
  console.log(`Servidor Socket.IO corriendo en http://localhost:${PORT}`);
});