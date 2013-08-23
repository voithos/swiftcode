(function() {
    var viewModel = {
        exercises: ko.observableArray([{}]),
        addExercise: function() {
            this.exercises.push({});
        }
    };

    ko.applyBindings(viewModel);
})();
