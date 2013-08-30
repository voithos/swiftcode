var _ = require('lodash');
var models = require('./models');

/*
 * GET home page.
 */

exports.index = function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect('/lobby');
        return;
    }

    res.render('index', {
        title: 'Home',
        error: req.flash('error')
    });
};

/*
 * GET lobby page.
 */

exports.lobby = function(req, res) {
    models.Lang.find({}, 'key name', function(err, docs) {
        if (err) {
            console.log(err);
            console.log('Langs not found'); return;
        }
        res.render('lobby', {
            title: 'Lobby',
            langs: docs
        });
    });
};


/*
 * GET game page.
 */

exports.game = function(req, res) {
    res.render('game', {
        title: 'Game'
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
 * POST signup.
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

/*
 * GET admin page.
 */

exports.admin = function(req, res) {
    res.render('admin', {
        title: 'Admin'
    });
};

/*
 * POST admin/add-lang.
 */

exports.addLang = function(req, res) {
    var done = function() {
        res.redirect('/admin');
    };

    var key = req.body.key,
        name = req.body.name,
        projectName = req.body.projectName,
        order = req.body.order,
        exerciseName = req.body.exerciseName,
        code = req.body.code;

    if (_.all([key, name, projectName, order, exerciseName, code]) &&
        exerciseName.length === code.length) {
        var lang = new models.Lang({
            key: key,
            name: name,
            projectName: projectName,
            order: order
        });

        var exercises = [];

        _.each(_.zip(exerciseName, code), function(zipped) {
            exercises.push({
                exerciseName: zipped[0],
                code: zipped[1]
            });
        });

        models.Exercise.create(exercises, function(err) {
            if (err) {
                console.log(err);
                console.log('addLang error');
                done();
            }
            _.each(Array.prototype.slice.call(arguments, 1), function(exercise) {
                lang.exercises.push(exercise._id);
            });

            lang.save(function(err) {
                done();
            });
        });
    }
};

/*
 * POST admin/reinit-exercises.
 */

exports.reinitExercises = function(req, res) {
    var done = function(err) {
        var result = { success: true };
        if (err) {
            result.success = false;
        }
        res.write(JSON.stringify(result));
        res.end();
    };

    models.Exercise.find({}, function(err, exercises) {
        if (err) {
            console.log(err);
            console.log('reinitLang error');
            done(err);
        }
        var total = exercises.length,
            saveCount = 0;

        _.each(exercises, function(exercise) {
            exercise.initialize();
            exercise.save(function(err, saved) {
                if (err) {
                    console.log(err);
                    console.log('reinitLang error');
                }
                saveCount++;
                if (saveCount === total) {
                    done();
                }
            });
        });
    });
};
