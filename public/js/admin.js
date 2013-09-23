(function() {

    var Project = function() {
        viewModel.projectCount(viewModel.projectCount() + 1);
        viewModel.exerciseCount(viewModel.exerciseCount() + 1);

        this.exercises = ko.observableArray([{ absIndex: viewModel.exerciseCount() - 1 }]);
        this.addExercise = function() {
            viewModel.exerciseCount(viewModel.exerciseCount() + 1);
            this.exercises.push({ absIndex: viewModel.exerciseCount() - 1 });
        }.bind(this);
    };

    var viewModel = {
        projects: ko.observableArray(),
        projectCount: ko.observable(0),
        exerciseCount: ko.observable(0),
        alertVisible: ko.observable(false),
        alertMessage: ko.observable(''),
        alertCss: ko.observable(''),
        addProject: function() {
            this.projects.push(new Project());
        },
        reinitExercises: function() {
            $.ajax({
                type: 'POST',
                url: '/admin/reinit-exercises',
                success: function(data) {
                    if (data.success) {
                        viewModel.showAlert('All exercises successfully reinitialized.', true);
                    } else {
                        viewModel.showAlert('There was an error during reinitialization.', false);
                    }
                },
                dataType: 'json'
            });
        },
        showAlert: function(msg, success) {
            if (success) {
                viewModel.alertCss('alert-success');
            } else {
                viewModel.alertCss('alert-danger');
            }
            viewModel.alertMessage(msg);
            viewModel.alertVisible(true);
            setTimeout(function() {
                viewModel.hideAlert();
            }, 3000);
        },
        hideAlert: function() {
            $('.admin-alert').hide(function() {
                viewModel.showAlert(false);
            });
        }
    };

    swiftcode.viewModel = viewModel;
    ko.applyBindings(viewModel);
    viewModel.addProject();

    if (typeof error !== 'undefined') {
        viewModel.showAlert(error, false);
    }
})();
