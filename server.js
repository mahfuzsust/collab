
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);
const { createClient } = require('redis');
const redisAdapter = require('@socket.io/redis-adapter');

const pubClient = createClient({
    host: process.env.REDIS_ENDPOINT || 'localhost',
    port: process.env.REDIS_PORT || 6379
});
if (process.env.REDIS_PASSWORD) {
    pubClient.auth(process.env.REDIS_PASSWORD);
}
const subClient = pubClient.duplicate();
io.adapter(redisAdapter(pubClient, subClient));

app.use('/public', express.static('public'));

app.get('/:id', (req, res) => {
    const fileDirectory = path.resolve(__dirname);
    res.sendFile('index.html', { root: fileDirectory }, (err) => {
        if (err) {
            console.error(err);
            throw (err);
        }
        res.end();
    });
});
app.get('/', (req, res) => {
    let host = process.env.HOST_NAME || 'abcd';
    res.redirect(307, '/' + uuidv4() + '?host=' + host);
});


io.on("connection", socket => {
    console.log('socket connected..', socket.id);

    console.log(process.env.HOST_NAME);

    socket.on('content_change', (data) => {
        const room = data.documentId;
        socket.to(room).emit('content_change', data.changes);
    });

    socket.on('register', function (data) {
        const room = data.documentId;
        socket.nickname = data.handle;
        socket.join(room);
        let members = [];
        for (const clientId of io.sockets.adapter.rooms.get(room)) {
            members.push({
                id: clientId,
                name: io.sockets.sockets.get(clientId).nickname
            });
        }
        console.log(members);
        io.in(room).emit('members', members);
        socket.to(room).emit('register', { id: socket.id, name: data.handle });
    });
    socket.on('disconnect', function (data) {
        console.log("Disconnected");
        socket.broadcast.emit('user_left', { id: socket.id });
    });
});

httpServer.listen(process.env.PORT || 3000);