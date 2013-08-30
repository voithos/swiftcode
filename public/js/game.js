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

    var $gamecode = null;

    var game = null;
    var exercise = null;
    var nonTypeables = null;
    var currentPos = 0;
    var $currentChar = null;

    var isTextNode = function(elem) {
        return elem.nodeType === 3;
    };

    var bindCodeCharacters = function() {
        var searchPattern = /(.)([ \t]*\n\s*)|([ \t]*\n\s*)(.)|(.)/g;
        var newlinePattern = /^[ \t]*\n\s*$/g;
        var returnSymbol = '<span class="code-char return-char"></span>';

        var replacer = function(str, $1, $2, $3, $4, $5) {
            $1 = $1 || '';
            $2 = $2 || '';
            $3 = $3 || '';
            $4 = $4 || '';
            $5 = $5 || '';

            // If newline groups matched anything, add the
            // return symbol to the match
            if ($2) {
                $2 = returnSymbol + $2;
            }
            if ($3) {
                $3 = returnSymbol + $3;
            }
            return $3 + '<span class="code-char">' + $1 + $4 + $5 + '</span>' + $2;
        };

        $gamecode = $('#gamecode');

        var nonWhitespaceFound = false;
        var $contents = $gamecode.contents();
        $contents.each(function(i) {
            var $this = $(this);

            if ($this.is(nonTypeables)) {
                return;
            }

            var text = $this.text(),
                parts, prefix = '', addon = '';
            if (isTextNode(this)) {
                if (nonWhitespaceFound) {
                    if (i > 0 && $contents.eq(i - 1).is(nonTypeables)) {
                        parts = (/(\s+)((?:.|\n)*)$/g).exec(text);
                        if (parts) {
                            text = parts[2];
                            prefix = parts[1];
                        }
                    }
                    if (text.match(newlinePattern)) {
                        $this.replaceWith(returnSymbol + text);
                        return;
                    }
                    if (i < $contents.length - 1 && $contents.eq(i + 1).is(nonTypeables)) {
                        parts = (/^((?:.|\n)*)([ \t]+)$/g).exec(text);
                        if (parts) {
                            text = parts[1];
                            addon = returnSymbol + parts[2];
                        }
                    }
                    if (i === $contents.length - 1 && !text.match(/[^\s][ \t]*\n\s*$/)) {
                        addon = returnSymbol;
                    }

                    $this.replaceWith(prefix + text.replace(searchPattern, replacer) + addon);
                    prefix = '';
                    addon = '';
                } else {
                    if (text.trim().length === 0) {
                        return;
                    }
                    $this.replaceWith(text.replace(searchPattern, replacer));
                    nonWhitespaceFound = true;
                }
            } else {
                $this.html(text.replace(searchPattern, replacer));
                nonWhitespaceFound = true;
            }
        });

        $gamecode.find('.code-char').addClass('untyped');
    };

    var pingId = null;
    var pingWaiting = function() {
        socket.emit('ingame:ping', { gameId: game._id });
        pingId = setTimeout(pingWaiting, 500);
    };

    var fullyStarted = false;
    var fullyStarting = false;
    var startGame = function() {
        if (fullyStarted) {
            return;
        }
        viewModel.game.gameStatus('Go!');
        viewModel.game.gameStatusCss('text-info control-panel-go');
        fullyStarted = true;
    };

    var setStarting = function() {
        if (fullyStarting) {
            return;
        }
        viewModel.game.gameStatus('Get ready... ');
    };

    var resetStarting = function() {
    };

    var wrapFullyStarted = function(fn) {
        return function() {
            if (fullyStarted) {
                fn.apply(this, arguments);
            }
        };
    };

    // Bind key events
    var keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    keys = keys.concat(_.map(keys, function(k) { return k.toUpperCase(); }));
    keys = keys.concat(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    keys = keys.concat(['`', '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', '[', '{', ']', '}', '\\', '|', '\'', '"', ';', ':', '/', '?', '.', '>', ',', '<']);
    keys = keys.concat(['backspace', 'enter', 'space']);

    Mousetrap.bind(keys, function(key) {
        key.preventDefault();
    });

    socket.on('ingame:ready:res', function(data) {
        console.log('received ingame:ready:res');
        game = data.game;
        exercise = data.exercise;
        nonTypeables = data.nonTypeables;
        swiftcode.game = data.game;
        swiftcode.exercise = data.exercise;
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
            setStarting();
            viewModel.game.countdown(moment(game.startTime).diff(moment(), 'seconds') + 1);

            var millisecondsLeft = moment(game.startTime).diff(moment());
            if (millisecondsLeft < 1000) {
                setTimeout(startGame, millisecondsLeft);
            }
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
