(function() {
    hljs.tabReplace = '    ';

    var socket = io.connect(getSocketUrl() + '/game');

    window.onbeforeunload = function() {
        socket.emit('ingame:exit', { player: user._id });
    };

    var GameState = function() {
        this.gameStatus = ko.observable('Waiting for players...');
        this.countdown = ko.observable(0);
        this.countdownRunning = ko.observable(false);
        this.gamecode = ko.observable('');
    };

    var viewModel = {
        game: new GameState(),
        bindCodeCharacters: function() {
            var pattern = '<span class="code-char">$&</span>';
            $('#gamecode').contents().each(function() {
                var $this = $(this);
                // Strip comments
                if (!$this.hasClass('comment')) {
                    // NodeType 3 === Text Node
                    if (this.nodeType === 3) {
                        $this.replaceWith($this.text().replace(/(\w)/g, pattern));
                    } else {
                        $this.html($this.text().replace(/(\w)/g, pattern));
                    }
                }
            });
        }
    };

    var game = null;

    ko.applyBindings(viewModel);

    socket.on('ingame:ready:res', function(data) {
        console.log('received ingame:ready:res');
        game = data.game;
        viewModel.game.gamecode(data.gameCode);

        hljs.initHighlighting();
        viewModel.bindCodeCharacters();
    });

    console.log('emit ingame:ready');
    socket.emit('ingame:ready', { player: user._id });
})();
