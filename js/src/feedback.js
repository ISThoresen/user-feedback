/**
 * Feedback.js Script.
 *
 * Original script was released by Kázmér Rapavi under the MIT license.
 * This plugin uses version 2.0 of his script.
 *
 * @see https://github.com/ivoviz/feedback
 *
 * @package   User_Feedback
 * @author    Pascal Birchler <pascal@required.ch>
 * @license   GPL-2.0+
 * @link      https://github.com/wearerequired/user-feedback/
 * @copyright 2015 required gmbh
 */

(function ($) {

  /**
   * Settings
   */

  var settings = {
    ajaxURL          : user_feedback.ajax_url,
    initButtonText   : user_feedback.button_text,
    initialBox       : document.cookie.indexOf('user_feedback_dont_show_again') < 0,
    // todo: probably should make these canvas options available in `wp_localize_script`
    strokeStyle      : 'black',
    shadowColor      : 'black',
    shadowOffsetX    : 1,
    shadowOffsetY    : 1,
    shadowBlur       : 10,
    lineJoin         : 'bevel',
    lineWidth        : 3,
    tpl              : {
      description  : user_feedback.tpl.description,
      highlighter  : user_feedback.tpl.highlighter,
      overview     : user_feedback.tpl.overview,
      submitSuccess: user_feedback.tpl.submit_success,
      submitError  : user_feedback.tpl.submit_error
    }
  };

  /**
   * Init
   */

  // Basically every browser except IE8 supports <canvas>
  var supportedBrowser = !!window.HTMLCanvasElement;
  if (supportedBrowser) {
    $('body').append('<button id="user-feedback-init-button" class="user-feedback-button user-feedback-button-gray">' + settings.initButtonText + '</button>');

    // What happens after clicking the initial feedback button
    $(document).on('click', '#user-feedback-init-button', function () {
      // Hide the button itself
      $(this).addClass('hidden');

      // Initial variables
      var canDraw = false,
          img = '',
          h = $(document).height(),
          w = $(document).width(),
          tpl = '<div id="user-feedback-module">';

      if (settings.initialBox) {
        tpl += settings.tpl.description;
      }

      tpl += settings.tpl.highlighter + settings.tpl.overview + '<canvas id="user-feedback-canvas"></canvas><div id="user-feedback-helpers"></div><input id="user-feedback-note" name="user-feedback-note" type="hidden"></div>';

      // Add the template markup
      $('body').append(tpl);

      canvasAttr = {
        'width' : w,
        'height': h
      };

      $('#user-feedback-canvas').attr(canvasAttr).css('z-index', '30000');

      if (!settings.initialBox) {
        $('#user-feedback-highlighter-back').remove();
        canDraw = true;
        $('#user-feedback-canvas').css('cursor', 'crosshair');
        $('#user-feedback-helpers').removeClass('hidden');
        $('#user-feedback-welcome').addClass('hidden');
        $('#user-feedback-highlighter').removeClass('hidden');
      }

      var ctx = $('#user-feedback-canvas')[0].getContext('2d');

      ctx.fillStyle = 'rgba(102,102,102,0.5)';
      ctx.fillRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());

      rect = {};
      drag = false;
      highlight = 1;
      post = {};

      /**
       * Detect browser name + version. Example: Chrome 40, Internet Explorer 12
       * @see http://stackoverflow.com/questions/5916900/how-can-you-detect-the-version-of-a-browser
       */
      navigator.sayswho = (function () {
        var ua = navigator.userAgent, tem,
            M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
        if (/trident/i.test(M[1])) {
          tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
          return 'Internet Explorer ' + (tem[1] || '');
        }
        if (M[1] === 'Chrome') {
          tem = ua.match(/\bOPR\/(\d+)/)
          if (tem != null) return 'Opera ' + tem[1];
        }
        M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
        if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
        return M.join(' ');
      })();

      // Already append debug information to the overview screen
      $('#user-feedback-additional-theme').append(' <span>' + user_feedback.theme.name + '</span>');
      $('#user-feedback-additional-browser').append(' <span>' + navigator.sayswho + '</span>');
      $('#user-feedback-additional-template').append(' <span>' + user_feedback.theme.current_template + '</span>');
      $('#user-feedback-additional-language').append(' <span>' + user_feedback.language + '</span>');

      // Set up initial post data to be sent
      post.browser = {};
      post.browser.name = navigator.sayswho;
      post.browser.cookieEnabled = navigator.cookieEnabled;
      post.browser.platform = navigator.platform;
      post.browser.userAgent = navigator.userAgent;
      post.url = document.URL;
      post.theme = user_feedback.theme;
      post.language = user_feedback.language;

      $(document).on('mousedown', '#user-feedback-canvas', function (e) {
        if (canDraw) {
          rect.startX = e.pageX - $(this).offset().left;
          rect.startY = e.pageY - $(this).offset().top;
          rect.w = 0;
          rect.h = 0;
          drag = true;
        }
      });

      $(document).on('mouseup', function () {
        if (canDraw) {
          drag = false;

          var dtop = rect.startY,
              dleft = rect.startX,
              dwidth = rect.w,
              dheight = rect.h;
          dtype = 'highlight';

          if (dwidth == 0 || dheight == 0) return;

          if (dwidth < 0) {
            dleft += dwidth;
            dwidth *= -1;
          }
          if (dheight < 0) {
            dtop += dheight;
            dheight *= -1;
          }

          if (dtop + dheight > $(document).height())
            dheight = $(document).height() - dtop;
          if (dleft + dwidth > $(document).width())
            dwidth = $(document).width() - dleft;

          if (highlight == 0)
            dtype = 'blackout';

          $('#user-feedback-helpers').append('<div class="user-feedback-helper" data-type="' + dtype + '" data-time="' + Date.now() + '" style="position:absolute;top:' + dtop + 'px;left:' + dleft + 'px;width:' + dwidth + 'px;height:' + dheight + 'px;z-index:30000;"></div>');

          redraw(ctx);
          rect.w = 0;
        }

      });

      $(document).on('mousemove', function (e) {
        if (canDraw && drag) {
          $('#user-feedback-highlighter').css('cursor', 'default');

          rect.w = (e.pageX - $('#user-feedback-canvas').offset().left) - rect.startX;
          rect.h = (e.pageY - $('#user-feedback-canvas').offset().top) - rect.startY;

          ctx.clearRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());
          ctx.fillStyle = 'rgba(102,102,102,0.5)';
          ctx.fillRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());
          $('.user-feedback-helper').each(function () {
            if ($(this).attr('data-type') == 'highlight')
              drawlines(ctx, parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
          });
          if (highlight == 1) {
            drawlines(ctx, rect.startX, rect.startY, rect.w, rect.h);
            ctx.clearRect(rect.startX, rect.startY, rect.w, rect.h);
          }
          $('.user-feedback-helper').each(function () {
            if ($(this).attr('data-type') == 'highlight')
              ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
          });
          $('.user-feedback-helper').each(function () {
            if ($(this).attr('data-type') == 'blackout') {
              ctx.fillStyle = 'rgba(0,0,0,1)';
              ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height())
            }
          });
          if (highlight == 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(rect.startX, rect.startY, rect.w, rect.h);
          }
        }
      });

      var highlighted = [],
          tmpHighlighted = [],
          hidx = 0;

      $(document).on('mousemove click', '#user-feedback-canvas', function (e) {
        if (canDraw) {
          redraw(ctx);
          tmpHighlighted = [];

          $('#user-feedback-canvas').css('cursor', 'crosshair');

          $('* :not(body,script,iframe,div,section,.user-feedback-button,#user-feedback-module *)').each(function () {
            if ($(this).attr('data-highlighted') === 'true')
              return;

            if (e.pageX > $(this).offset().left && e.pageX < $(this).offset().left + $(this).width() && e.pageY > $(this).offset().top + parseInt($(this).css('padding-top'), 10) && e.pageY < $(this).offset().top + $(this).height() + parseInt($(this).css('padding-top'), 10)) {
              tmpHighlighted.push($(this));
            }
          });

          var $toHighlight = tmpHighlighted[tmpHighlighted.length - 1];

          if ($toHighlight && !drag) {
            $('#user-feedback-canvas').css('cursor', 'pointer');

            var _x = $toHighlight.offset().left - 2,
                _y = $toHighlight.offset().top - 2,
                _w = $toHighlight.width() + parseInt($toHighlight.css('padding-left'), 10) + parseInt($toHighlight.css('padding-right'), 10) + 6,
                _h = $toHighlight.height() + parseInt($toHighlight.css('padding-top'), 10) + parseInt($toHighlight.css('padding-bottom'), 10) + 6;

            if (highlight == 1) {
              drawlines(ctx, _x, _y, _w, _h);
              ctx.clearRect(_x, _y, _w, _h);
              dtype = 'highlight';
            }

            $('.user-feedback-helper').each(function () {
              if ($(this).attr('data-type') == 'highlight')
                ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
            });

            if (highlight == 0) {
              dtype = 'blackout';
              ctx.fillStyle = 'rgba(0,0,0,0.5)';
              ctx.fillRect(_x, _y, _w, _h);
            }

            $('.user-feedback-helper').each(function () {
              if ($(this).attr('data-type') == 'blackout') {
                ctx.fillStyle = 'rgba(0,0,0,1)';
                ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
              }
            });

            if (e.type == 'click' && e.pageX == rect.startX && e.pageY == rect.startY) {
              $('#user-feedback-helpers').append('<div class="user-feedback-helper" data-highlight-id="' + hidx + '" data-type="' + dtype + '" data-time="' + Date.now() + '" style="position:absolute;top:' + _y + 'px;left:' + _x + 'px;width:' + _w + 'px;height:' + _h + 'px;z-index:30000;"></div>');
              highlighted.push(hidx);
              ++hidx;
              redraw(ctx);
            }
          }
        }
      });

      $(document).on('mouseleave', 'body,#user-feedback-canvas', function () {
        redraw(ctx);
      });

      $(document).on('mouseenter', '.user-feedback-helper', function () {
        redraw(ctx);
      });

      // What happens after clicking next on the intro screen
      $(document).on('click', '#user-feedback-welcome-next', function () {
        if ($('#user-feedback-note-tmp').val().length > 0) {
          canDraw = true;
          $('#user-feedback-canvas').css('cursor', 'crosshair');
          $('#user-feedback-helpers').addClass('hidden');
          $('#user-feedback-welcome').addClass('hidden');
          $('#user-feedback-highlighter').removeClass('hidden');

          // Fill in the text of the textarea into the one on the overview screen
          $('#user-feedback-overview-note').val($('#user-feedback-note-tmp').val());
        } else {
          // Error, description has to be filled out
          $('#user-feedback-welcome-error').removeClass('hidden');
        }
      });

      $(document).on('mouseenter mouseleave', '.user-feedback-helper', function (e) {
        if (drag)
          return;

        rect.w = 0;
        rect.h = 0;

        if (e.type === 'mouseenter') {
          $(this).css('z-index', '30001');
          $(this).append('<div class="user-feedback-helper-inner" style="width:' + ($(this).width() - 2) + 'px;height:' + ($(this).height() - 2) + 'px;position:absolute;margin:1px;"></div>');
          $(this).append('<div id="user-feedback-close"></div>');
          $(this).find('#user-feedback-close').css({
            'top' : -1 * ($(this).find('#user-feedback-close').height() / 2) + 'px',
            'left': $(this).width() - ($(this).find('#user-feedback-close').width() / 2) + 'px'
          });

          if ($(this).attr('data-type') == 'blackout') {
            /* redraw white */
            ctx.clearRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());
            ctx.fillStyle = 'rgba(102,102,102,0.5)';
            ctx.fillRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());
            $('.user-feedback-helper').each(function () {
              if ($(this).attr('data-type') == 'highlight')
                drawlines(ctx, parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
            });
            $('.user-feedback-helper').each(function () {
              if ($(this).attr('data-type') == 'highlight')
                ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
            });

            ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height())
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());

            ignore = $(this).attr('data-time');

            /* redraw black */
            $('.user-feedback-helper').each(function () {
              if ($(this).attr('data-time') == ignore)
                return true;
              if ($(this).attr('data-type') == 'blackout') {
                ctx.fillStyle = 'rgba(0,0,0,1)';
                ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height())
              }
            });
          }
        }
        else {
          $(this).css('z-index', '30000');
          $(this).children().remove();
          if ($(this).attr('data-type') == 'blackout') {
            redraw(ctx);
          }
        }
      });

      $(document).on('click', '#user-feedback-close', function () {
        if (settings.highlightElement && $(this).parent().attr('data-highlight-id'))
          var _hidx = $(this).parent().attr('data-highlight-id');

        $(this).parent().remove();

        if (settings.highlightElement && _hidx)
          $('[data-highlight-id="' + _hidx + '"]').removeAttr('data-highlighted').removeAttr('data-highlight-id');

        redraw(ctx);
      });

      // What happens after clicking the close buttons in the modals
      $('#user-feedback-module').on('click', '.user-feedback-wizard-close,.user-feedback-button-close', function () {
        close();
      });

      $(document).on('keyup', function (e) {
        if (e.keyCode == 27)
          close();
      });

      $(document).on('selectstart dragstart', document, function (e) {
        e.preventDefault();
      });

      // What happens after clicking back on the highlighter bar
      $(document).on('click', '#user-feedback-highlighter-back', function () {
        canDraw = false;
        $('#user-feedback-canvas').css('cursor', 'default');
        $('#user-feedback-helpers').addClass('hidden');
        $('#user-feedback-highlighter').addClass('hidden');
        $('#user-feedback-welcome-error').addClass('hidden');
        $('#user-feedback-welcome').removeClass('hidden');
      });

      $(document).on('mousedown', '.user-feedback-sethighlight', function () {
        highlight = 1;
        $(this).addClass('user-feedback-active');
        $('.user-feedback-setblackout').removeClass('user-feedback-active');
      });

      $(document).on('mousedown', '.user-feedback-setblackout', function () {
        highlight = 0;
        $(this).addClass('user-feedback-active');
        $('.user-feedback-sethighlight').removeClass('user-feedback-active');
      });

      // What happens after clicking next on the highlighter bar
      $(document).on('click', '#user-feedback-highlighter-next', function () {
        canDraw = false;
        $('#user-feedback-canvas').css('cursor', 'default');
        var sy = $(document).scrollTop(),
            dh = $(window).height();
        $('#user-feedback-helpers').addClass('hidden');
        $('#user-feedback-highlighter').addClass('hidden');
        html2canvas($('body'), {
          onrendered     : function (canvas) {
            if (!settings.screenshotStroke) {
              redraw(ctx);
            }
            _canvas = $('<canvas id="user-feedback-canvas-tmp" width="' + w + '" height="' + dh + '"/>').hide().appendTo('body');
            _ctx = _canvas.get(0).getContext('2d');
            _ctx.drawImage(canvas, 0, sy, w, dh, 0, 0, w, dh);
            img = _canvas.get(0).toDataURL();
            $(document).scrollTop(sy);
            post.img = img;

            $('#user-feedback-canvas-tmp').remove();
            $('#user-feedback-overview').toggleClass('hidden');
            $('user-feedback-overview-note').val($('#user-feedback-note').val());
            $('#user-feedback-overview-screenshot-img').attr('src', img);

            // Display image size
            $('#user-feedback-screenshot-size span').remove();
            $('#user-feedback-screenshot-size').append(' <span>' + $('#user-feedback-overview-screenshot-img')[0].naturalWidth + 'x' + $('#user-feedback-overview-screenshot-img')[0].naturalHeight + '</span>');

            // Display number of highlighted areas
            $('#user-feedback-screenshot-highlighted span').remove();
            if ($('.user-feedback-helper').length <= 1) {
              $('#user-feedback-screenshot-highlighted').append(' <span>' + $('.user-feedback-helper').length + ' ' + $('#user-feedback-screenshot-highlighted').attr('data-single') + '</span>');
            } else {
              $('#user-feedback-screenshot-highlighted').append(' <span>' + $('.user-feedback-helper').length + ' ' + $('#user-feedback-screenshot-highlighted').attr('data-multiple') + '</span>');
            }
          }
        });
      });

      // What happens after clicking back on the overview screen
      $(document).on('click', '#user-feedback-overview-back', function (e) {
        canDraw = true;
        $('#user-feedback-canvas').css('cursor', 'crosshair');
        $('#user-feedback-overview').addClass('hidden');
        $('#user-feedback-helpers').removeClass('hidden');
        $('#user-feedback-highlighter').removeClass('hidden');
        $('#user-feedback-overview-error').addClass('hidden');

        // Fill in the text of the textarea into the one on the welcome screen
        $('#user-feedback-note-tmp').val($('#user-feedback-overview-note').val());
      });

      // What happens after submitting the data
      $(document).on('click', '#user-feedback-submit', function () {
        canDraw = false;

        if ($('#user-feedback-overview-note').val().length > 0) {
          $('#user-feedback-submit-success,#user-feedback-submit-error').remove();
          $('#user-feedback-overview').addClass('hidden');

          post.img = img;
          post.note = $('#user-feedback-note').val();
          $.post(
              settings.ajaxURL,
              {
                'action': 'user_feedback',
                'data'  : post
              },
              function () {
                // Set our "do not show again" cookie
                var date = new Date();
                date.setDate(date.getDate() + 30);
                document.cookie = 'user_feedback_dont_show_again=1; path=/;expires=' + date.toUTCString();

                // Success template
                $('#user-feedback-module').append(settings.tpl.submitSuccess);
              }
          )
              .fail(function () {
                // Error template
                $('#user-feedback-module').append(settings.tpl.submitError);
              });
        } else {
          $('#user-feedback-overview-error').removeClass('hidden');
        }
      });
    });
  }

  // Close the user feedback plugin
  function close() {
    canDraw = false;
    $(document).off('mouseenter mouseleave', '.user-feedback-helper');
    $(document).off('mouseup keyup');
    $(document).off('mousedown', '.user-feedback-setblackout');
    $(document).off('mousedown', '.user-feedback-sethighlight');
    $(document).off('mousedown click', '#user-feedback-close');
    $(document).off('mousedown', '#user-feedback-canvas');
    $(document).off('click', '#user-feedback-highlighter-next');
    $(document).off('click', '#user-feedback-highlighter-back');
    $(document).off('click', '#user-feedback-welcome-next');
    $(document).off('click', '#user-feedback-overview-back');
    $(document).off('mouseleave', 'body');
    $(document).off('mouseenter', '.user-feedback-helper');
    $(document).off('selectstart dragstart', document);
    $('#user-feedback-module').off('click', '.user-feedback-wizard-close,.user-feedback-button-close');
    $(document).off('click', '#user-feedback-submit');

    if (settings.highlightElement) {
      $(document).off('click', '#user-feedback-canvas');
      $(document).off('mousemove', '#user-feedback-canvas');
    }
    $('[data-highlighted="true"]').removeAttr('data-highlight-id').removeAttr('data-highlighted');
    $('#user-feedback-module').remove();
    $('#user-feedback-init-button').removeClass('hidden');
  }

  function redraw(ctx, border) {
    border = typeof border !== 'undefined' ? border : true;
    ctx.clearRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());
    ctx.fillStyle = 'rgba(102,102,102,0.5)';
    ctx.fillRect(0, 0, $('#user-feedback-canvas').width(), $('#user-feedback-canvas').height());
    $('.user-feedback-helper').each(function () {
      if ($(this).attr('data-type') == 'highlight')
        if (border)
          drawlines(ctx, parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
    });
    $('.user-feedback-helper').each(function () {
      if ($(this).attr('data-type') == 'highlight')
        ctx.clearRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
    });
    $('.user-feedback-helper').each(function () {
      if ($(this).attr('data-type') == 'blackout') {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(parseInt($(this).css('left'), 10), parseInt($(this).css('top'), 10), $(this).width(), $(this).height());
      }
    });
  }

  function drawlines(ctx, x, y, w, h) {
    // set our styles for the rectangle
    ctx.strokeStyle = settings.strokeStyle;
    ctx.shadowColor = settings.shadowColor;
    ctx.shadowOffsetX = settings.shadowOffsetX;
    ctx.shadowOffsetY = settings.shadowOffsetY;
    ctx.shadowBlur = settings.shadowBlur;
    ctx.lineJoin = settings.lineJoin;
    ctx.lineWidth = settings.lineWidth;

    ctx.strokeRect(x, y, w, h);

    // reset styles again
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
  }

}(jQuery));