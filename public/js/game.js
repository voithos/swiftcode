(function() {
    hljs.tabReplace = '    ';

    var socket = io.connect(getSocketUrl() + '/game');

    var GameState = function() {
        this.gameStatus = ko.observable('Waiting for players...');
        this.gameStatusCss = ko.observable('');
        this.timer = ko.observable('');
        this.timerCss = ko.observable('');
        this.timerRunning = ko.observable(false);
        this.started = ko.observable(false);
        this.gamecode = ko.observable('');
        this.langCss = ko.observable('');
    };

    var viewModel = {
        game: new GameState()
    };

    swiftcode.viewModel = viewModel;
    ko.applyBindings(viewModel);

    var $gamecode = null;

    var game = null;
    var exercise = null;
    var nonTypeables = null;

    var time = null;
    var code = null;
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
                var oldClass = $this.attr('class');
                var $newContent = $(text.replace(searchPattern, replacer));
                $this.replaceWith($newContent);
                $newContent.addClass(oldClass);
                nonWhitespaceFound = true;
            }
        });

        $gamecode.find('.code-char').addClass('untyped');
    };

    // TODO: Try different method? Using char -> element mapping,
    // collapse chars into single string, modify the string, and normalize
    // it to typeables

    var pingId = null;
    var pingWaiting = function() {
        socket.emit('ingame:ping', { gameId: game._id });
        pingId = setTimeout(pingWaiting, 500);
    };

    // TODO: Add T-minus countdown, and running time clock
    // TODO: Fix timing; don't wait for ping, set a timeout
    var fullyStarted = false;
    var startGame = function() {
        if (fullyStarted) {
            return;
        }
        viewModel.game.gameStatus('Go!');
        viewModel.game.gameStatusCss('text-info control-panel-go');
        fullyStarted = true;
    };

    var setStarting = function() {
        if (fullyStarted) {
            return;
        }
        viewModel.game.gameStatus('Get ready... ');

        updateTime();
        if (!$currentChar) {
            $currentChar = $gamecode.find('.code-char').first();
            $currentChar.addClass('player');
        }
    };

    var timeId = null;
    var updateTime = function() {
        if (game.starting) {
            time = moment().diff(game.startTime);
            var t = moment.duration(time);
            var minutes = t.minutes();
            var seconds = t.seconds();
            seconds = time < 0 ? -seconds + 1 : seconds;

            viewModel.game.timer(sprintf('%s%d:%02d',
                time < 0 ? 'T-' : '', minutes, seconds));
            viewModel.game.timerCss(time < 0 ? 'label-warning' : 'label-info');

            if (time > -1000 && time < 0) {
                setTimeout(startGame, -time);
            }

            timeId = setTimeout(updateTime, 100);
        }
    };

    var resetStarting = function() {
        viewModel.game.gameStatus('Waiting for players...');
        if ($currentChar) {
            $currentChar.removeClass('player');
            $currentChar = null;
        }

        clearTimeout(timeId);
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
    keys = keys.concat(['enter', 'space', 'shift+space', 'shift+enter']);

    Mousetrap.bind(keys, wrapFullyStarted(function(e, key) {
        e.preventDefault();

        log(key);

        key = _.contains(['space', 'shift+space'], key) ? ' ' :
              _.contains(['enter', 'shift+enter'], key) ? '\n' :
              key;

        if (key === code.charAt(currentPos)) {
            // TODO: Add completion detection
            currentPos++;
            $currentChar.removeClass('player untyped');
            $currentChar.addClass('typed');

            $currentChar = $currentChar.nextAll('.code-char').first();
            $currentChar.addClass('player');
        }
        // TODO: Add incorrect key handling
    }));

    Mousetrap.bind('backspace', wrapFullyStarted(function(e, key) {
        e.preventDefault();
        // TODO: Add backspace handling
    }));


    socket.on('ingame:ready:res', function(data) {
        console.log('received ingame:ready:res');
        game = data.game;
        exercise = data.exercise;
        code = data.exercise.typeableCode;
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
        viewModel.game.timerRunning(game.starting || game.started);
        viewModel.game.started(game.started);

        if (game.started) {
            clearTimeout(pingId);
            startGame();
        } else if (game.starting) {
            setStarting();
        } else {
            resetStarting();
        }
    });

    console.log('emit ingame:ready');
    socket.emit('ingame:ready', { player: user._id });
})();
