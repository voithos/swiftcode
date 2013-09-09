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

    /**
     * Represents a player or opponent's cursor
     */
    var CodeCursor = function(playerName, cursor, code, fn) {
        this.playerName = playerName;
        this.cursor = cursor;
        this.code = code;
        this.pos = 0;
        this.isMistaken = false;
        this.mistakePathLength = 0;
        this.numMistakes = 0;
        this.mistakePositions = [];

        this.onGameComplete = fn || function() {};

        this.cursor.addClass(this.playerName);
    };

    CodeCursor.prototype.processKey = function(key) {
        if (this.isMistaken) {
            this.mistakePathKey();
        } else if (key === this.code.charAt(this.pos)) {
            this.correctKey();
        } else {
            this.incorrectKey();
        }
    };

    CodeCursor.prototype.advanceCursor = function(curClass, trailingClass) {
        this.pos++;
        this.cursor.removeClass('untyped').removeClass(curClass);
        this.cursor.addClass('typed').addClass(trailingClass);

        this.cursor = this.cursor.nextAll('.code-char').first();
        this.cursor.addClass(curClass);
    };

    CodeCursor.prototype.retreatCursor = function(curClass, trailingClass) {
        this.pos--;
        this.mistakePathLength--;

        this.cursor.removeClass(curClass);
        this.cursor = this.cursor.prevAll('.code-char').first();

        this.cursor.removeClass('typed').removeClass(trailingClass);
        this.cursor.addClass('untyped').addClass(curClass);
    };

    CodeCursor.prototype.correctKey = function() {
        this.advanceCursor(this.playerName);

        if (this.pos === this.code.length) {
            this.onGameComplete();
        }
    };

    CodeCursor.prototype.incorrectKey = function() {
        // We must *not* be at the final character of the code if we want to
        // create a mistake path, so check for it
        if (this.pos < this.code.length - 1) {
            this.isMistaken = true;
            this.numMistakes++;
            this.mistakePositions.push(this.pos);
            this.advanceCursor(this.playerName, 'mistake');
            this.mistakePathLength++;
        }
        // But we do want to highlight a mistake, even if we're at the end
        // of the code
        this.cursor.addClass('mistaken');
    };

    CodeCursor.prototype.mistakePathKey = function() {
        if (this.pos < this.code.length - 1) {
            if (this.mistakePathLength < 10) {
                this.advanceCursor(this.playerName + ' mistaken', 'mistake-path');
                this.mistakePathLength++;
            }
        }
    };

    CodeCursor.prototype.backspaceKey = function() {
        if (this.isMistaken) {
            this.retreatCursor(this.playerName + ' mistaken', 'mistake-path mistake');

            if (this.mistakePathLength === 0) {
                this.isMistaken = false;
                this.cursor.removeClass('mistaken');
            }
        }
    };

    CodeCursor.prototype.destroy = function() {
        this.cursor.removeClass(this.playerName);
    };


    /**
     * Current game state
     */
    var state = swiftcode.state = {
        time: null,
        code: null,
        playerCursor: null
    };

    /**
     * Extract game code, manipulate references, remove non-typeables,
     * and wrap each character is a specific span tag
     */
    var bindCodeCharacters = function() {
        $gamecode = $('#gamecode');

        var codemap = [];
        var $contents = $gamecode.contents();

        // Loop through contents of code, and add all non-comment
        // blocks into the codemap, keeping track of their positions
        // and elements
        _.each($contents, function(elem, elIdx) {
            var $elem = $(elem);

            if ($elem.is(nonTypeables)) {
                return;
            }

            var text = $elem.text();
            _.each(text, function(s, i) {
                codemap.push({
                    char: s,
                    idx: i,
                    elIdx: elIdx,
                    el: $elem
                });
            });
        });

        /**
         * Reusable filter methods that keeps track of indices
         * marked for removal, with custom criteria functions
         */
        var iterativeFilter = function(collection, state, loopFn) {
            var indices = {};
            var addSection = function(lastIdx, curIdx) {
                var start = lastIdx + 1,
                    howMany = curIdx - start;

                if (howMany > 0) {
                    for (var i = start; i < start + howMany; i++) {
                        indices[i] = true;
                    }
                }
            };

            _.each(collection, function(piece, i) {
                loopFn.call(state, piece, i, addSection);
            });

            // Remove the collected indices
            return _.filter(collection, function(piece, i) {
                return !indices[i];
            });
        };

        // Loop through the codemap and remove occurrences of leading and
        // trailing whitespace
        codemap = iterativeFilter(codemap, {
            leadingSearch: true,
            trailingSearch: false,
            lastNewline: -1,
            lastTypeable: -1,
            setMode: function(mode) {
                this.leadingSearch = mode === 'leading';
                this.trailingSearch = mode === 'trailing';
            }
        }, function(piece, i, addSection) {
            if (piece.char === ' ' || piece.char === '\t') {
                // Skip over
                return;
            } else if (piece.char === '\n') {
                // New line
                if (this.trailingSearch) {
                    this.setMode('leading');
                    addSection(this.lastTypeable, i);
                }
                this.lastNewline = i;
            } else {
                // Typeable
                if (this.leadingSearch) {
                    this.setMode('trailing');
                    addSection(this.lastNewline, i);
                }
                this.lastTypeable = i;
            }
        });

        // Finally, remove contiguous blocks of newline+whitespace,
        // as well as globally leading whitespace
        codemap = iterativeFilter(codemap, {
            firstTypeableFound: false,
            newlineFound: false,
            typeableFound: false,
            lastRelevantNewline: -1,
            setFound: function(found) {
                this.newlineFound = found === 'newline';
                this.typeableFound = found === 'typeable';
                if (found === 'typeable') {
                    this.firstTypeableFound = true;
                }
            }
        }, function(piece, i, addSection) {
            if (piece.char === ' ' || piece.char === '\t') {
                // Skip over
                return;
            } else if (piece.char === '\n') {
                // Newline
                if (this.firstTypeableFound && !this.newlineFound) {
                    this.lastRelevantNewline = i;
                }
                this.setFound('newline');
            } else {
                // Typeable
                if (this.newlineFound) {
                    addSection(this.lastRelevantNewline, i);
                }
                this.setFound('typeable');
            }
        });

        var isTextNode = function(el) {
            return el.get(0).nodeType === 3;
        };

        // Group remaining code chars by original element, and loop through
        // every element group and replace the element's text content with the
        // wrapped code chars
        var groupedCodemap = _.groupBy(codemap, function(piece) { return piece.elIdx; });
        _.each(groupedCodemap, function(codeGroup) {
            var $elem = codeGroup[0].el,
                text = $elem.text();

            var collapseCodeGroup = function(codeGroup, text) {
                var chunks = [],
                    idx = 0;

                _.each(codeGroup, function(piece) {
                    chunks.push(text.slice(idx, piece.idx));
                    idx = piece.idx + 1;

                    if (piece.char === '\n') {
                        chunks.push('<span class="code-char return-char"></span>\n');
                    } else {
                        chunks.push('<span class="code-char">' + piece.char + '</span>');
                    }
                });

                chunks.push(text.slice(idx, text.length));
                return chunks.join('');
            };

            if (isTextNode($elem)) {
                $elem.replaceWith(collapseCodeGroup(codeGroup, text));
            } else {
                // Re-add highlighting classes to the new spans
                var oldClass = $elem.attr('class');
                var $newContent = $(collapseCodeGroup(codeGroup, text));
                $elem.replaceWith($newContent);
                $newContent.addClass(oldClass);
            }
        });

        // Attach boundcode
        swiftcode.boundCode = _.map(codemap, function(piece) { return piece.char; }).join('');

        // Set all code characters to untyped
        $gamecode.find('.code-char').addClass('untyped');
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

    var setStarting = function() {
        if (fullyStarted) {
            return;
        }
        viewModel.game.gameStatus('Get ready... ');

        updateTime();
        if (!state.playerCursor) {
            state.playerCursor = new CodeCursor('player', $gamecode.find('.code-char').first(), state.code, completeGame);
        }
    };

    var completeGame = function() {
        game.isComplete = true;
        clearTimeout(timeId);
    };


    var timeId = null;
    var updateTime = function() {
        if (game.starting && !game.isComplete) {
            state.time = moment().diff(game.startTime);
            var t = moment.duration(state.time);
            var minutes = t.minutes();
            var seconds = t.seconds();
            seconds = state.time < 0 ? -seconds + 1 : seconds;

            viewModel.game.timer(sprintf('%s%d:%02d',
                state.time < 0 ? 'T-' : '', minutes, seconds));
            viewModel.game.timerCss(state.time < 0 ? 'label-warning' : 'label-info');

            if (state.time > -1000 && state.time < 0) {
                setTimeout(startGame, -state.time);
            }

            timeId = setTimeout(updateTime, 100);
        }
    };

    var resetStarting = function() {
        viewModel.game.gameStatus('Waiting for players...');
        if (state.playerCursor) {
            state.playerCursor.destroy();
            state.playerCursor = null;
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

        key = _.contains(['space', 'shift+space'], key) ? ' ' :
              _.contains(['enter', 'shift+enter'], key) ? '\n' :
              key;

        state.playerCursor.processKey(key);
    }));

    Mousetrap.bind('backspace', wrapFullyStarted(function(e, key) {
        e.preventDefault();
        state.playerCursor.backspaceKey();
    }));


    socket.on('ingame:ready:res', function(data) {
        console.log('received ingame:ready:res');
        game = swiftcode.game = data.game;
        exercise = swiftcode.exercise = data.exercise;
        state.code = data.exercise.typeableCode;
        nonTypeables = data.nonTypeables;
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
