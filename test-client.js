const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");

socket.on("connect", () => {
  console.log("Conectado como:", socket.id);

  socket.emit("join_room", {
    roomId: "sala1",
    deviceName: "Celular de prueba"
  });

  setTimeout(() => {
    socket.emit("select_color", {
      roomId: "sala1",
      color: "red"
    });
  }, 1000);

  setTimeout(() => {
    socket.emit("press_button", {
      roomId: "sala1"
    });
  }, 2000);
});

socket.on("room_state", (data) => {
  console.log("Estado de sala:", data);
});

socket.on("color_confirmed", (data) => {
  console.log("Color confirmado:", data);
});

socket.on("winner_selected", (data) => {
  console.log("Ganador:", data);
});

socket.on("error_message", (msg) => {
  console.log("Error:", msg);
});