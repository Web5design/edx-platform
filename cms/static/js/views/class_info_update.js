define(["backbone", "underscore", "codemirror", "js/models/course_update",
    "js/views/feedback_prompt", "js/views/feedback_notification"],
    function(Backbone, _, CodeMirror, CourseUpdateModel, PromptView, NotificationView) {

var ClassInfoUpdate = Backbone.View.extend({
    // collection is CourseUpdateCollection
    events: {
        "click .new-update-button" : "onNew",
        "click #course-update-view .save-button" : "onSave",
        "click #course-update-view .cancel-button" : "onCancel",
        "click .post-actions > .edit-button" : "onEdit",
        "click .post-actions > .delete-button" : "onDelete"
    },

    initialize: function() {
        this.template = _.template($("#course_info_update-tpl").text());
        this.render();
        // when the client refetches the updates as a whole, re-render them
        this.listenTo(this.collection, 'reset', this.render);
    },

    render: function () {
          // iterate over updates and create views for each using the template
          var updateEle = this.$el.find("#course-update-list");
          // remove and then add all children
          $(updateEle).empty();
          var self = this;
          this.collection.each(function (update) {
              try {
                  var newEle = self.template({ updateModel : update });
                  $(updateEle).append(newEle);
            } catch (e) {
                // ignore
            }
          });
          this.$el.find(".new-update-form").hide();
          this.$el.find('.date').datepicker({ 'dateFormat': 'MM d, yy' });
          return this;
    },

    onNew: function(event) {
        event.preventDefault();
        var self = this;
        // create new obj, insert into collection, and render this one ele overriding the hidden attr
        var newModel = new CourseUpdateModel();
        this.collection.add(newModel, {at : 0});

        var $newForm = $(this.template({ updateModel : newModel }));

        var updateEle = this.$el.find("#course-update-list");
        $(updateEle).prepend($newForm);

        var $textArea = $newForm.find(".new-update-content").first();
        if (this.$codeMirror == null ) {
            this.$codeMirror = CodeMirror.fromTextArea($textArea.get(0), {
                mode: "text/html",
                lineNumbers: true,
                lineWrapping: true,
            });
        }

        $newForm.addClass('editing');
        this.$currentPost = $newForm.closest('li');

        window.$modalCover.show();
        window.$modalCover.bind('click', function() {
            self.closeEditor(self, true);
        });

        $('.date').datepicker('destroy');
        $('.date').datepicker({ 'dateFormat': 'MM d, yy' });
    },

    onSave: function(event) {
        event.preventDefault();
        var targetModel = this.eventModel(event);
        targetModel.set({ date : this.dateEntry(event).val(), content : this.$codeMirror.getValue() });
        // push change to display, hide the editor, submit the change
        var saving = new NotificationView.Mini({
            title: gettext('Saving') + '&hellip;'
        });
        saving.show();
        var ele = this.modelDom(event);
        targetModel.save({}, {
            success: function() {
                saving.hide();
            },
            error: function() {
                ele.remove();
            }
        });
        this.closeEditor(this);

        analytics.track('Saved Course Update', {
            'course': course_location_analytics,
            'date': this.dateEntry(event).val()
        });
    },

    onCancel: function(event) {
        event.preventDefault();
        // change editor contents back to model values and hide the editor
        $(this.editor(event)).hide();
        var targetModel = this.eventModel(event);
        this.closeEditor(this, !targetModel.id);
    },

    onEdit: function(event) {
        event.preventDefault();
        var self = this;
        this.$currentPost = $(event.target).closest('li');
        this.$currentPost.addClass('editing');

        $(this.editor(event)).show();
        var $textArea = this.$currentPost.find(".new-update-content").first();
        if (this.$codeMirror == null ) {
            this.$codeMirror = CodeMirror.fromTextArea($textArea.get(0), {
                mode: "text/html",
                lineNumbers: true,
                lineWrapping: true,
            });
        }

        window.$modalCover.show();
        var targetModel = this.eventModel(event);
        window.$modalCover.bind('click', function() {
            self.closeEditor(self);
        });
    },

    onDelete: function(event) {
        event.preventDefault();

        var self = this;
        var targetModel = this.eventModel(event);
        var confirm = new PromptView.Warning({
            title: gettext('Are you sure you want to delete this update?'),
            message: gettext('This action cannot be undone.'),
            actions: {
                primary: {
                    text: gettext('OK'),
                    click: function () {
                        analytics.track('Deleted Course Update', {
                            'course': course_location_analytics,
                            'date': self.dateEntry(event).val()
                        });
                        self.modelDom(event).remove();
                        var deleting = new NotificationView.Mini({
                            title: gettext('Deleting') + '&hellip;'
                        });
                        deleting.show();
                        targetModel.destroy({
                            success: function (model, response) {
                                self.collection.fetch({
                                    success: function() {
                                        self.render();
                                        deleting.hide();
                                    },
                                    reset: true
                                });
                            }
                        });
                        confirm.hide();
                    }
                },
                secondary: {
                    text: gettext('Cancel'),
                    click: function() {
                        confirm.hide();
                    }
                }
            }
        });
        confirm.show();
},

    closeEditor: function(self, removePost) {
        var targetModel = self.collection.get(self.$currentPost.attr('name'));

        if(removePost) {
            self.$currentPost.remove();
        }

        // close the modal and insert the appropriate data
        self.$currentPost.removeClass('editing');
        self.$currentPost.find('.date-display').html(targetModel.get('date'));
        self.$currentPost.find('.date').val(targetModel.get('date'));
        try {
            // just in case the content causes an error (embedded js errors)
            self.$currentPost.find('.update-contents').html(targetModel.get('content'));
            self.$currentPost.find('.new-update-content').val(targetModel.get('content'));
        } catch (e) {
            // ignore but handle rest of page
        }
        self.$currentPost.find('form').hide();
        window.$modalCover.unbind('click');
        window.$modalCover.hide();
        this.$codeMirror = null;
        self.$currentPost.find('.CodeMirror').remove();
    },

    // Dereferencing from events to screen elements
    eventModel: function(event) {
        // not sure if it should be currentTarget or delegateTarget
        return this.collection.get($(event.currentTarget).attr("name"));
    },

    modelDom: function(event) {
        return $(event.currentTarget).closest("li");
    },

    editor: function(event) {
        var li = $(event.currentTarget).closest("li");
        if (li) return $(li).find("form").first();
    },

    dateEntry: function(event) {
        var li = $(event.currentTarget).closest("li");
        if (li) return $(li).find(".date").first();
    },

    contentEntry: function(event) {
        return $(event.currentTarget).closest("li").find(".new-update-content").first();
    },

    dateDisplay: function(event) {
        return $(event.currentTarget).closest("li").find("#date-display").first();
    },

    contentDisplay: function(event) {
        return $(event.currentTarget).closest("li").find(".update-contents").first();
    }

});
return ClassInfoUpdate;
}); // end define()
