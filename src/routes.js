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
 * GET playnow.
 */
exports.playnow = function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect('/lobby');
        return;
    }

    var user = new models.User({
        isAnonymous: true,
        username: models.User.generateAnonymousUsername()
    });
    user.save(function(err, saved) {
        req.logIn(user, function(err) {
            return res.redirect('/lobby');
        });
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
    if (!req.user.isJoiningGame) {
        return res.redirect('/lobby');
    }

    // Reset the joining flag
    req.user.isJoiningGame = false;
    req.user.save();

    res.render('game', {
        title: 'Game'
    });
};

/*
 * GET about page.
 */

exports.about = function(req, res) {
    models.Project.find({}, null, { sort: { name: 1 } }, function(err, docs) {
        if (err) {
            console.log(err);
            console.log('Projects not found'); return;
        }
        res.render('about', {
            title: 'About',
            projects: docs
        });
    });
};

/*
 * POST signup.
 */

exports.signup = function(req, res) {
    var reportError = function(msg) {
        req.flash('error', msg);
        return res.redirect('/');
    };
    var username = req.body.username,
        password = req.body.password;

    if (!username || !password) {
        return reportError('Both username and password are required.');
    } else if (username.length < 2 || username.length > 32) {
        return reportError('The username must be between 2 and 32 characters long.');
    } else if (password.length < 8) {
        return reportError('The password must be at least 8 characters long.');
    }

    models.User.findOne({ username: username }, function(err, user) {
        if (err) {
            console.log(err);
            return reportError('An error occurred on the server.');
        }
        // Create a new user if none exists
        if (!user) {
            user = new models.User({ username: username, password: password });
            user.save(function(err, saved) {
                req.logIn(user, function(err) {
                    return res.redirect('/lobby');
                });
            });
        } else {
            return reportError('That username is already in use.');
        }
    });
};

/*
 * GET admin page.
 */

exports.admin = function(req, res) {
    res.render('admin', {
        title: 'Admin',
        error: req.flash('error')
    });
};

/*
 * POST admin/add-lang.
 */

exports.addLang = function(req, res) {
    var done = function(err) {
        if (err) {
            req.flash('error', err);
        }
        res.redirect('/admin');
    };

    var eachZipped = function(zipped, fn) {
        for (var i = 0, l = zipped.length; i < l; i++) {
            fn.apply(zipped, zipped[i]);
        }
    };

    var getRequestArray = function(key, l) {
        var collection = [],
            i, v;
        for (i = 0; i < l; i++) {
            v = req.body[key + i];
            if (v) {
                collection.push(v);
            }
        }
        return collection;
    };

    var allSame = function(array) {
        if (array.length > 0) {
            for (var i = 0; i < array.length; i++) {
                if (array[i] !== array[0]) {
                    return false;
                }
            }
        }
        return true;
    };

    var langKey = req.body.key,
        langName = req.body.name,
        order = req.body.order,
        projectCount = parseInt(req.body.projectCount),
        exerciseCount = parseInt(req.body.exerciseCount),
        projectKey = getRequestArray('projectKey', projectCount),
        projectName = getRequestArray('projectName', projectCount),
        projectUrl = getRequestArray('projectUrl', projectCount),
        projectCodeUrl = getRequestArray('projectCodeUrl', projectCount),
        projectLicenseUrl = getRequestArray('projectLicenseUrl', projectCount),
        exerciseProject = getRequestArray('exerciseProject', exerciseCount),
        exerciseName = getRequestArray('exerciseName', exerciseCount),
        code = getRequestArray('code', exerciseCount);

    if (_.all([langKey, langName, order, projectKey, projectName, projectUrl, projectCodeUrl, projectLicenseUrl, exerciseProject, exerciseName, code]) &&
        allSame(_.pluck([projectKey, projectName, projectUrl, projectCodeUrl, projectLicenseUrl], 'length')) &&
        allSame(_.pluck([exerciseProject, exerciseName, code], 'length'))) {

        var lang = new models.Lang({
            key: langKey,
            name: langName,
            order: order
        });

        var exercises = [];
        eachZipped(_.zip(exerciseName, code), function(exerciseName, code) {
            exercises.push({
                lang: langKey,
                exerciseName: exerciseName,
                code: code
            });
        });

        var projects = [];
        eachZipped(_.zip(projectKey, projectName, projectUrl, projectCodeUrl, projectLicenseUrl), function(key, name, url, codeUrl, licenseUrl) {
            projects.push({
                key: key,
                name: name,
                url: url,
                codeUrl: codeUrl,
                licenseUrl: licenseUrl,
                lang: langKey,
                langName: langName
            });
        });

        models.Project.create(projects, function(err) {
            if (err) {
                console.log(err);
                console.log('addLang error');
                return done(err);
            }

            var projects = Array.prototype.slice.call(arguments, 1);
            _.each(_.map(exerciseProject, function(p) { return parseInt(p); }), function(project, i) {
                exercises[i].project = projects[project]._id;
                exercises[i].projectName = projects[project].name;
            });

            models.Exercise.create(exercises, function(err) {
                if (err) {
                    console.log(err);
                    console.log('addLang error');
                    return done(err);
                }
                _.each(Array.prototype.slice.call(arguments, 1), function(exercise) {
                    lang.exercises.push(exercise._id);
                });

                lang.save(function(err) {
                    return done(err);
                });
            });
        });
    } else {
        return done('Did not pass validation.');
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
            return done(err);
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
                    return done();
                }
            });
        });
    });
};
