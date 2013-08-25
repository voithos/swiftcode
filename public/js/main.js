// Initiate parsley validation
$(document).ready(function() {
    $('.form-parsley').each(function(i, elem) {
        $(elem).parsley({
            successClass: 'has-success',
            errorClass: 'has-error',
            errors: {
                classHandler: function(el) {
                    return $(el).closest('.form-group');
                }
            }
        });
    });
});

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

var swiftcode = {};
