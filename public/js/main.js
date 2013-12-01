// Initiate parsley validation
$(document).ready(function() {
    $('.form-parsley').each(function(i, elem) {
        $(elem).parsley({
            successClass: 'has-success',
            errorClass: 'has-error',
            errors: {
                classHandler: function(el) {
                    return $(el).closest('.form-group');
                },
                errorsWrapper: '',
                errorsElem: '',
                errorHandler: function(elem, message) {
                    var $elem = $(elem);
                    $elem.tooltip({
                        trigger: 'manual',
                        title: message
                    });
                    $elem.tooltip('show');
                },
                validHandler: function(elem) {
                    var $elem = $(elem);
                    $elem.tooltip('destroy');
                }
            }
        });
    });
});

// Initialize automatic page refresh alert
if (typeof user != 'undefined') {
    (function() {
        var alertTimeout = 600 * 1000; // 600 seconds, or 10 minutes

        var showTimeoutAlert = function() {
            alertify.set({
                labels: {
                    ok: 'Yes'
                }
            });

            alertify.alert("You haven't changed pages in a while. Are you still there?", function() {
                $.ajax({
                    type: 'GET',
                    url: '/'
                });
                setTimeout(showTimeoutAlert, alertTimeout);
            });
        };

        setTimeout(showTimeoutAlert, alertTimeout); // 600 seconds, or 10 minutes
    })();
}

var getQualifiedUrl = function() {
    return location.protocol + '//' + location.hostname +
        (location.port ? ':' + location.port : '');
};

var getSocketUrl = function() {
    return location.protocol + '//' + location.hostname +
        (location.port ? ':' + location.port : '');
};

var redirect = function(page) {
    location.href = getQualifiedUrl() + page;
};

var swiftcode = {};
