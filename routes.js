
/*
 * GET home page.
 */

exports.index = function(req, res){
    res.render('index', { title: 'SwiftCODE' });
};

/*
 * GET lobby page.
 */

exports.lobby = function(req, res){
    res.render('lobby', { title: 'Lobby' });
};

/*
 * GET help page.
 */

exports.help = function(req, res){
    res.render('help', { title: 'Help' });
};
