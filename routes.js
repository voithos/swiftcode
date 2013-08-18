var server = require('./server'),
    models = require('./models');

/*
 * GET home page.
 */

exports.index = function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect('/lobby');
        return;
    }

    res.render('index', {
        title: 'SwiftCODE',
        error: req.flash('error')
    });
};

/*
 * GET lobby page.
 */

exports.lobby = function(req, res) {
    res.render('lobby', {
        title: 'Lobby',
        exercises: server.getApp().getExercises()
    });
};

/*
 * GET help page.
 */

exports.help = function(req, res) {
    res.render('help', {
        title: 'Help'
    });
};

/*
 * POST signup page.
 */

exports.signup = function(req, res) {
    var username = req.body.username,
        password = req.body.password;

    if (username && password) {
        models.User.findOne({ username: username }, function(err, user) {
            // Create a new user if none exists
            if (!user) {
                user = new models.User({ username: username, password: password });
                user.save(function(err, saved) {
                    req.logIn(user, function(err) {
                        return res.redirect('/lobby');
                    });
                });
            } else {
                req.flash('error', 'That username is already in use.');
                res.redirect('/');
            }
        });
    }
};
