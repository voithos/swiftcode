(function() {
    var socket = io.connect(getQualifiedHost() + '/game');

    window.onbeforeunload = function() {
        socket.emit('ingame:exit', { player: user._id });
    };
})();
