(function() {
    hljs.tabReplace = '    ';

    var socket = io.connect(getSocketUrl() + '/game');

    window.onbeforeunload = function() {
        socket.emit('ingame:exit', { player: user._id });
    };

    var GameState = function() {
        this.gameStatus = ko.observable('Waiting for players...');
        this.gameStatusCss = ko.observable('');
        this.countdown = ko.observable(0);
        this.countdownRunning = ko.observable(false);
        this.started = ko.observable(false);
        this.gamecode = ko.observable('');
        this.langCss = ko.observable('');
    };

    var viewModel = {
        game: new GameState()
    };

    ko.applyBindings(viewModel);

    var game = null;
    var exercise = null;

    var bindCodeCharacters = function() {
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
    };

    var pingId = null;
    var pingWaiting = function() {
        socket.emit('ingame:ping', { gameId: game._id });
        pingId = setTimeout(pingWaiting, 500);
    };

    var fullyStarted = false;
    var startGame = function() {
        if (fullyStarted) {
            return;
        }
        viewModel.game.gameStatus('Go!');
        viewModel.game.gameStatusCss('text-info control-panel-go');
        fullyStarted = true;
    };

    socket.on('ingame:ready:res', function(data) {
        console.log('received ingame:ready:res');
        game = data.game;
        exercise = data.exercise;
        viewModel.game.gamecode(data.exercise.code);
        viewModel.game.langCss('language-' + data.game.lang);

        hljs.initHighlighting();
        bindCodeCharacters();
        pingWaiting();
    });

    socket.on('ingame:ping:res', function(data) {
        console.log('received ingame:ping:res');
        game = data.game;
        viewModel.game.countdownRunning(game.starting);
        viewModel.game.started(game.started);
        if (game.starting) {
            viewModel.game.gameStatus('Get ready... ');
            viewModel.game.countdown(moment(game.startTime).diff(moment(), 'seconds') + 1);
        } else {
            viewModel.game.gameStatus('Waiting for players...');
        }

        if (game.started) {
            clearTimeout(pingId);
            startGame();
        }
    });

    console.log('emit ingame:ready');
    socket.emit('ingame:ready', { player: user._id });
})();
