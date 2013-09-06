(function() {
    var viewModel = {
        exercises: ko.observableArray([{}]),
        showAlert: ko.observable(false),
        alertMessage: ko.observable(''),
        alertCss: ko.observable(''),
        addExercise: function() {
            this.exercises.push({});
        },
        reinitExercises: function() {
            $.ajax({
                type: 'POST',
                url: '/admin/reinit-exercises',
                success: function(data) {
                    if (data.success) {
                        viewModel.alertMessage('All exercises successfully reinitialized.');
                        viewModel.alertCss('alert-success');
                    } else {
                        viewModel.alertMessage('There was an error during reinitialization.');
                        viewModel.alertCss('alert-danger');
                    }
                    viewModel.showAlert(true);
                    setTimeout(function() {
                        viewModel.hideAlert();
                    }, 3000);
                },
                dataType: 'json'
            });
        },
        hideAlert: function() {
            $('.reinit-alert').hide(function() {
                viewModel.showAlert(false);
            });
        }
    };

    swiftcode.viewModel = viewModel;
    ko.applyBindings(viewModel);
})();
