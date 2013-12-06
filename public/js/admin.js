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
        addProject: function() {
            this.projects.push(new Project());
        },
        reinitExercises: function() {
            $.ajax({
                type: 'POST',
                url: '/admin/reinit-exercises',
                success: function(data) {
                    if (data.success) {
                        showAlert('All exercises successfully reinitialized.');
                    } else {
                        showAlert('There was an error during reinitialization.', true);
                    }
                },
                dataType: 'json'
            });
        }
    };

    swiftcode.viewModel = viewModel;
    ko.applyBindings(viewModel);
    viewModel.addProject();
})();
