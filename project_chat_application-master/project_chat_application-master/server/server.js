const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const { Configuration, OpenAIApi } = require("openai");
const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// OpenAI config
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

io.on('connection', (socket) => {
  console.log("New connection:", socket.id);

  // User joining
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.join(user.room);

    socket.emit('message', { user: 'bot', text: `Hi ${user.name}! 👋` });
    socket.broadcast
      .to(user.room)
      .emit('message', { user: 'bot', text: `${user.name} has joined!` });

    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  // Message send
  socket.on('sendMessage', async (message, callback) => {
    const user = getUser(socket.id);

    if (!user) {
      console.log("⚠️ User not found for socket:", socket.id);
      if (callback) callback("User not found");
      return;
    }

    io.to(user.room).emit('message', { user: user.name, text: message });

    try {
      const aiResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a friendly chatbot. Reply naturally to the user's message.",
          },
          { role: "user", content: message },
        ],
      });

      const botReply = aiResponse.data.choices[0].message.content;
      io.to(user.room).emit('message', { user: 'bot', text: botReply });
    } catch (error) {
      console.error("AI error:", error.message);
      io.to(user.room).emit('message', { user: 'bot', text: "⚠️ Sorry, AI is not responding." });
    }

    if (callback) callback();
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit('message', { user: 'bot', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    }
  });
});

server.listen(5000, () => console.log(`🚀 Server running on port 5000`));
