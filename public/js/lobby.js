(function() {
    var socket = io.connect(getQualifiedHost() + '/lobby');

    socket.on('test', function(data) {
        socket.emit('test', ['data']
        );
    });

    var Game = function(opts) {
        this.id = opts.id;
        this.num = opts.num;
        this.lang = opts.lang;
        this.players = opts.players;
        this.maxPlayers = opts.maxPlayers;
        this.status = opts.status;
        this.statusType = opts.statusType;
        this.statusCss = ko.computed(function() {
            var bindings = {
                'waiting': 'text-warning',
                'ingame': 'text-success'
            };
            return bindings[this.statusType];
        }, this);
        this.isJoinable = opts.isJoinable;

        this.join = function() {
        }.bind(this);
    };

    var viewModel = {
        games: [
            new Game({id: 'falkdfjaldjf', num: 1, lang: 'JavaScript', players: 2, maxPlayers: 4, status: 'Waiting', statusType: 'waiting', isJoinable: true}),
            new Game({id: 'falkdfjaldjf', num: 2, lang: 'JavaScript', players: 2, maxPlayers: 4, status: 'Waiting', statusType: 'waiting', isJoinable: true}),
            new Game({id: 'falkdfjaldjf', num: 3, lang: 'JavaScript', players: 4, maxPlayers: 4, status: 'In game', statusType: 'ingame', isJoinable: false}),
            new Game({id: 'falkdfjaldjf', num: 4, lang: 'JavaScript', players: 2, maxPlayers: 4, status: 'Waiting', statusType: 'waiting', isJoinable: true}),
            new Game({id: 'falkdfjaldjf', num: 5, lang: 'JavaScript', players: 2, maxPlayers: 4, status: 'In game', statusType: 'ingame', isJoinable: false}),
            new Game({id: 'falkdfjaldjf', num: 6, lang: 'JavaScript', players: 2, maxPlayers: 4, status: 'Waiting', statusType: 'waiting', isJoinable: true})
        ]
    };

    ko.applyBindings(viewModel);
})();
