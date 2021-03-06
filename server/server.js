const io = require('socket.io')({
  cors: { origin: '*' }
});

const { 
  initGame,
  gameLoop,
  getUpdatedVelocity,
} = require('./game');

const {
  generateId,
} = require('./utils')

const { 
  FRAME_RATE, 
  DEFAULT_ID_LENGTH 
} = require('./constants');

const state = {};
const clientRooms = {};

io.on('connection', client => {

  client.on('keydown', handleKeyDown);
  client.on('newGame', handleNewGame);
  client.on('joinGame', handleJoinGame);

  function handleNewGame() {
    let roomName = generateId(DEFAULT_ID_LENGTH); 
    clientRooms[client.id] = roomName;
    client.emit('gameCode', roomName);

    state[roomName] = initGame();

    client.join(roomName);
    client.number = 1;
    client.emit('init', 1);
  }

  function handleJoinGame(gameCode) {
    const room = io.sockets.adapter.rooms.get(gameCode);
    let numClients = 0,
    allUsers;

    if (room) allUsers = room.size;
    if (allUsers) numClients = allUsers;
    if (numClients === 0) {
      client.emit('unknownGame');
      return;
    } else if (numClients > 1) {
      client.emit('tooManyPlayers');
      return;
    }

    clientRooms[client.id] = gameCode;
    client.join(gameCode);
    client.number = 2;
    client.emit('gameCode', gameCode);
    client.emit('init', 2);

    startGameInterval(gameCode);
  }

  function handleKeyDown(keyCode) {
    const roomName = clientRooms[client.id];

    if (!roomName) return;

    try {
      keyCode = parseInt(keyCode);
    } catch (e) {
      console.error(e);
      return;
    }

    const vel = getUpdatedVelocity(keyCode, state[roomName].players[client.number - 1].vel);

    if (vel) state[roomName].players[client.number - 1].vel = vel; 
  }
});

function startGameInterval(roomName) {
  const intervalId = setInterval(() => {
    const winner = gameLoop(state[roomName]);

    if (!winner) {
      emitGameState(roomName, state[roomName]);
    } else {
      emitGameOver(roomName, winner);
      state[roomName] = null;
      clearInterval(intervalId);
    }

  }, 1000 / FRAME_RATE);
}

function emitGameState(roomName, state) {
  io.sockets.in(roomName)
    .emit('gameState', JSON.stringify(state));
}

function emitGameOver(roomName, winner) {
  io.sockets.in(roomName)
    .emit('gameOver', JSON.stringify({ winner }));
}

io.listen(1010);