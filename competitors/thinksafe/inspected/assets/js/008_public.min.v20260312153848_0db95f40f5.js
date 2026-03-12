function rsConfirm(options) {
  if (!('message' in options)) {
    window.devLog('Please enter a message');
    return;
  }
  if (!('button1' in options)) {
    window.devLog('Please specify your confirmation button');
    return;
  }
  var containerClass = '';
  if ('containerClass' in options) {
    containerClass = options.containerClass;
  }
  var formatting = true;
  if ('formatting' in options) {
    formatting = options.formatting;
  }
  var publicUse = 'public' in options;
  var content = '';
  if (formatting) {
    content = '<p class="m-0 m-r-20 m-l-20 p-0 t-darkgreen">' + options.message + '</p>';
  } else {
    content = options.message;
  }
  var button1Class = ' button black-button ';
  var button2Class = ' button light cancel-button';
  var buttonAlignment = ' text-right';
  var buttonMargin = ' m-l-10';
  if (publicUse) {
    content = '<p class="m-0 p-0 p">' + options.message + '</p>';
    containerClass += ' public';
    button1Class = ' shop-button fill';
    button2Class = ' shop-button outline m-r-10';
    buttonMargin = '';
  }
  if (!('button2' in options)) {
    buttonAlignment = '';
  }
  buttons = '<div class="button-container' + buttonAlignment + ' m-t-25">';
  if ('button2' in options) {
    buttons += '<button class="confirm-no' + button2Class + '">' + options.button2.text + '</button>';
  }
  buttons += '<button class="confirm-yes' + buttonMargin + ' ' + button1Class + '">' + options.button1.text + '</button>';
  buttons += '</div>';
  var closeButton = false;
  if (typeof options.closeButton !== 'undefined') {
    closeButton = true;
  }
  var overlayClose = false;
  if (typeof options.overlayClose !== 'undefined') {
    overlayClose = true;
  }
  var width = false;
  if (typeof options.width !== 'undefined') {
    width = options.width;
  }
  $.fn.popup({
    overlayClose: overlayClose,
    htmlContent: '<div class="confirm-popup p-30">' + content + buttons + '</div>',
    closeButton: closeButton,
    containerClassName: 'confirm-popup ' + containerClass,
    width: width
  });
  var $popup = $('.confirm-popup');
  $popup.find('.confirm-yes').one('click', function () {
    $('.popup-close').click();
    if (typeof options.button1.onClick == 'function') {
      options.button1.onClick();
    }
  });
  if ('button2' in options) {
    $popup.find('.confirm-no').one('click', function () {
      $('.popup-close').click();
      if (typeof options.button2.onClick == 'function') {
        options.button2.onClick();
      }
    });
  }
}
function rsConfirmation(options) {
  if (!('message' in options)) {
    devLog('Please enter a message');
    return;
  }
  var containerClass = '';
  if ('containerClass' in options) {
    containerClass = options.containerClass;
  }
  var publicUse = 'public' in options;
  content = '<p class="m-0 p-0 p">' + options.message + '</p>';
  if (publicUse) {
    containerClass += ' public';
  }
  $.fn.popup({
    overlayClose: false,
    htmlContent: '<div class="confirm-popup p-30">' + content + '</div>',
    closeButton: false,
    containerClassName: 'confirm-popup ' + containerClass
  });
}
var parentSearchKey = false;
function searchObj(obj, query) {
  for (var key in obj) {
    var value = obj[key];
    if (value === query) {
      return parentSearchKey;
    }
    if (typeof value === 'object') {
      parentSearchKey = key;
      var key = searchObj(value, query);
      if (key) {
        return key;
      }
    }
  }
  return false;
}
function isRetina() {
  var mediaQuery = '(-webkit-min-device-pixel-ratio: 1.5), (min--moz-device-pixel-ratio: 1.5), (-o-min-device-pixel-ratio: 3/2), (min-resolution: 1.5dppx)';
  var root = typeof exports === 'undefined' ? window : exports;
  if (root.devicePixelRatio > 1) {
    return true;
  }
  if (root.matchMedia && root.matchMedia(mediaQuery).matches) {
    return true;
  }
  return false;
}
function replaceRetina() {
  if (isRetina()) {
    $('.logo').not('.text-header').addClass('has-retina');
    $('img.has-retina').each(function () {
      var el = $(this);
      var src = el.attr('src');
      el.attr('data-original-source', src);
      var rSrc = src.replace(/(.*)\.(jpg|jpeg|png|gif)/ig, "$1@2x.$2");
      $('<img src="' + rSrc + '" data-original-source="' + src + '" />').load(function () {
        var originalSource = $(this).data('original-source');
        var rSrc = $(this).attr('src');
        var el = $('[data-original-source="' + originalSource + '"]');
        if (typeof el.attr('height') == 'undefined') {
          el.attr('height', el.height() + 'px');
        }
        if (typeof el.attr('width') == 'undefined') {
          el.attr('width', el.width() + 'px');
        }
        el.attr('src', rSrc).addClass('is-retina').removeClass('has-retina');
      });
    });
  }
}
$(function () {
  replaceRetina();
});
const jqueryPopupScriptURL = new URL(document.currentScript.src);
(function ($) {
  var $loader;
  $.fn.extend({
    popup: function (options) {
      var defaults = {
        overlay: 1,
        overlayDarkMode: false,
        closeButton: true,
        containerClassName: '',
        overlayClose: false,
        content: false,
        fadeTime: 200,
        htmlContent: false,
        onFinish: false,
        onClose: false,
        loadingTitle: false,
        data: {}
      };
      var $events = $({});
      var $window = $(window);
      var $document = $(document);
      var popupHidden = true;
      var scrollTimeout = false;
      options = $.extend(defaults, options);
      if (options.content === false && options.htmlContent === false) {
        window.devLog('Please specify a content option');
        return false;
      }
      if (this.selector !== '') {
        return this.each(function () {
          var o = options;
          $(this).click(function (e) {
            open(o);
            e.preventDefault();
          });
        });
      }
      open(options);
      function open(o) {
        if ($('.popup-loader-overlay').length < 1) {
          $loader = $('<div class="popup-loader-overlay">').append('<div class="popup-loader-container">');
          if (options.overlayDarkMode) {
            $loader.addClass('darkMode');
          }
          $loader.find('.popup-loader-container').append('<div class="popup-loader-icon">');
          if (options.loadingTitle) {
            $loader.append('<div class="popup-loader-title">' + options.loadingTitle + '</div>');
          }
          $('body').append($loader);
        }
        $loader.fadeIn();
        if (o.content !== false) {
          let getString = o.content;
          if (Object.keys(options.data).length > 0) {
            getString += makeParams(options.data);
          }
          $.get(getString, function (d) {
            o.htmlContent = d;
            load(o);
          });
        } else {
          load(o);
        }
      }
      function load(o) {
        if (o.htmlContent) {
          let $t = $('<div id="popup-outer" class="popup-outer legacy-popup popup-temporary"><div' + ' class="popup-background"></div><div' + ' class="popup-content"></div></div>');
          let showClose = '';
          if (!o.closeButton) {
            showClose = ' d-none';
          }
          $t.find('.popup-content').append('<div><div class="popup-close' + showClose + '" data-dialog-close></div></div>');
          $t.find('.popup-content').append(o.htmlContent);
          if (typeof o.containerClassName != 'undefined') {
            $t.addClass(o.containerClassName);
          }
          $('body').append($t);
          var width = 0;
          if (o.width) {
            width = o.width;
          } else {
            width = $t.outerWidth();
          }
          var height = $t.outerHeight();
          $t.addClass('popup-container').removeClass('popup-temporary');
          $t.addClass('dialog');
          if (o.overlay === 0) {
            $t.addClass('hide-overlay');
          }
          var contentTop = getPopupContentTop(height) + 'px';
          $t.find('.popup-content').css({
            'width': width + 'px',
            'top': contentTop
          });
          $('.popup-container').css({
            'min-height': $(document).height() + 'px'
          });
          var popup = document.querySelector('.popup-outer.legacy-popup');
          var openFunction = function () {
            $('body').addClass('popup-open');
            $loader.fadeOut(o.fadeTime);
            popupHidden = false;
            $window.on('scroll', function () {
              if (scrollTimeout) {
                clearTimeout(scrollTimeout);
              }
              scrollTimeout = setTimeout(function () {
                if (!popupHidden) {
                  verticalCenterPopup();
                }
              }, 100);
            });
            $(window).on('resize', debounce(function () {
              verticalCenterPopup();
            }, 400));
            if (o.onFinish) {
              trigger('popup_loaded', o.onFinish);
            }
          };
          var closeFunction = function () {
            $('#popup-outer').remove();
            $('body').removeClass('popup-open');
            $loader.fadeOut(o.fadeTime);
            popupHidden = false;
            if (o.onClose) {
              trigger('popup_closing', o.onClose);
            }
          };
          const dialogFxScript = document.createElement('script');
          dialogFxScript.type = 'text/javascript';
          dialogFxScript.async = false;
          document.head.appendChild(dialogFxScript);
          dialogFxScript.onload = function () {
            var dlg = new DialogFx(popup, {
              onOpenDialog: openFunction,
              onCloseDialog: closeFunction,
              overlayClose: o.overlayClose
            });
            dlg.toggle();
            $t.find('.popup-content').on('heightChanged', function () {
              verticalCenterPopup();
            });
          };
          dialogFxScript.src = `${jqueryPopupScriptURL.origin}/cms/dialogfx.js`;
        }
      }
      function trigger(event, callback) {
        $(document).trigger(event);
        $events.trigger(event);
        if ($.isFunction(callback)) {
          callback.call();
        }
      }
      function verticalCenterPopup() {
        var $popupContent = $('.popup-content');
        var contentHeight = $popupContent.outerHeight();
        if (contentHeight < window.innerHeight) {
          var contentTop = getPopupContentTop(contentHeight) + 'px';
          $popupContent.css({
            'top': contentTop
          });
        }
      }
      function getPopupContentTop(contentHeight) {
        if (typeof contentHeight == 'undefined') {
          contentHeight = $('#popup-outer').height();
        }
        var viewportHeight = $window.height();
        var top = Math.round(viewportHeight / 2 - contentHeight / 2);
        if (top < 60) {
          top = 60;
        }
        top = top + $document.scrollTop();
        return top;
      }
      function makeParams(params) {
        return params ? '?' + Object.keys(params).map(key => [key, params[key]].map(encodeURIComponent).join('=')).join('&') : '';
      }
    }
  });
})(jQuery);
$.event.special.heightChanged = {
  remove: function () {
    $(this).children('iframe.height-changed').remove();
  },
  add: function () {
    var elm = $(this);
    var iframe = elm.children('iframe.height-changed');
    if (!iframe.length) {
      iframe = $('<iframe/>').addClass('height-changed').prependTo(this);
    }
    var oldHeight = elm.height();
    function elmResized() {
      var height = elm.height();
      if (oldHeight != height) {
        elm.trigger('heightChanged', [height, oldHeight]);
        oldHeight = height;
      }
    }
    var timer = 0;
    var ielm = iframe[0];
    (ielm.contentWindow || ielm).onresize = function () {
      clearTimeout(timer);
      timer = setTimeout(elmResized, 20);
    };
  }
};
$('body').on('click', '.popup-close-button', function () {
  $('.popup-close').trigger('click');
});
function errorLogIfNotDashboard(calledFrom) {
  if (window.requestType !== 'dashboard') {
    console.error('Code intended for dashboard use only is being called from outside dashboard (' + calledFrom + ').' + window.publicURL);
  }
}
function validatePhoneCountry(phoneCountry) {
  errorLogIfNotDashboard('validatePhoneCountry');
  phoneCountry = phoneCountry.replace(/[^+\d]/g, '');
  phoneCountry = phoneCountry.replace(/^[+]/g, '');
  if (phoneCountry == '') {
    return false;
  }
  if (phoneCountry.length > 6) {
    return false;
  }
  return true;
}
function validatePhoneArea(phoneArea) {
  errorLogIfNotDashboard('validatePhoneArea');
  phoneArea = phoneArea.replace(/[^\d]/g, '');
  phoneArea = phoneArea.replace(/^[0]/g, '');
  if (phoneArea == '') {
    return false;
  }
  if (phoneArea.length > 6) {
    return false;
  }
  return true;
}
function validatePhoneNumber(phoneNumber) {
  errorLogIfNotDashboard('validatePhoneNumber');
  phoneNumber = phoneNumber.replace(/[^\da-zA-Z]/g, '');
  if (phoneNumber == '') {
    return false;
  }
  if (!phoneNumber.match(/^\d{6,12}$/)) {
    return false;
  }
  return true;
}
function validatePhone(phone) {
  errorLogIfNotDashboard('validatePhone');
  if (phone.match(/^\+([\+\d]{1,5})\.(\d{1,6})\.(\d{4,12})x?(\d+)$/)) {
    if (phone.length > 20) {
      return false;
    }
    return true;
  }
  return false;
}
function implodePhone(country, area, number, extension) {
  errorLogIfNotDashboard('implodePhone');
  if (typeof country == 'undefined' || typeof area == 'undefined' || typeof number == 'undefined') {
    return false;
  }
  area = area.replace(/[^\d]/g, '');
  area.replace(/^0/, '');
  number = number.replace(/[^\da-zA-Z]/g, '');
  var phone = '+' + country + '.' + area + '.' + number;
  if (typeof extension != 'undefined') {
    phone = phone + 'x' + extension;
  }
  var validate = validatePhone(phone);
  return validate !== false ? phone : false;
}
function escapeHTML(string) {
  var pre = document.createElement('pre');
  var text = document.createTextNode(string);
  pre.appendChild(text);
  return pre.innerHTML;
}
function debounce(func, wait, immediate) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}
var textLogoFadeInTimeout = false;
$(function () {
  if (window.isResponsiveMobile()) {} else if ($('.logo.text-header').length) {
    if (typeof detectedLogoWidth != 'undefined' && detectedLogoWidth != null) {
      $('#header .logo').width(detectedLogoWidth);
    }
    if (!typekitActiveComplete) {
      textLogoFadeInTimeout = setTimeout(function () {
        $('#header .logo, #nav_wrapper').css('display', 'block').css('opacity', '1');
      }, 5000);
    } else {
      $('#header .logo, #nav_wrapper').css('opacity', '1');
    }
  } else if (typeof detectedLogoWidth != 'undefined' && detectedLogoWidth != null) {
    $('#header .logo').width(rem(detectedLogoWidth));
  } else {
    if (isBlankTemplate()) return;
    tkCounter = 0;
    tkInterval = setInterval(function () {
      tkCounter = tkCounter + 1;
      if (tkCounter == 20) {
        clearInterval(tkInterval);
      }
      if ($('#nav .first_nav span').hasClass('typekit-element') || $('#nav .first_nav span').length == 0) {
        setLogoWidth();
        clearInterval(tkInterval);
      }
    }, 500);
  }
});
function errorLogIfBlankTemplate(calledFrom) {
  if (isBlankTemplate()) {
    console.error('Code intended for responsive-template use only is being called from a blank template (' + calledFrom + ').' + window.publicURL);
  }
}
function setLogoWidth(allowRecursion) {
  errorLogIfBlankTemplate('setLogoWidth');
  if (typeof allowRecursion == 'undefined') {
    var allowRecursion = true;
  }
  if (window.isResponsiveMobile()) {
    return false;
  }
  if (typeof detectedLogoWidth == 'undefined' || detectedLogoWidth <= 0 || detectedLogoWidth == null) {
    if ($('.logo').hasClass('auto-adjust')) {
      var is_chrome = navigator.userAgent.indexOf('Chrome') > -1;
      var is_safari = navigator.userAgent.indexOf('Safari') > -1;
      if (is_chrome && is_safari) {
        is_safari = false;
      }
      if (is_safari) {
        var timeoutDelay = 1000;
      } else {
        var timeoutDelay = 10;
      }
      setTimeout(function () {
        navWidth = 0;
        $('#nav > div').each(function () {
          navWidth = navWidth + $(this).outerWidth(true);
        });
        logoMargin = $('#header .logo').outerWidth(true) - $('.logo').width();
        padding = Math.round($('#header-inner').width() * 0.04);
        w = $('#header-inner').width() - navWidth - logoMargin - padding;
        wPx = w;
        w = rem(w);
        $('#header .logo').width(w);
        $('#header .logo span').width(w);
        if (!is_safari || wPx > 1200) {
          localStorage.setItem('detectedLogoWidth', w);
        } else {
          if (allowRecursion) {
            setTimeout(function () {
              setLogoWidth(false);
            }, 4000);
            return;
          }
        }
        detectedLogoWidth = w;
        localStorage.setItem('detectedLogoWidth', detectedLogoWidth);
      }, timeoutDelay);
    } else if ($('.feature-area__slides .logo').length || $('#header .logo').css('background-position') == '50% 50%') {
      $('.logo-controls').css('margin-left', ($('.logo').width() - $('.logo-zoom-in').width() - $('.logo-zoom-out').width() - 4) / 2 + 'px');
      $('.logo-edit').css('left', '50%').css('margin', '5px 0 0 -22px');
    } else if ($('#header-area.split-menu-template').length) {
      $('.logo-controls').css('left', '50%');
      $('.logo-controls').css('margin-left', '-34px');
      $('.logo-edit').css('left', '50%').css('margin', '5px 0 0 -22px');
    }
    $('#header .logo').css('display', 'block');
  } else {
    $('#header .logo').css('display', 'block');
  }
  clearTimeout(textLogoFadeInTimeout);
  $('#header .logo, #nav_wrapper').css('opacity', '1');
}
window.devLog = function () {
  if (DEVELOPMENT) {
    log.history = log.history || [];
    log.history.push(arguments);
    if (this.console) {
      console.log(Array.prototype.slice.call(arguments));
    }
  }
};
window.log = function () {
  log.history = log.history || [];
  log.history.push(arguments);
  if (this.console) {
    console.log(Array.prototype.slice.call(arguments));
  }
};
function navigate(data = {}, title = '', url = '') {
  var domTitle = '';
  if (requestType == 'dashboard') {
    domTitle = 'Dashboard / ' + title;
  } else {
    if (titleData.position == 'left') {
      domTitle = titleData.companyName + titleData.separator + title;
    } else if (titleData.position == 'right') {
      domTitle = title + titleData.separator + titleData.companyName;
    }
  }
  history.pushState(data, domTitle, url);
  document.title = domTitle;
}
function rem(unit) {
  unit = unit.toString();
  if (unit.indexOf('px') >= 0 || unit >= 0) {
    unit = parseInt(unit, 10);
    if (unit > 0) {
      return (unit / baseREMUnit).toFixed(3) + 'rem';
    } else {
      return '0';
    }
  } else {
    return unit;
  }
}
var unloadMessage = null;
function setOnBeforeUnload(msg) {
  if (window.onbeforeunload === null) {
    if (typeof msg == 'undefined') {
      msg = 'Your changes will not be applied.';
    }
    unloadMessage = msg;
    window.onbeforeunload = function (e) {
      return msg;
    };
  }
}
function cancelOnBeforeUnload() {
  unloadMessage = null;
  window.onbeforeunload = null;
}
function onBeforeUnload() {
  return new Promise(function (resolve, reject) {
    if (unloadMessage !== null) {
      var msg = '<h3 class="m-b-5">Are you sure you want to leave without saving?</h3><p class="m-t-0 m-b-40">' + unloadMessage + '</p>';
      rsConfirm({
        message: msg,
        button1: {
          text: 'Discard changes',
          onClick: function () {
            resolve('Confirmed');
          }
        },
        button2: {
          text: 'Keep editing',
          onClick: function () {
            reject('No');
          }
        }
      });
    } else {
      resolve('Confirmed');
    }
  });
}
var featureHighRes = [];
function featureWindowResize() {}
const isBlankTemplate = () => {
  var _window$configs;
  return ((_window$configs = window.configs) === null || _window$configs === void 0 ? void 0 : _window$configs.template) === 'blank';
};
function setLogoWidthIfResponsiveTemplate(allowRecursion) {
  if (isBlankTemplate()) {
    return false;
  }
  return setLogoWidth(allowRecursion);
}
var typekitActiveComplete = false;
function typekitActive() {
  window.onTextHeaderHeightChange();
  setLogoWidthIfResponsiveTemplate();
  typekitActiveComplete = true;
}
window.isResponsiveMobile = function () {
  if (typeof window.screenSizes !== 'undefined' && typeof window.screenSizes.h !== 'undefined') {
    return window.innerWidth <= window.screenSizes.h.max;
  }
  return false;
};
$(function () {
  try {
    Typekit.load({
      active: typekitActive
    });
  } catch (e) {
    console.log('Typekit load error: ' + e.message);
    typekitActive();
  }
  setTimeout(function () {
    if (typekitActiveComplete === false) {
      if (typeof detectedLogoWidth == 'undefined' || detectedLogoWidth == null) {
        setLogoWidthIfResponsiveTemplate();
      }
      window.onTextHeaderHeightChange();
    }
  }, 5000);
  $('.picture-wrap').each(function () {
    var el = $(this);
    var stackUID = el.parents('.stack').data('stack');
    var blockUID = el.parents('.block').data('block');
    var picture = new pictureBlock({
      stackUID: stackUID,
      blockUID: blockUID
    });
    picture.positionText();
  });
  function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
    if (!results) {
      return null;
    }
    if (!results[2]) {
      return '';
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }
  $('body').on('click', '.logo', function (event) {
    if (document.body.classList.contains('side-editor-open')) {
      return;
    }
    var suffix = '';
    if (getParameterByName('mobilePreview') == 1) {
      suffix = '?mobilePreview=1';
    }
    if ($(event.target).is('.logo-edit, .logo-zoom-in, .logo-zoom-out, .logo-stretching')) {
      event.stopPropagation();
      return;
    }
    window.location = '/' + suffix;
  });
  featureVerticalCenter();
  $('.zendesk-login').click(function () {
    rsPost({
      url: '/dashboard/scripts/zendeskRedirect.php',
      data: {
        url: $(this).data('url')
      },
      onSuccess: function (data) {
        window.open(data.url, '_blank');
      }
    });
  });
  $('body').on('click', '.popup-close-button', function () {
    $('.popup-close').trigger('click');
  });
});
window.setFeatureLogoStayStillCounter = 0;
window.featureLogoPositioningInterval = null;
function setFeatureLogoStayStill() {
  if ($('.logo-stay-still').length) {
    if (window.featureLogoPositioningInterval === null) {
      window.featureLogoPositioningInterval = setInterval(function () {
        if (!typekitActiveComplete) {
          window.setFeatureLogoStayStillCounter++;
          if (window.setFeatureLogoStayStillCounter < 5) {
            return false;
          }
        }
        var $featureSlide = $('.feature-slide');
        var logoContentTop = 0;
        var logoContentHeight = 0;
        var tallestSlideContentBoxPaddingHeight = 0;
        var $tallestSlide = null;
        $featureSlide.not('.cycle-sentinel').not('.logo-stay-still').find('.feature-slide-content').each(function () {
          var el = $(this);
          var slide = el.parents('.feature-slide');
          slide.addClass('temp-visible');
          var elTop = slide.find('.feature-slide-content').css('top');
          var elHeight = slide.find('.feature-slide-content').height();
          var elContentBoxPaddingHeight = slide.find('.feature-slide-content-box-padding').height();
          slide.removeClass('temp-visible');
          logoContentTop = elTop;
          if (logoContentHeight === 0 || logoContentHeight < elHeight) {
            logoContentHeight = elHeight;
            $tallestSlide = el;
            tallestSlideContentBoxPaddingHeight = elContentBoxPaddingHeight;
          }
        });
        $featureSlide.not('.cycle-sentinel').not('.logo-stay-still').find('.feature-slide-content').each(function () {
          var el = $(this);
          var slide = el.parents('.feature-slide');
          slide.addClass('temp-visible');
          var elContentBoxPaddingHeight = slide.find('.feature-slide-content-box-padding').height();
          slide.removeClass('temp-visible');
          if (elContentBoxPaddingHeight != tallestSlideContentBoxPaddingHeight) {
            var pad = rem(Math.round((tallestSlideContentBoxPaddingHeight - elContentBoxPaddingHeight) / 2));
            var reg = /([.\d]+)rem/;
            var match = reg.exec(pad);
            if (match !== null && match.length > 1) {
              pad = parseFloat(match) + 2 + 'rem';
            }
            el.find('.feature-slide-content-box-padding').css('padding-top', pad).css('padding-bottom', pad);
          }
        });
        $('.logo-stay-still .feature-slide-content').css('top', logoContentTop).height(logoContentHeight + 'px').removeClass('hidden');
        clearInterval(window.featureLogoPositioningInterval);
        window.featureLogoPositioningInterval = null;
      }, 1000);
    }
  }
}
function featureVerticalCenter() {
  var headerHeight = 0;
  if ($('body.header-overlay').length > 0) {
    headerHeight = $('#header').height();
    if ($('.feature-area-main .edit-feature').length > 0) {
      $('.feature-area-main .edit-feature').css('top', +(headerHeight + 30) + 'px');
    }
  }
  setFeatureLogoStayStill();
}
ajaxMessageTimeout = false;
function showAjaxMessage(html, buttonRight, buttonLeft) {
  if (typeof buttonRight == 'undefined') {
    var buttonRight = '';
  }
  if (typeof buttonLeft == 'undefined') {
    var buttonLeft = '';
  }
  if ($('#ajax-message').length == 0) {
    $('body').prepend('<div id="ajax-message" class="rs-component-shadow--popup"></div>');
  }
  $('#ajax-message').html(html);
  if (buttonRight != '') {
    buttonRight = '<div class="ajax-message-button-right ajax-message-button-' + buttonRight + '">' + buttonRight.toUpperCase() + '</div>';
  }
  if (buttonLeft != '') {
    buttonLeft = '<div class="ajax-message-button-left ajax-message-button-' + buttonLeft + '">' + buttonLeft.toUpperCase() + '</div>';
  }
  $('#ajax-message').append('<div class="clear"></div>').append(buttonLeft).append(buttonRight);
  $('#ajax-message').slideDown();
  if (ajaxMessageTimeout !== false) {
    clearTimeout(ajaxMessageTimeout);
  }
  ajaxMessageTimeout = setTimeout(function () {
    hideAjaxMessage();
  }, 15000);
}
function hideAjaxMessage() {
  $('#ajax-message').slideUp();
  $('#ajax-message').html('');
  if (ajaxMessageTimeout !== false) {
    clearTimeout(ajaxMessageTimeout);
  }
}
$(function () {
  $('body').on('click', '.ajax-message-button-ok, .ajax-message-button-ignore, .ajax-message-button-close', function () {
    hideAjaxMessage();
    return false;
  });
  $('body').on('click', '.ajax-message-button-reload', function () {
    location.reload();
    return false;
  });
});
