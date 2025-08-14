const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');
require('dotenv').config(); // For OpenAI API Key

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.get('/', (req, res) => {
  res.send('Server is running');
});

// ------------------- USER MANAGEMENT -------------------
const users = [];

const addUser = ({ id, name, room }) => {
  name = name.trim().toLowerCase();
  room = room.trim().toLowerCase();

  const existingUser = users.find(user => user.room === room && user.name === name);
  if (existingUser) return { error: 'Username is taken in this room' };

  const user = { id, name, room };
  users.push(user);
  return { user };
};

const removeUser = (id) => {
  const index = users.findIndex(user => user.id === id);
  if (index !== -1) return users.splice(index, 1)[0];
};

const getUser = (id) => users.find(user => user.id === id);

const getUsersInRoom = (room) => users.filter(user => user.room === room);

// ------------------- SOCKET CONNECTION -------------------
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Join room
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });
    if (error) return callback(error);

    socket.join(user.room);

    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}` });
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  // Send message + AI Auto reply
  socket.on('sendMessage', async (message, callback) => {
    const user = getUser(socket.id);

    if (user) {
      // Send user message to room
      io.to(user.room).emit('message', { user: user.name, text: message });

      // Bot reply after 0.5 sec
      setTimeout(async () => {
        try {
          const msg = message.toLowerCase();
          let botReply;

          if (msg.includes('hello') || msg.includes('hi')) {
            botReply = `Hi ${user.name}! 👋`;
          } else if (msg.includes('time')) {
            botReply = `⏱️ Current time: ${new Date().toLocaleTimeString()}`;
          } else if (msg.includes('joke')) {
            botReply = "😂 Why don't programmers like nature? It has too many bugs!";
          } else {
            // Ask OpenAI for reply
            const aiResponse = await openai.responses.create({
              model: "gpt-4o-mini",
              input: `Reply to this message in 1–2 short sentences: ${message}`
            });
            botReply = aiResponse.output_text.trim();
          }

          io.to(user.room).emit('message', { user: 'bot', text: botReply });
        } catch (error) {
          console.error("AI Error:", error);
          io.to(user.room).emit('message', { user: 'bot', text: "⚠️ Sorry, I couldn't process that." });
        }
      }, 500);
    }

    callback();
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit('message', { user: 'admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    }
  });
});

// ------------------- START SERVER -------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
