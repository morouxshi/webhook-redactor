/*! webhook-redactor - v0.0.1 - 2014-05-28
* https://github.com/webhook/webhook-redactor
* Copyright (c) 2014 Mike Horn; Licensed MIT */
(function ($) {
  'use strict';

  window.RedactorPlugins = window.RedactorPlugins || {};

  // this needs a better home
  $.embedly.defaults.key = '65874c90af644c6a8f0b7072fe857811';
  $.embedly.defaults.query = { maxwidth: 640 };

  // namespacing
  var AutoEmbedly = function (redactor) {
    this.redactor = redactor;
    this.$editor = redactor.$editor;
    this.observe();
  };
  AutoEmbedly.prototype = {

    urlRegex: /((http:\/\/(.*youtube\.com\/watch.*|.*\.youtube\.com\/v\/.*|youtu\.be\/.*|.*\.youtube\.com\/user\/.*|.*\.youtube\.com\/.*#.*\/.*|m\.youtube\.com\/watch.*|m\.youtube\.com\/index.*|.*\.youtube\.com\/profile.*|.*\.youtube\.com\/view_play_list.*|.*\.youtube\.com\/playlist.*|www\.vimeo\.com\/groups\/.*\/videos\/.*|www\.vimeo\.com\/.*|vimeo\.com\/groups\/.*\/videos\/.*|vimeo\.com\/.*|vimeo\.com\/m\/#\/.*|player\.vimeo\.com\/.*))|(https:\/\/(.*youtube\.com\/watch.*|.*\.youtube\.com\/v\/.*|www\.vimeo\.com\/.*|vimeo\.com\/.*|player\.vimeo\.com\/.*)))/i,

    observe: function () {
      this.redactor.$editor.on('keyup.redactor', $.proxy(function (event) {
        if (event.which === this.redactor.keyCode.ENTER) {
          this.checkNode(this.redactor.$editor.get(0));
        }
      }, this));
    },
    // recursively check node and children for supported links
    checkNode: function (node) {
      $.each(node.childNodes, $.proxy(function (index, node) {
        if (node.nodeType === 3 && node.nodeValue && this.urlRegex.test(node.nodeValue)) {

          this.redactor.bufferSet();

          var url = node.nodeValue.match(this.urlRegex)[0],
              shiv = $('<span>loading embed...</span>');

          node.nodeValue = node.nodeValue.replace(this.urlRegex, '');

          $(node).parentsUntil(this.$editor).last().after(shiv);

          $.embedly.oembed(url).done(function (results) {
            $.each(results, function () {
              if (this.html) {
                shiv.replaceWith('<figure data-type="video">' + this.html + '<figcaption></figcaption></figure>');
              } else {
                shiv.replaceWith($('<p>').text(url));
              }
            });

          });

        } else if (node.nodeType === 1 && !/^(a|button|textarea)$/i.test(node.tagName)) {
          this.checkNode(node);
        }
      }, this));

      return this.matches;
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins.autoembedly = {
    init: function () {
      this.autoembedly = new AutoEmbedly(this);
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  // namespacing
  var Cleanup = function (redactor) {
    this.redactor = redactor;
    this.init();
  };
  Cleanup.prototype = {
    init: function () {
      this.removeEmptyPs();
    },
    removeEmptyPs: function () {
      this.redactor.$editor.find('p').filter(function() {
        return ! $.trim($(this).text());
      }).remove();
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.cleanup = {
    init: function () {
      this.cleanup = new Cleanup(this);
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  // namespacing
  var Figure = function (redactor) {
    this.redactor = redactor;
    this.toolbar = {};
    this.init();
  };
  Figure.prototype = {
    control: {
      up    : { classSuffix: 'arrow-up' },
      down  : { classSuffix: 'arrow-down' },
      '|'   : { classSuffix: 'divider' },
      remove: { classSuffix: 'delete' }
    },

    controlGroup: ['up', 'down', 'remove'],

    init: function () {
      this.observeCaptions();
      this.observeToolbars();
      this.observeKeyboard();
    },

    observeCaptions: function () {

      // adding a BR to empty captions and citations on click will put the cursor in the expected place
      // (centered for centered text)
      this.redactor.$editor.on('click', 'figcaption:empty, cite:empty', $.proxy(function (event) {
        $(event.target).prepend('<br>');
        this.redactor.selectionEnd(event.target);
        event.stopPropagation();
      }, this));

      // remove redactor generated <br> tags from otherwise empty figcaptions
      $(window).on('click', $.proxy(this.cleanCaptions, this));
      this.redactor.$editor.on('blur', $.proxy(this.cleanCaptions, this));
      this.redactor.$editor.closest('form').one('submit', $.proxy(this.clearCaptions, this));

      // prevent user from removing captions or citations with delete/backspace keys
      this.redactor.$editor.on('keydown', $.proxy(function (event) {
        var current         = this.redactor.getCurrent(),
            isEmpty        = !current.length,
            isCaptionNode = !!$(current).closest('figcaption, cite').length,
            isDeleteKey   = $.inArray(event.keyCode, [this.redactor.keyCode.BACKSPACE, this.redactor.keyCode.DELETE]) >= 0;

        if (isEmpty && isDeleteKey && isCaptionNode) {
          event.preventDefault();
        }
      }, this));

    },

    cleanCaptions: function () {
      this.redactor.$editor.find('figcaption, cite').filter(function () { return !$(this).text(); }).empty();
    },

    clearCaptions: function () {
      this.redactor.$editor.find('figcaption, cite').filter(function () { return !$(this).text(); }).remove();
      if (this.redactor.opts.visual) {
        this.redactor.sync();
      }
    },

    showToolbar: function (event) {
      var $figure = $(event.currentTarget),
          type = $figure.data('type') || 'default',
          $toolbar = this.getToolbar(type).data('figure', $figure).prependTo($figure);

      if (this.redactor[type] && this.redactor[type].onShow) {
        this.redactor[type].onShow($figure, $toolbar);
      }
    },

    hideToolbar: function (event) {
      $(event.currentTarget).find('.wy-figure-controls').appendTo(this.redactor.$box);
    },

    observeToolbars: function () {

      // before clicking a command, make sure we save the current node within the editor
      this.redactor.$editor.on('mousedown', '.wy-figure-controls', $.proxy(function () {
        event.preventDefault();
        this.current = this.redactor.getCurrent();
      }, this));

      this.redactor.$editor.on('click', '.wy-figure-controls span, .wy-figure-controls a', $.proxy(function (event) {

        event.stopPropagation();
        var $target = $(event.currentTarget),
            command = $target.data('command'),
            $figure = $target.closest('figure'),
            plugin  = this.redactor[$figure.data('type')];

        this.command(command, $figure, plugin);
      }, this));

      this.redactor.$editor.on('keydown', function () {
        $(this).find('figure').trigger('mouseleave');
      });

      if (this.redactor.isMobile()) {

        // if $editor is focused, click doesn't seem to fire
        this.redactor.$editor.on('touchstart', 'figure', function (event) {
          if (event.target.nodeName !== 'FIGCAPTION' && $(event.target).parents('.wy-figure-controls').length) {
            $(this).trigger('click', event);
          }
        });

        this.redactor.$editor.on('click', 'figure', $.proxy(function (event) {
          if (event.target.nodeName !== 'FIGCAPTION') {
            this.redactor.$editor.trigger('blur');
          }
          this.showToolbar(event);
        }, this));
      } else {
        // move toolbar into figure on mouseenter
        this.redactor.$editor.on('mouseenter', 'figure', $.proxy(this.showToolbar, this));

        // remove toolbar from figure on mouseleave
        this.redactor.$editor.on('mouseleave', 'figure', $.proxy(this.hideToolbar, this));
      }

    },

    getToolbar: function (type) {

      if (this.toolbar[type]) {
        return this.toolbar[type];
      }

      var controlGroup = (this.redactor[type] && this.redactor[type].controlGroup) || this.controlGroup,
          controls = $.extend({}, this.control, (this.redactor[type] && this.redactor[type].control) || {}),
          $controls = this.buildControls(controlGroup, controls),
          $toolbar = $('<div class="wy-figure-controls">').append($controls);

      this.toolbar[type] = $toolbar;

      return $toolbar;
    },

    buildControls: function (controlGroup, controls) {

      var $controls = $();

      $.each(controlGroup, $.proxy(function (index, command) {
        var control;
        // basic command
        if (typeof command === 'string') {
          control = controls[command];
          $controls = $controls.add($('<span>', {
            'class': 'wy-figure-controls-' + control.classSuffix,
            'text': control.text
          }).data({
            command: command,
            control: control
          }));
        }
        // dropdown
        else if (typeof command === 'object') {
          $.each(command, $.proxy(function (text, commands) {

            var dropdown = $('<span>').text(' ' + text).addClass('wy-figure-controls-table wy-dropdown');

            $('<span class="caret">').appendTo(dropdown);

            var list = $('<dl class="wy-dropdown-menu wy-dropdown-bubble wy-dropdown-arrow wy-dropdown-arrow-left">').appendTo(dropdown);

            dropdown.on('mouseover', function () {
              list.show();
            });

            dropdown.on('mouseout', function () {
              list.hide();
            });

            $.each(commands, $.proxy(function (index, command) {
              control = controls[command];
              if (command === '|') {
                $('<dd class="divider">').appendTo(list);
              } else {
                $('<a>', {
                  text: control.text
                }).data({
                  command: command,
                  control: control
                }).appendTo($('<dd>').appendTo(list));
              }
            }, this));

            $controls = $controls.add(dropdown);

          }, this));
        }
      }, this));

      return $controls;
    },

    command: function (command, $figure, plugin) {

      // move the toolbar before carrying out the command so it doesn't break when undoing/redoing
      $figure.find('.wy-figure-controls').appendTo(this.redactor.$box);

      // maintain undo buffer
      this.redactor.bufferSet(this.redactor.$editor.html());

      // only handle a few commands here, everything else should be taken care of from other plugins
      switch (command) {
        case 'up':
          $figure.prev().before($figure);
          break;

        case 'down':
          $figure.next().after($figure);
          break;

        case 'remove':
          $figure.remove();
          break;

        default:
          if (plugin && plugin.command) {
            plugin.command(command, $figure, $(this.current));
          }
          break;
      }

      this.redactor.sync();

    },

    observeKeyboard: function () {
      var redactor = this.redactor;
      redactor.$editor.on('keydown', function (event) {
        // delete key
        var currentNode = redactor.getBlock();
        if (event.keyCode === 8 && !redactor.getCaretOffset(currentNode) && currentNode.previousSibling && currentNode.previousSibling.nodeName === 'FIGURE') {
          event.preventDefault();
        }
      });
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.figure = {
    init: function () {
      this.figure = new Figure(this);
    }
  };

}(jQuery));

(function ($) {
  "use strict";

  // namespacing
  var Fixedtoolbar = function (redactor) {
    this.redactor = redactor;
    this.$window = $(redactor.window);
    this.$window.on('scroll', $.proxy(this.checkOffset, this));
    redactor.$box.on('scroll', $.proxy(this.checkOffset, this));

    this.redactor.$editor.on('focus', $.proxy(function () {
      this.isFocused = true;
    }, this));

    this.redactor.$editor.on('blur', $.proxy(function () {
      this.isFocused = false;
    }, this));
  };
  Fixedtoolbar.prototype = {
    isFixed: false,
    isFocused: false,

    checkOffset: function () {

      var boxOffset = this.redactor.$box.offset();

      var isBelowBoxTop = boxOffset.top - this.$window.scrollTop() <= 0;
      var isAboveBoxBottom = boxOffset.top + this.redactor.$box.outerHeight() - this.redactor.$toolbar.outerHeight() - this.$window.scrollTop() >= 0;

      if (isBelowBoxTop && isAboveBoxBottom) {
        this.fix();
      } else {
        this.unfix();
      }
    },

    fix: function () {

      if (this.isFixed) {

        // webkit does not recalc top: 0 when focused on contenteditable
        if (this.redactor.isMobile() && this.isFocused) {
          this.redactor.$toolbar.css({
            position: 'absolute',
            top     : this.$window.scrollTop() - this.redactor.$box.offset().top,
            left    : this.redactor.$box.offset().left
          });
        }

        return;
      }

      var border_left = parseInt(this.redactor.$box.css('border-left-width').replace('px', ''), 10);

      this.redactor.$toolbar.css({
        position: 'fixed',
        left    : this.redactor.$box.offset().left + border_left,
        width   : this.redactor.$box.width(),
        zIndex  : 1
      });

      this.redactor.$editor.css('padding-top', this.redactor.$toolbar.height() + 10);

      this.isFixed = true;

    },

    unfix: function () {
      if (!this.isFixed) {
        return;
      }

      this.redactor.$toolbar.css({
        position: 'relative',
        left    : '',
        width   : '',
        top     : ''
      });

      this.redactor.$editor.css('padding-top', 10);

      this.isFixed = false;
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.fixedtoolbar = {
    init: function () {
      this.fixedtoolbar = new Fixedtoolbar(this);
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  var RedactorPlugins = window.RedactorPlugins = window.RedactorPlugins || {};

  RedactorPlugins.fullscreen = {
    init: function()
    {
      this.fullscreen = false;

      this.buttonAdd('fullscreen', 'Fullscreen', $.proxy(this.toggleFullscreen, this));
      this.buttonGet('fullscreen').addClass('redactor_btn_fullscreen');
      this.buttonGet('fullscreen').parent().addClass('redactor_btn_right');

      if (this.opts.fullscreen) {
        this.toggleFullscreen();
      }
    },
    toggleFullscreen: function()
    {
      var html;

      if (!this.fullscreen)
      {
        this.buttonChangeIcon('fullscreen', 'normalscreen');
        this.buttonActive('fullscreen');
        this.fullscreen = true;

        if (this.opts.toolbarExternal)
        {
          this.toolcss = {};
          this.boxcss = {};
          this.toolcss.width = this.$toolbar.css('width');
          this.toolcss.top = this.$toolbar.css('top');
          this.toolcss.position = this.$toolbar.css('position');
          this.boxcss.top = this.$box.css('top');
        }

        this.fsheight = this.$editor.height();

        if (this.opts.maxHeight) {
          this.$editor.css('max-height', '');
        }
        if (this.opts.iframe) {
          html = this.get();
        }

        this.$box.addClass('redactor_box_fullscreen');
        $('body, html').css('overflow', 'hidden');

        if (this.opts.iframe) {
          this.fullscreenIframe(html);
        }

        this.fullScreenResize();
        $(window).resize($.proxy(this.fullScreenResize, this));
        $(document).scrollTop(0, 0);

        this.focus();
        this.observeStart();

      }
      else
      {
        this.buttonRemoveIcon('fullscreen', 'normalscreen');
        this.buttonInactive('fullscreen');
        this.fullscreen = false;

        $(window).off('resize', $.proxy(this.fullScreenResize, this));
        $('body, html').css('overflow', '');

        this.$box.removeClass('redactor_box_fullscreen').css({ width: 'auto', height: 'auto' });

        if (this.opts.iframe) {
          html = this.$editor.html();
        }

        if (this.opts.iframe) {
          this.fullscreenIframe(html);
        }
        else {
          this.sync();
        }

        var height = this.fsheight;
        if (this.opts.autoresize) {
          height = 'auto';
        }
        if (this.opts.maxHeight) {
          this.$editor.css('max-height', this.opts.maxHeight);
        }

        if (this.opts.toolbarExternal)
        {
          this.$box.css('top', this.boxcss.top);
          this.$toolbar.css({
            'width': this.toolcss.width,
            'top': this.toolcss.top,
            'position': this.toolcss.position
          });
        }

        if (!this.opts.iframe) {
          this.$editor.css('height', height);
        }
        else {
          this.$frame.css('height', height);
        }

        this.$editor.css('height', height);
        this.focus();
        this.observeStart();
      }

      $(window).trigger('scroll');

    },
    fullscreenIframe: function(html)
    {
      this.$editor = this.$frame.contents().find('body');
      this.$editor.attr({ 'contenteditable': true, 'dir': this.opts.direction });

      // set document & window
      if (this.$editor[0])
      {
        this.document = this.$editor[0].ownerDocument;
        this.window = this.document.defaultView || window;
      }

      // iframe css
      this.iframeAddCss();

      if (this.opts.fullpage) {
        this.setFullpageOnInit(html);
      }
      else {
        this.set(html);
      }

      if (this.opts.wym) {
        this.$editor.addClass('redactor_editor_wym');
      }
    },
    fullScreenResize: function()
    {
      if (!this.fullscreen) {
        return false;
      }

      var toolbarHeight = this.$toolbar.height();

      // var pad = this.$editor.css('padding-top').replace('px', '');
      var height = $(window).height() - toolbarHeight;
      this.$box.width($(window).width() - 2).height(height + toolbarHeight);

      if (this.opts.toolbarExternal)
      {
        this.$toolbar.css({
          'top': '0px',
          'position': 'absolute',
          'width': '100%'
        });

        this.$box.css('top', toolbarHeight + 'px');
      }

      // if (!this.opts.iframe) {
      //   this.$editor.height(height - (pad * 2));
      // }
      // else
      // {
      //   setTimeout($.proxy(function()
      //   {
      //     this.$frame.height(height);

      //   }, this), 1);
      // }

      // this.$editor.height(height);
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  // namespacing
  var Image = function (redactor) {
    this.redactor = redactor;
    this.init();
  };

  Image.prototype = {
    control: {
      left        : { classSuffix: 'arrow-left' },
      right       : { classSuffix: 'arrow-right' },
      small       : { classSuffix: 'small', text: 'S' },
      medium      : { classSuffix: 'medium', text: 'M' },
      resize_full : { classSuffix: 'resize-full' },
      resize_small: { classSuffix: 'resize-small' }
    },
    controlGroup: ['left', 'up', 'down', 'right', '|', 'small', 'medium', 'resize_full', 'resize_small', 'remove'],
    init: function () {
      this.redactor.$editor.on('focus', $.proxy(this.addCaptions, this));
      this.addCaptions();

      // this.redactor.$editor.on('mousedown', 'figure[data-type=image] img', function () {
      //   var range = document.createRange();
      //   range.selectNodeContents($(this).siblings('figcaption').get(0));
      //   var sel = window.getSelection();
      //   sel.removeAllRanges();
      //   sel.addRange(range);
      // });

      // this.redactor.$editor.on('touchstart', 'figure[data-type=image] img', $.proxy(function (event) {
      //   this.redactor.$editor.trigger('blur');
      //   $(this).trigger('mouseenter');
      //   event.preventDefault();
      //   event.stopPropagation();
      //   window.alert('touchstart');
      // }, this));
    },
    addCaptions: function () {
      // find images without captions, add empty figcaption
      this.redactor.$editor.find('figure[data-type=image]:not(:has(figcaption))').each(function () {
        $(this).append('<figcaption>');
      });
    },
    onShow: function ($figure, $toolbar) {

      $toolbar.children().removeClass('on');

      if ($figure.hasClass('wy-figure-small')) {
        $toolbar.find('.wy-figure-controls-small').show().addClass('on');
        $toolbar.find('.wy-figure-controls-medium').show();
        $toolbar.find('.wy-figure-controls-resize-full').show();
        $toolbar.find('.wy-figure-controls-resize-small').hide();
      }

      else if ($figure.hasClass('wy-figure-medium')) {
        $toolbar.find('.wy-figure-controls-small').show();
        $toolbar.find('.wy-figure-controls-medium').show().addClass('on');
        $toolbar.find('.wy-figure-controls-resize-full').show();
        $toolbar.find('.wy-figure-controls-resize-small').hide();
      }

      else {
        $toolbar.find('.wy-figure-controls-small').hide();
        $toolbar.find('.wy-figure-controls-medium').hide();
        $toolbar.find('.wy-figure-controls-large').hide();
        $toolbar.find('.wy-figure-controls-resize-full').hide();
        $toolbar.find('.wy-figure-controls-resize-small').show();
      }

      if ($figure.hasClass('wy-figure-right')) {
        $toolbar.find('.wy-figure-controls-arrow-right').addClass('on');
      }

      if ($figure.hasClass('wy-figure-left')) {
        $toolbar.find('.wy-figure-controls-arrow-left').addClass('on');
      }

    },
    command: function (command, $figure) {

      var classString = function (suffixArray, separator, prefix, dot) {
        var baseClass = (dot ? '.' : '') + 'wy-figure-' + (prefix || '');
        return baseClass + suffixArray.join((separator || ' ') + baseClass);
      };

      var changeSuffix = function (removeArray, addArray) {
        $figure.removeClass(classString(removeArray)).addClass(classString(addArray));
        $.each(addArray, function (index, command) {
          $figure.trigger('imageCommand', command);
        });
      };

      switch (command) {
        case 'left':
        case 'right':
          changeSuffix(['left', 'right'], [command]);
          if (!$figure.hasClass('wy-figure-medium') && !$figure.hasClass('wy-figure-small')) {
            $figure.addClass('wy-figure-medium');
            $figure.trigger('medium');
          }
          break;

        case 'small':
        case 'medium':
          changeSuffix(['small', 'medium', 'large'], [command]);
          if (!$figure.hasClass('wy-figure-left') && !$figure.hasClass('wy-figure-right')) {
            $figure.addClass('wy-figure-left');
            $figure.trigger('left');
          }
          break;

        case 'resize_full':
          changeSuffix(['small', 'medium', 'left', 'right'], ['large']);
          break;

        case 'resize_small':
          changeSuffix(['small', 'large', 'right'], ['medium', 'left']);
          break;
      }
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.image = {
    init: function () {
      this.image = new Image(this);
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  // namespacing
  var Quote = function (redactor) {
    this.redactor = redactor;
    this.init();
  };

  Quote.prototype = {
    control: {
      left        : { classSuffix: 'arrow-left' },
      right       : { classSuffix: 'arrow-right' },
      small       : { classSuffix: 'small', text: 'S' },
      medium      : { classSuffix: 'medium', text: 'M' },
      large       : { classSuffix: 'large', text: 'L' },
      resizeFull : { classSuffix: 'resize-full' },
      resizeSmall: { classSuffix: 'resize-small' }
    },
    controlGroup: ['left', 'up', 'down', 'right', '|', 'small', 'medium', 'large', 'resizeFull', 'resizeSmall', 'remove'],
    init: function () {
      this.redactor.$editor.on('focus', $.proxy(this.addCites, this));
      this.addCites();
      this.observe();
    },
    addCites: function () {
      // find quotes without citations, add empty cite
      this.redactor.$editor.find('figure[data-type=quote] blockquote:not(:has(cite))').each(function () {
        $(this).append('<cite>');
      });
    },
    observe: function () {
      this.redactor.$editor.on('mutate', $.proxy(this.orphanCheck, this));
    },
    orphanCheck: function () {
      this.redactor.$editor.find('blockquote').filter(function () {
        return !$(this).parents('figure').length;
      }).each(function () {
        $('<figure data-type="quote">').insertBefore(this).prepend($(this).append('<cite>'));
      });
    },
    onShow: function ($figure, $toolbar) {

      $toolbar.children().removeClass('on');

      if ($figure.hasClass('wy-figure-medium')) {
        $toolbar.find('.wy-figure-controls-medium').addClass('on');
      } else if ($figure.hasClass('wy-figure-large')) {
        $toolbar.find('.wy-figure-controls-large').addClass('on');
      } else {
        $toolbar.find('.wy-figure-controls-small').addClass('on');
      }

      if ($figure.hasClass('wy-figure-left')) {
        $toolbar.find('.wy-figure-controls-arrow-left').addClass('on');
        $toolbar.find('.wy-figure-controls-resize-small').hide();
        $toolbar.find('.wy-figure-controls-resize-full').show();
      } else if ($figure.hasClass('wy-figure-right')) {
        $toolbar.find('.wy-figure-controls-arrow-right').addClass('on');
        $toolbar.find('.wy-figure-controls-resize-small').hide();
        $toolbar.find('.wy-figure-controls-resize-full').show();
      } else {
        $toolbar.find('.wy-figure-controls-resize-small').show();
        $toolbar.find('.wy-figure-controls-resize-full').hide();
      }

    },
    command: function (command, $figure) {

      switch (command) {
        case 'left':
          $figure.removeClass('wy-figure-right').addClass('wy-figure-left');
          break;

        case 'right':
          $figure.removeClass('wy-figure-left').addClass('wy-figure-right');
          break;

        case 'resize_full':
          $figure.removeClass('wy-figure-left wy-figure-right');
          break;

        case 'resize_small':
          $figure.addClass('wy-figure-left');
          break;

        case 'small':
          $figure.removeClass('wy-figure-medium wy-figure-large').addClass('wy-figure-small');
          break;

        case 'medium':
          $figure.removeClass('wy-figure-small wy-figure-large').addClass('wy-figure-medium');
          break;

        case 'large':
          $figure.removeClass('wy-figure-small wy-figure-medium').addClass('wy-figure-large');
          break;
      }

    },
    toggle: function () {

        this.redactor.formatQuote();

        var $target = $(this.redactor.getBlock() || this.redactor.getCurrent());

        if ($target.is('blockquote')) {
          $('<figure data-type="quote">').insertBefore($target).prepend($target).append('<cite>');
        } else {
          $target.closest('figure').before($target).remove();
          $target.find('cite').remove();
        }

        this.redactor.sync();

      }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.quote = {
    init: function () {
      this.quote = new Quote(this);
      this.buttonAddBefore('link', 'quote', 'Quote', $.proxy(this.quote.toggle, this.quote));
      this.buttonGet('quote').addClass('redactor_btn_quote');
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  // namespacing
  var Table = function (redactor) {
    this.redactor = redactor;
  };
  Table.prototype = {
    control: {
      rowUp     : { text: 'Add row above' },
      rowDown   : { text: 'Add row below' },
      colLeft   : { text: 'Add column left' },
      colRight  : { text: 'Add column right' },
      addHead   : { text: 'Add header' },
      delHead   : { text: 'Delete header' },
      delCol    : { text: 'Delete column' },
      delRow    : { text: 'Delete row' },
      delTable  : { text: 'Delete table' },
      stripe    : { text: 'Striped row' },
      border    : { text: 'Borders on rows' },
      fullBorder: { text: 'Borders everywhere' }
    },
    controlGroup: [ 'up', 'down', '|', {
      'Table Options': [
        'rowUp', 'rowDown', 'colLeft', 'colRight', '|',
        'addHead', 'delHead', '|',
        'delCol', 'delRow', 'delTable', '|',
        'border', 'stripe', 'fullBorder'
      ]
    }, 'remove'],
    insertTable: function (rows, columns) {

      var $tableBox = $('<div></div>'),
          tableId = Math.floor(Math.random() * 99999),
          $table = $('<table id="table' + tableId + '">'),
          $thead = $('<thead>').appendTo($table),
          $tbody = $('<tbody>').appendTo($table),
          i, $row, z, $column;

      $row = $('<tr>').appendTo($thead);
      for (z = 0; z < columns; z++) {
        $('<th>Header</th>').appendTo($row);
      }

      for (i = 0; i < rows; i++) {
        $row = $('<tr>');

        for (z = 0; z < columns; z++) {
          $column = $('<td>Data</td>');

          // set the focus to the first td
          if (i === 0 && z === 0) {
            $column.append('<span id="selection-marker-1">' + this.redactor.opts.invisibleSpace + '</span>');
          }

          $($row).append($column);
        }

        $tbody.append($row);
      }

      $('<figure data-type="table">').addClass('wy-table wy-table-bordered-rows').append($table).appendTo($tableBox);
      var html = $tableBox.html();

      this.redactor.modalClose();
      this.redactor.selectionRestore();

      // maintain undo buffer
      this.redactor.bufferSet(this.redactor.$editor.html());

      var current = this.redactor.getBlock() || this.redactor.getCurrent();
      if (current) {
        $(current).after(html);
      } else {
        this.redactor.insertHtmlAdvanced(html, false);
      }

      this.redactor.selectionRestore();

      var table = this.redactor.$editor.find('#table' + tableId);

      table.find('span#selection-marker-1').remove();
      table.removeAttr('id');

      this.redactor.sync();

    },
    command: function (command, $figure, $target) {

      switch (command) {
      case 'rowUp':
      case 'rowDown':
        $.proxy(function () {
          var $row = $target.closest('tr'), i, $clone = $('<tr>');
          for (i = 0; i < $row.children().length; i++) {
            $('<td>').text('Data').appendTo($clone);
          }
          if (command === 'rowUp') {
            $clone.insertBefore($row);
          } else {
            $clone.insertAfter($row);
          }
        }, this)();
        break;

      case 'colLeft':
      case 'colRight':
        $.proxy(function () {
          var $cell = $target.closest('td'),
              $row = $cell.closest('tr'),
              $table = $row.closest('table'),
              position = $row.children().index($cell) + 1,
              insertPosition = command === 'colLeft' ? 'before' : 'after';

          $table.find('thead tr').children(':nth-child(' + position + ')')[insertPosition]($('<th>').text('Header'));
          $table.find('tbody tr').children(':nth-child(' + position + ')')[insertPosition]($('<td>').text('Data'));
        }, this)();
        break;

      case 'addHead':
        if (!$figure.find('table thead').length) {
          $.proxy(function () {
            var numCols = $figure.find('tr').first().children().length,
                $table = $figure.find('table'),
                $thead = $('<thead>').prependTo($table),
                $row = $('<tr>').appendTo($thead);

            for (var i = 0; i < numCols; i++) {
              $('<th>').text('Header').appendTo($row);
            }
          }, this)();
        }
        break;

      case 'delHead':
        $figure.find('thead').remove();
        break;

      case 'delCol':
        $.proxy(function () {
          var $cell = $target.closest('td'),
              position = $cell.parent().children().index($cell) + 1;
          $cell.closest('table').find('tr').children(':nth-child(' + position + ')').remove();
        }, this)();
        break;

      case 'delRow':
        $target.closest('tr').remove();
        break;

      case 'delTable':
        $figure.remove();
        break;

      case 'border':
        $figure.removeClass('wy-table-bordered-all').toggleClass('wy-table-bordered-rows');
        break;

      case 'stripe':
        $figure.toggleClass('wy-table-striped');
        break;

      case 'fullBorder':
        $figure.removeClass('wy-table-bordered-rows').toggleClass('wy-table-bordered-all');
        break;
      }
    }
  };

  // Hook up plugin to Redactor.
  window.RedactorPlugins = window.RedactorPlugins || {};
  window.RedactorPlugins.table = {
    init: function () {
      this.table = new Table(this);
      this.buttonAddBefore('link', 'table', 'Table', $.proxy(function () {

        // save cursor position
        this.selectionSave();

        var callback = $.proxy(function () {

          $('#redactor_insert_table_btn').on('click', $.proxy(function () {
            this.table.insertTable($('#redactor_table_rows').val(), $('#redactor_table_columns').val());
            this.buttonInactive('table');
          }, this));

          $('.redactor_btn_modal_close').on('click', $.proxy(function () {
            this.buttonInactive('table');
          }, this));

          setTimeout(function () {
            $('#redactor_table_rows').trigger('focus');
          }, 200);

        }, this);

        var modal = String() +
          '<section>' +
            '<label>' + this.opts.curLang.rows + '</label>' +
            '<input type="text" size="5" value="2" id="redactor_table_rows">' +
            '<label>' + this.opts.curLang.columns + '</label>' +
            '<input type="text" size="5" value="3" id="redactor_table_columns">' +
          '</section>' +
          '<footer>' +
            '<input type="button" class="redactor_modal_btn redactor_btn_modal_close" value="' + this.opts.curLang.cancel + '" />' +
            '<input type="button" class="redactor_modal_btn" id="redactor_insert_table_btn" value="' + this.opts.curLang.insert + '" />' +
          '</footer>';

        this.modalInit('Insert Table', modal, 500, callback);

      }, this));
      this.buttonGet('table').addClass('redactor_btn_table');
    }
  };

}(jQuery));

(function ($) {
  'use strict';

  // namespacing
  var Video = function (redactor) {
    this.redactor = redactor;
    this.init();
  };

  Video.prototype = {
    control: {
      resizeFull : { classSuffix: 'resize-full' },
      resizeSmall: { classSuffix: 'resize-small' }
    },
    controlGroup: ['up', 'down', '|', 'resizeFull', 'resizeSmall', 'remove'],
    init: function () {
      // find videos without captions, add empty figcaption
      this.redactor.$editor.find('figure[data-type=video]:not(:has(figcaption))').each(function () {
        $(this).append('<figcaption>');
      });
    },
    onShow: function ($figure, $toolbar) {

      if ($figure.hasClass('wy-figure-full')) {
        $toolbar.find('.wy-figure-controls-resize-full').hide();
        $toolbar.find('.wy-figure-controls-resize-small').show();
      } else {
        $toolbar.find('.wy-figure-controls-resize-full').show();
        $toolbar.find('.wy-figure-controls-resize-small').hide();
      }

    },
    command: function (command, $figure) {
      if (command === 'resize_full') {
        $figure.addClass('wy-figure-full');
      } else if (command === 'resize_small') {
        $figure.removeClass('wy-figure-full');
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

        data = '<figure data-type="video"><p>' + this.cleanStripTags(data) + '</p><figcaption></figcaption></figure>';

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
            '<input type="button" class="redactor_modal_btn redactor_btn_modal_close" value="' + this.opts.curLang.cancel + '" />' +
            '<input type="button" class="redactor_modal_btn" id="redactor_insert_video_btn" value="' + this.opts.curLang.insert + '" />' +
          '</footer>';

        // or call a modal with a code
        this.modalInit('Insert Video', modal, 500, callback);

      }, this));

      this.buttonGet('video').addClass('redactor_btn_video');

    }
  };

}(jQuery));

(function ($) {

  'use strict';

  // Collection method.
  $.fn.webhookRedactor = function (options) {
    // Act as proxy to redactor.
    return this.redactor(typeof options === 'string' ? options : $.extend({}, $.webhookRedactor.options, options));
  };

  // Static method.
  $.webhookRedactor = function (options) {
    // Override default options with passed-in options.
    return $.extend({}, $.webhookRedactor.options, options);
  };

  // Static method default options.
  $.webhookRedactor.options = {
    // We roll our own image plugin.
    observeImages: false,
    buttons: ['formatting', 'bold', 'italic', 'unorderedlist', 'orderedlist', 'link', 'html'],
    // Custom plugins.
    plugins: ['cleanup', 'fullscreen', 'fixedtoolbar', 'autoembedly', 'figure', 'image', 'video', 'table', 'quote'],
    // Sync textarea with editor before submission.
    initCallback: function () {
      $.each(this.opts.buttons, $.proxy(function (index, button) {
        this.buttonGet(button).addClass('redactor_btn_' + button);
      }, this));

      this.$element.closest('form').one('submit', $.proxy(function () {
        // only sync if we're in visual mode
        if (this.opts.visual) {
          this.sync();
        }
      }, this));
      this.$element.trigger('init.webhookRedactor', this.getObject());
    },
    // Expose change event.
    changeCallback: function () {

      // Ensure first and last elements are always P
      var borderSelector = 'p, h1, h2, h3, h4, h5';

      if (!this.$editor.children(':first-child').is(borderSelector)) {
        this.$editor.prepend('<p><br></p>');
      }

      if (!this.$editor.children(':last-child').is(borderSelector)) {
        this.$editor.append('<p><br></p>');
      }

      this.$editor.trigger('mutate');
      this.$element.trigger('mutate.webhookRedactor', this.getObject());

    }
  };

}(jQuery));
