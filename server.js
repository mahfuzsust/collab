
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);

app.use('/public', express.static('public'));

app.get('/:id', (req, res) => {
    const fileDirectory = path.resolve(__dirname);
    res.sendFile('index.html', { root: fileDirectory }, (err) => {
        res.end();
        if (err) throw (err);
    });
});
app.get('/', (req, res) => {
    res.redirect(307, '/' + uuidv4());
});

let roomMembers = {};
let socketRoom = {};

io.on("connection", socket => {
    console.log('socket connected..', socket.id);

    socket.on('content_change', (data) => {
        const room = data.documentId;
        socket.to(room).emit('content_change', data.changes);
    });

    socket.on('register', function (data) {
        const room = data.documentId;
        socket.join(room);

        socketRoom[socket.id] = room;
        if (roomMembers[room]) {
            roomMembers[room].push({ id: socket.id, name: data.handle });
        } else {
            roomMembers[room] = [{ id: socket.id, name: data.handle }];
        }

        socket.to(room).emit('register', { id: socket.id, name: data.handle });
        io.in(room).emit('members', roomMembers[room]);
    });
    socket.on('disconnect', function (data) {
        console.log("Disconnected")
        let room = socketRoom[socket.id];
        if (room) {
            roomMembers[room] = roomMembers[room].filter(function (item) {
                return item.id !== socket.id
            });
            if (roomMembers[room].length == 0) {
                delete roomMembers[room];
            }
            delete socketRoom[socket.id];
            socket.to(room).emit('user_left', { id: socket.id });
        }
    });
});

httpServer.listen(3000);