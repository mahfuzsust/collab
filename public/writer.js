"use strict"
window.onload = function () {
    let socket;
    const url = new URL(window.location.href);
    const documentId = url.pathname.substring(1) || 'abcd';

    const handle = document.getElementById('handle');
    const register = document.getElementById('register');

    const textarea = document.getElementById('textarea');

    const editor = CKEDITOR.instances.textarea;

    let syncValue = Array();
    let keypressed = false;

    function addEditor(writer) {
        var ul = document.getElementById("editors");
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(writer.name));
        li.className = "list-group-item";
        li.id = writer.id;
        ul.appendChild(li);
    }

    function removeElement(id) {
        var elem = document.getElementById(id);
        return elem.parentNode.removeChild(elem);
    }
    function setSocketEvents() {
        socket.on('content_change', (incomingChanges) => {
            let input = Array.from(syncValue);
            applyChanges(input, incomingChanges);

            if (keypressed && editor.checkDirty()) {
                let currentData = editor.getData();
                let output = Array.from(currentData);
                let localChanges = getChanges(input, output);

                socket.emit('content_change', {
                    documentId: documentId,
                    changes: localChanges
                });
                applyChanges(input, localChanges);
            }
            let ranges = editor.getSelection().getRanges();
            keypressed = false;
            editor.setData(input.join(''));
            editor.getSelection().selectRanges(ranges);
            editor.resetDirty();
            syncValue = input;
        });
        socket.on('register', (data) => {
            addEditor(data);
        });

        socket.on('user_left', (data) => {
            removeElement(data.id);
        });
        socket.on('members', (members) => {
            members.forEach(member => {
                addEditor(member);
            });
            socket.off('members');
        });
    }

    function registerUserListener() {
        handle.style.display = 'none';
        register.style.display = 'none';

        const editorBlock = document.getElementById('editor-block');
        editorBlock.style.display = 'block';
        syncValue = "";
        textarea.value = syncValue;
        socket = io();
        socket.emit('register', {
            handle: handle.value,
            documentId: documentId
        });
        setSocketEvents();
    }

    function getChanges(input, output) {
        return diffToChanges(diff(input, output), output);
    }

    function applyChanges(input, changes) {
        changes.forEach(change => {
            if (change.type == 'insert') {
                input.splice(change.index, 0, ...change.values);
            } else if (change.type == 'delete') {
                input.splice(change.index, change.howMany);
            }
        });
    }

    function syncData() {
        if (keypressed && editor.checkDirty()) {
            const currentData = editor.getData();
            let input = Array.from(syncValue);
            let output = Array.from(currentData);
            let changes = getChanges(input, output);
            applyChanges(input, changes);
            if (output.join('') == input.join('')) {
                socket.emit('content_change', {
                    documentId: documentId,
                    changes: changes
                });
                editor.resetDirty();
                syncValue = input;
            }
            keypressed = false;
        }
    }

    var timeout = setTimeout(null, 0);
    editor.on('key', () => {
        clearTimeout(timeout);
        keypressed = true;
        timeout = setTimeout(syncData, 1000);
    });

    register.addEventListener('click', registerUserListener);

}
