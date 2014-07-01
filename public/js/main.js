var swiftcode = {};

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

var showAlert = function(msg, err, fn) {
    alertify.alert(msg, fn, err ? 'alertify-error' : 'alertify-success');
};

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
        var alertTimeout = 55 * 60 * 1000; // 55 minutes

        var showTimeoutAlert = function() {
            var redirectTimeout = 5 * 60 * 1000;

            var redirectId = setTimeout(function() {
                window.location = '/';
            }, redirectTimeout);

            alertify.set({
                labels: {
                    ok: 'Yes'
                }
            });

            alertify.alert("You haven't changed pages in a while. Are you still there?", function() {
                clearTimeout(redirectId);
                $.ajax({
                    type: 'GET',
                    url: '/'
                });
                setTimeout(showTimeoutAlert, alertTimeout);
            });
        };

        setTimeout(showTimeoutAlert, alertTimeout);
    })();
}

// Automatically display error alert if necessary
if (typeof error !== 'undefined') {
    $(document).ready(function() {
        showAlert('Oops! ' + error, true);
    });
}
