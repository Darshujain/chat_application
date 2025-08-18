import React, { useState, useEffect } from "react";
import queryString from 'query-string';
import io from "socket.io-client";

import TextContainer from '../TextContainer/TextContainer';
import Messages from '../Messages/Messages';
import InfoBar from '../InfoBar/InfoBar';
import Input from '../Input/Input';

import './Chat.css';

const ENDPOINT = 'http://localhost:5000';

let socket;

const Chat = ({ location }) => {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  // Join room
  useEffect(() => {
    const { name, room } = queryString.parse(location.search);

    socket = io(ENDPOINT);

    setName(name);
    setRoom(room);

    socket.emit('join', { name, room }, (error) => {
      if (error) alert(error);
    });

    // Cleanup to prevent duplicate connections
    return () => {
      socket.disconnect();
      socket.off();
    };
  }, [location.search]);

  // Listeners for messages and room data
  useEffect(() => {
    const messageHandler = (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    };

    const roomDataHandler = ({ users }) => {
      setUsers(users);
    };

    socket.on('message', messageHandler);
    socket.on('roomData', roomDataHandler);

    // Cleanup listeners to prevent duplicates
    return () => {
      socket.off('message', messageHandler);
      socket.off('roomData', roomDataHandler);
    };
  }, []);

  const sendMessage = (event) => {
    event.preventDefault();
    if (message) {
      socket.emit('sendMessage', message, () => setMessage(''));
    }
  }

  return (
    <div className="outerContainer">
      <div className="container">
        <InfoBar room={room} />
        <Messages messages={messages} name={name} />
        <Input message={message} setMessage={setMessage} sendMessage={sendMessage} />
      </div>
      <TextContainer users={users} />
    </div>
  );
}

export default Chat;
