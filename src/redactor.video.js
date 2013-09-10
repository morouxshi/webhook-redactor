/*
 * webhook-redactor
 *
 *
 * Copyright (c) 2013 Mike Horn
 * Licensed under the MIT license.
 */

(function ($) {
  "use strict";

  // namespacing
  var Video = function (redactor) {
    this.redactor = redactor;
  };

  Video.prototype = {
    control: {
      resize_full : { classSuffix: 'resize-full' },
      resize_small: { classSuffix: 'resize-small' }
    },
    controlGroup: ['up', 'down', '|', 'resize_full', 'resize_small', 'remove'],
    onShow: function ($figure, $toolbar) {

      if ($figure.hasClass('wh-figure-full')) {
        $toolbar.find('.wh-figure-controls-resize-full').hide();
        $toolbar.find('.wh-figure-controls-resize-small').show();
      } else {
        $toolbar.find('.wh-figure-controls-resize-full').show();
        $toolbar.find('.wh-figure-controls-resize-small').hide();
      }

    },
    command: function (command, $figure) {
      if (command === 'resize_full') {
        $figure.addClass('wh-figure-full');
      } else if (command === 'resize_small') {
        $figure.removeClass('wh-figure-full');
      }
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.video = {
    init: function () {
      this.video = new Video(this);

      var insertVideo = function (data) {

        // maintain undo buffer
        this.bufferSet();

        data = '<figure data-type="video"><p>' + this.cleanStripTags(data) + '</p><figcaption>Type to add caption (optional)</figcaption></figure>';

        this.selectionRestore();

        var current = this.getBlock() || this.getCurrent();

        if (current) {
          $(current).after(data);
        } else {
          this.insertHtmlAdvanced(data, false);
        }

        this.sync();
        this.modalClose();

      };

      var urlRegex = /(http|https):\/\/[\w\-]+(\.[\w\-]+)+([\w.,@?\^=%&amp;:\/~+#\-]*[\w@?\^=%&amp;\/~+#\-])?/;

      this.buttonAddBefore('link', 'video', 'Video', $.proxy(function () {

        // callback (optional)
        var callback = $.proxy(function () {

          // save cursor position
          this.selectionSave();

          $('#redactor_insert_video_btn').click($.proxy(function () {

            var data = $.trim($('#redactor_insert_video_area').val());

            if (urlRegex.test(data)) {

              $.embedly.oembed(data).done($.proxy(function (results) {
                $.each(results, $.proxy(function (index, result) {
                  insertVideo.call(this, result.html);
                }, this));
              }, this));

            } else {
              insertVideo.call(this, data);
            }

          }, this));

          setTimeout(function () {
            $('#redactor_insert_video_area').focus();
          }, 200);

        }, this);

        var modal = String() +
          '<section>' +
            '<form id="redactorInsertVideoForm">' +
              '<label>' + this.opts.curLang.video_html_code + '</label>' +
              '<textarea id="redactor_insert_video_area" style="width: 99%; height: 160px;"></textarea>' +
            '</form>' +
          '</section>' +
          '<footer>' +
            '<button class="redactor_modal_btn redactor_btn_modal_close">' + this.opts.curLang.cancel + '</button>' +
            '<input type="button" class="redactor_modal_btn" id="redactor_insert_video_btn" value="' + this.opts.curLang.insert + '" />' +
          '</footer>';

        // or call a modal with a code
        this.modalInit('Insert Video', modal, 500, callback);

      }, this));

    }
  };

}(jQuery));