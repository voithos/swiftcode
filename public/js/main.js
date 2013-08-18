var getQualifiedUrl = function() {
    return location.protocol + '//' + location.hostname +
        (location.port ? ':' + location.port : '');
};

var getSocketUrl = function() {
    return (openshift ? 'ws:' : location.protocol) + '//' + location.hostname +
        (openshift ? ':8000' : (location.port ? ':' + location.port : ''));
};

var redirect = function(page) {
    location.href = getQualifiedUrl() + page;
};
