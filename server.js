
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer);
const { createClient } = require('redis');
const redisAdapter = require('@socket.io/redis-adapter');
const expirationSeconds = 12 * 60 * 60;

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
    res.redirect(307, '/' + uuidv4());
});


io.on("connection", socket => {
    console.log('socket connected..', socket.id);

    socket.on('content_change', (data) => {
        const room = data.documentId;
        socket.to(room).emit('content_change', data.changes);
    });

    socket.on('register', function (data) {
        const room = data.documentId;
        socket.join(room);

        pubClient.set("room_" + socket.id, room);
        pubClient.expire("room_" + socket.id, expirationSeconds);

        pubClient.get("members_" + room, function (err, membersResponse) {
            let members;
            if (membersResponse) {
                members = JSON.parse(membersResponse)
                members.push({ id: socket.id, name: data.handle });
            } else {
                members = [{ id: socket.id, name: data.handle }];
            }
            pubClient.set("members_" + room, JSON.stringify(members));
            pubClient.expire("members_" + room, expirationSeconds);

            io.in(room).emit('members', members);
        });

        socket.to(room).emit('register', { id: socket.id, name: data.handle });
    });
    socket.on('disconnect', function (data) {
        console.log("Disconnected")

        pubClient.get("room_" + socket.id, function (err, room) {
            if (room) {
                pubClient.get("members_" + room, function (err2, membersResponse) {
                    if (membersResponse) {
                        let members = JSON.parse(membersResponse)
                        members = members.filter(function (item) {
                            return item.id !== socket.id
                        });

                        if (members.length == 0) {
                            pubClient.del("members_" + room);
                        } else {
                            pubClient.set("members_" + room, JSON.stringify(members));
                            pubClient.expire("members_" + room, expirationSeconds);
                        }
                    }
                });
                pubClient.del("room_" + socket.id);
                socket.to(room).emit('user_left', { id: socket.id });
            }
        });

    });
});

httpServer.listen(process.env.PORT || 3000);