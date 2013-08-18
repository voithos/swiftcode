(function() {
    var socket = io.connect(getSocketUrl() + '/game');

    window.onbeforeunload = function() {
        socket.emit('ingame:exit', { player: user._id });
    };
})();
