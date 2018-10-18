"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && _typeof(Symbol.iterator) === "symbol") { _typeof = function (_typeof2) { function _typeof(_x8) { return _typeof2.apply(this, arguments); } _typeof.toString = function () { return _typeof2.toString(); }; return _typeof; }(function (obj) { return typeof obj === "undefined" ? "undefined" : _typeof(obj); }); } else { _typeof = function (_typeof3) { function _typeof(_x9) { return _typeof3.apply(this, arguments); } _typeof.toString = function () { return _typeof3.toString(); }; return _typeof; }(function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === "undefined" ? "undefined" : _typeof(obj); }); } return _typeof(obj); }

/**
 * Tagify (v 2.6.2)- tags input component
 * By Yair Even-Or (2016)
 * Don't sell this code. (c)
 * https://github.com/yairEO/tagify
 */
;

(function ($) {
  // just a jQuery wrapper for the vanilla version of this component
  $.fn.tagify = function () {
    var settings = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return this.each(function () {
      var $input = $(this),
          tagify;
      if ($input.data("tagify")) // don't continue if already "tagified"
        return this;
      settings.isJQueryPlugin = true;
      tagify = new Tagify($input[0], settings);
      $input.data("tagify", tagify);
    });
  };

  function Tagify(input, settings) {
    // protection
    if (!input) {
      console.warn('Tagify: ', 'invalid input element ', input);
      return this;
    }

    this.settings = this.extend({}, this.DEFAULTS, settings);
    this.settings.readonly = input.hasAttribute('readonly'); // if "readonly" do not include an "input" element inside the Tags component

    if (this.isIE) this.settings.autoComplete = false; // IE goes crazy if this isn't false

    if (input.pattern) try {
      this.settings.pattern = new RegExp(input.pattern);
    } catch (e) {} // Convert the "delimiters" setting into a REGEX object

    if (this.settings && this.settings.delimiters) {
      try {
        this.settings.delimiters = new RegExp("[" + this.settings.delimiters + "]", "g");
      } catch (e) {}
    }

    this.state = {};
    this.value = []; // tags' data
    // events' callbacks references will be stores here, so events could be unbinded

    this.listeners = {};
    this.DOM = {}; // Store all relevant DOM elements in an Object

    this.extend(this, new this.EventDispatcher(this));
    this.build(input);
    this.loadOriginalValues();
    this.events.customBinding.call(this);
    this.events.binding.call(this);
  }

  Tagify.prototype = {
    isIE: window.document.documentMode,
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/compatMode#Browser_compatibility
    TEXTS: {
      empty: "empty",
      exceed: "number of tags exceeded",
      pattern: "pattern mismatch",
      duplicate: "already exists",
      notAllowed: "not allowed"
    },
    DEFAULTS: {
      delimiters: ",",
      // [RegEx] split tags by any of these delimiters ("null" to cancel) Example: ",| |."
      pattern: null,
      // RegEx pattern to validate input by. Ex: /[1-9]/
      maxTags: Infinity,
      // Maximum number of tags
      callbacks: {},
      // Exposed callbacks object to be triggered on certain events
      addTagOnBlur: true,
      // Flag - automatically adds the text which was inputed as a tag when blur event happens
      duplicates: false,
      // Flag - allow tuplicate tags
      whitelist: [],
      // Array of tags to suggest as the user types (can be used along with "enforceWhitelist" setting)
      blacklist: [],
      // A list of non-allowed tags
      enforceWhitelist: false,
      // Flag - Only allow tags allowed in whitelist
      keepInvalidTags: false,
      // Flag - if true, do not remove tags which did not pass validation
      autoComplete: true,
      // Flag - tries to autocomplete the input's value while typing
      dropdown: {
        classname: '',
        enabled: 2,
        // minimum input characters needs to be typed for the dropdown to show
        maxItems: 10,
        itemTemplate: ''
      }
    },
    customEventsList: ['add', 'remove', 'invalid', 'input'],

    /**
     * utility method
     * https://stackoverflow.com/a/35385518/104380
     * @param  {String} s [HTML string]
     * @return {Object}   [DOM node]
     */
    parseHTML: function parseHTML(s) {
      var parser = new DOMParser(),
          node = parser.parseFromString(s.trim(), "text/html");
      return node.body.firstElementChild;
    },
    // https://stackoverflow.com/a/25396011/104380
    escapeHtml: function escapeHtml(s) {
      var text = document.createTextNode(s),
          p = document.createElement('p');
      p.appendChild(text);
      return p.innerHTML;
    },

    /**
     * builds the HTML of this component
     * @param  {Object} input [DOM element which would be "transformed" into "Tags"]
     */
    build: function build(input) {
      var that = this,
          DOM = this.DOM,
          template = "<tags class=\"tagify " + (this.settings.mode ? "tagify--mix" : "") + " " + input.className + "\" " + (this.settings.readonly ? 'readonly' : '') + ">\n                            <div contenteditable data-placeholder=\"" + input.placeholder + "\" class=\"tagify__input\"></div>\n                        </tags>";
      DOM.originalInput = input;
      DOM.scope = this.parseHTML(template);
      DOM.input = DOM.scope.querySelector('[contenteditable]');
      input.parentNode.insertBefore(DOM.scope, input);

      if (this.settings.dropdown.enabled >= 0) {
        this.dropdown.init.call(this);
      }

      input.autofocus && DOM.input.focus();
    },

    /**
     * Reverts back any changes made by this component
     */
    destroy: function destroy() {
      this.DOM.scope.parentNode.removeChild(this.DOM.scope);
    },

    /**
     * If the original input had an values, add them as tags
     */
    loadOriginalValues: function loadOriginalValues() {
      var value = this.DOM.originalInput.value; // if the original input already had any value (tags)

      if (!value) return;

      try {
        value = JSON.parse(value);
      } catch (err) {}

      if (this.settings.mode == 'mix') {
        this.DOM.input.innerHTML = this.parseMixTags(value);
      } else this.addTags(value).forEach(function (tag) {
        tag && tag.classList.add('tagify--noAnim');
      });
    },

    /**
     * Merge two objects into a new one
     * TEST: extend({}, {a:{foo:1}, b:[]}, {a:{bar:2}, b:[1], c:()=>{}})
     */
    extend: function extend(o, o1, o2) {
      if (!(o instanceof Object)) o = {};
      copy(o, o1);
      if (o2) copy(o, o2);

      function isObject(obj) {
        var type = Object.prototype.toString.call(obj).split(' ')[1].slice(0, -1);
        return obj === Object(obj) && type != 'Array' && type != 'Function' && type != 'RegExp' && type != 'HTMLUnknownElement';
      }

      ;

      function copy(a, b) {
        // copy o2 to o
        for (var key in b) {
          if (b.hasOwnProperty(key)) {
            if (isObject(b[key])) {
              if (!isObject(a[key])) {
                a[key] = Object.assign({}, b[key]);
              } else copy(a[key], b[key]);
            } else a[key] = b[key];
          }
        }
      }

      return o;
    },

    /**
     * A constructor for exposing events to the outside
     */
    EventDispatcher: function EventDispatcher(instance) {
      // Create a DOM EventTarget object
      var target = document.createTextNode(''); // Pass EventTarget interface calls to DOM EventTarget object

      this.off = function (name, cb) {
        if (cb) target.removeEventListener.call(target, name, cb);
        return this;
      };

      this.on = function (name, cb) {
        if (cb) target.addEventListener.call(target, name, cb);
        return this;
      };

      this.trigger = function (eventName, data) {
        var e;
        if (!eventName) return;

        if (instance.settings.isJQueryPlugin) {
          $(instance.DOM.originalInput).triggerHandler(eventName, [data]);
        } else {
          try {
            e = new CustomEvent(eventName, {
              "detail": data
            });
          } catch (err) {
            console.warn(err);
          }

          target.dispatchEvent(e);
        }
      };
    },

    /**
     * DOM events listeners binding
     */
    events: {
      // bind custom events which were passed in the settings
      customBinding: function customBinding() {
        var _this2 = this;

        this.customEventsList.forEach(function (name) {
          _this2.on(name, _this2.settings.callbacks[name]);
        });
      },
      binding: function binding() {
        var bindUnbind = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

        var _CB = this.events.callbacks,
            _CBR,
            action = bindUnbind ? 'addEventListener' : 'removeEventListener';

        if (bindUnbind && !this.listeners.main) {
          // this event should never be unbinded
          // IE cannot register "input" events on contenteditable elements, so the "keydown" should be used instead..
          this.DOM.input.addEventListener(this.isIE ? "keydown" : "input", _CB[this.isIE ? "onInputIE" : "onInput"].bind(this));
          if (this.settings.isJQueryPlugin) $(this.DOM.originalInput).on('tagify.removeAllTags', this.removeAllTags.bind(this));
        } // setup callback references so events could be removed later


        _CBR = this.listeners.main = this.listeners.main || {
          paste: ['input', _CB.onPaste.bind(this)],
          focus: ['input', _CB.onFocusBlur.bind(this)],
          blur: ['input', _CB.onFocusBlur.bind(this)],
          keydown: ['input', _CB.onKeydown.bind(this)],
          click: ['scope', _CB.onClickScope.bind(this)]
        };

        for (var eventName in _CBR) {
          this.DOM[_CBR[eventName][0]][action](eventName, _CBR[eventName][1]);
        }
      },

      /**
       * DOM events callbacks
       */
      callbacks: {
        onFocusBlur: function onFocusBlur(e) {
          var s = e.target.textContent.trim();
          if (this.settings.mode == 'mix') return;

          if (e.type == "focus") {
            //  e.target.classList.remove('placeholder');
            if (this.settings.dropdown.enabled === 0) {
              this.dropdown.show.call(this);
            }
          } else if (e.type == "blur" && s) {
            this.settings.addTagOnBlur && this.addTags(s, true).length;
          } else {
            //  e.target.classList.add('placeholder');
            this.DOM.input.removeAttribute('style');
            this.dropdown.hide.call(this);
          }
        },
        onKeydown: function onKeydown(e) {
          var s = e.target.textContent,
              lastTag;
          if (this.settings.mode == 'mix') return;

          switch (e.key) {
            case 'Backspace':
              if (s == "" || s.charCodeAt(0) == 8203) {
                lastTag = this.DOM.scope.querySelectorAll('tag:not(.tagify--hide)');
                lastTag = lastTag[lastTag.length - 1];
                this.removeTag(lastTag);
              }

              break;

            case 'Esc':
            case 'Escape':
              this.input.set.call(this);
              e.target.blur();
              break;

            case 'ArrowRight':
            case 'Tab':
              if (!s) return true;

            case 'Enter':
              e.preventDefault(); // solves Chrome bug - http://stackoverflow.com/a/20398191/104380

              this.addTags(this.input.value, true);
          }
        },
        onInput: function onInput(e) {
          var value = this.input.normalize.call(this),
              showSuggestions = value.length >= this.settings.dropdown.enabled;
          this.trigger("input", {
            value: value
          });
          if (this.settings.mode == 'mix') return this.events.callbacks.onMixTagsInput.call(this, e);

          if (!value) {
            this.input.set.call(this, '');
            return;
          }

          if (this.input.value == value) return; // for IE; since IE doesn't have an "input" event so "keyDown" is used instead
          // save the value on the input's State object

          this.input.set.call(this, value, false);

          if (value.search(this.settings.delimiters) != -1) {
            if (this.addTags(value).length) {
              this.input.set.call(this); // clear the input field's value
            }
          } else if (this.settings.dropdown.enabled >= 0) {
            this.dropdown[showSuggestions ? "show" : "hide"].call(this, value);
          }
        },
        onMixTagsInput: function onMixTagsInput(e) {
          var sel,
              range,
              split,
              tag,
              patternLen = this.settings.pattern.length;
          this.state.tag = null;

          if (window.getSelection) {
            sel = window.getSelection();

            if (sel.rangeCount > 0) {
              range = sel.getRangeAt(0).cloneRange();
              range.collapse(true);
              range.setStart(window.getSelection().focusNode, 0);
              split = range.toString().split(/,|\.|\s/); // ["foo", "bar", "@a"]

              tag = split[split.length - 1];
              tag = this.state.tag = tag.substr(0, patternLen) == this.settings.pattern && tag.length > patternLen ? tag.slice(patternLen) : null;
            }
          }

          this.dropdown[tag ? "show" : "hide"].call(this, tag);
          this.update();
        },
        onInputIE: function onInputIE(e) {
          var _this = this; // for the "e.target.textContent" to be changed, the browser requires a small delay


          setTimeout(function () {
            _this.events.callbacks.onInput.call(_this, e);
          });
        },
        onPaste: function onPaste(e) {},
        onClickScope: function onClickScope(e) {
          if (e.target.tagName == "TAGS") this.DOM.input.focus();else if (e.target.tagName == "X") {
            this.removeTag(e.target.parentNode);
          }
        }
      }
    },

    /**
     * input bridge for accessing & setting
     * @type {Object}
     */
    input: {
      value: '',
      set: function set() {
        var s = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
        var updateDOM = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
        this.input.value = s;
        if (updateDOM) this.DOM.input.innerHTML = s;
        if (!s) this.dropdown.hide.call(this);
        if (s.length < 2) this.input.autocomplete.suggest.call(this, '');
        this.input.validate.call(this);
      },
      // https://stackoverflow.com/a/3866442/104380
      setRangeAtStartEnd: function setRangeAtStartEnd() {
        var start = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
        var node = arguments[1];
        var range, selection;
        if (!document.createRange) return;
        range = document.createRange();
        range.selectNodeContents(node || this.DOM.input);
        range.collapse(start);
        selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },

      /**
       * Marks the tagify's input as "invalid" if the value did not pass "validateTag()"
       */
      validate: function validate() {
        var isValid = !this.input.value || this.validateTag.call(this, this.input.value);
        this.DOM.input.classList.toggle('tagify__input--invalid', isValid !== true);
      },
      // remove any child DOM elements that aren't of type TEXT (like <br>)
      normalize: function normalize() {
        var clone = this.DOM.input.cloneNode(true),
            v = clone.textContent.replace(/\s/g, ' '); // replace NBSPs with spaces characters

        while (clone.firstElementChild) {
          v += clone.firstElementChild.textContent;
          clone.removeChild(clone.firstElementChild);
        }

        return v.replace(/^\s+/, ""); // trimLeft
      },

      /**
       * suggest the rest of the input's value (via CSS "::after" using "content:attr(...)")
       * @param  {String} s [description]
       */
      autocomplete: {
        suggest: function suggest(s) {
          if (!s || !this.input.value) this.DOM.input.removeAttribute("data-suggest");else this.DOM.input.setAttribute("data-suggest", s.substring(this.input.value.length));
        },
        set: function set(s) {
          var dataSuggest = this.DOM.input.getAttribute('data-suggest'),
              suggestion = s || (dataSuggest ? this.input.value + dataSuggest : null);

          if (suggestion) {
            this.input.set.call(this, suggestion);
            this.input.autocomplete.suggest.call(this, '');
            this.dropdown.hide.call(this);
            this.input.setRangeAtStartEnd.call(this);
            return true;
          }

          return false; // if( suggestion && this.addTags(this.input.value + suggestion).length ){
          //     this.input.set.call(this);
          //     this.dropdown.hide.call(this);
          // }
        }
      }
    },
    getNodeIndex: function getNodeIndex(node) {
      var index = 0;

      while (node = node.previousSibling) {
        if (node.nodeType != 3 || !/^\s*$/.test(node.data)) index++;
      }

      return index;
    },

    /**
     * Searches if any tag with a certain value already exis
     * @param  {String} s [text value to search for]
     * @return {int}      [Position index of the tag. -1 is returned if tag is not found.]
     */
    isTagDuplicate: function isTagDuplicate(s) {
      return this.value.findIndex(function (item) {
        return s.trim().toLowerCase() === item.value.toLowerCase();
      }); // return this.value.some(item => s.toLowerCase() === item.value.toLowerCase());
    },
    getTagIndexByValue: function getTagIndexByValue(value) {
      var result = [];
      this.DOM.scope.querySelectorAll('tag').forEach(function (tagElm, i) {
        if (tagElm.textContent.trim().toLowerCase() == value.toLowerCase()) result.push(i);
      });
      return result;
    },
    getTagElmByValue: function getTagElmByValue(value) {
      var tagIdx = this.getTagIndexByValue(value)[0];
      return this.DOM.scope.querySelectorAll('tag')[tagIdx];
    },

    /**
     * Mark a tag element by its value
     * @param  {String / Number} value  [text value to search for]
     * @param  {Object}          tagElm [a specific "tag" element to compare to the other tag elements siblings]
     * @return {boolean}                [found / not found]
     */
    markTagByValue: function markTagByValue(value, tagElm) {
      var tagsElms, tagsElmsLen;
      tagElm = tagElm || this.getTagElmByValue(value); // check AGAIN if "tagElm" is defined

      if (tagElm) {
        tagElm.classList.add('tagify--mark');
        setTimeout(function () {
          tagElm.classList.remove('tagify--mark');
        }, 100);
        return tagElm;
      }

      return false;
    },

    /**
     * make sure the tag, or words in it, is not in the blacklist
     */
    isTagBlacklisted: function isTagBlacklisted(v) {
      v = v.split(' ');
      return this.settings.blacklist.filter(function (x) {
        return v.indexOf(x) != -1;
      }).length;
    },

    /**
     * make sure the tag, or words in it, is not in the blacklist
     */
    isTagWhitelisted: function isTagWhitelisted(v) {
      return this.settings.whitelist.some(function (item) {
        if ((item.value || item).toLowerCase() === v.toLowerCase()) return true;
      });
    },

    /**
     * validate a tag object BEFORE the actual tag will be created & appeneded
     * @param  {String} s
     * @return {Boolean/String}  ["true" if validation has passed, String for a fail]
     */
    validateTag: function validateTag(s) {
      var value = s.trim(),
          maxTagsExceed = this.value.length >= this.settings.maxTags,
          isDuplicate,
          eventName__error,
          result = true; // check for empty value

      if (!value) result = this.TEXTS.empty;else if (maxTagsExceed) result = this.TEXTS.exceed; // check if pattern should be used and if so, use it to test the value
      else if (this.settings.pattern && !this.settings.pattern.test(value)) result = this.TEXTS.pattern; // if duplicates are not allowed and there is a duplicate
        else if (!this.settings.duplicates && this.isTagDuplicate(value) !== -1) result = this.TEXTS.duplicate;else if (this.isTagBlacklisted(value) || this.settings.enforceWhitelist && !this.isTagWhitelisted(value)) result = this.TEXTS.notAllowed;
      return result;
    },

    /**
     * pre-proccess the tagsItems, which can be a complex tagsItems like an Array of Objects or a string comprised of multiple words
     * so each item should be iterated on and a tag created for.
     * @return {Array} [Array of Objects]
     */
    normalizeTags: function normalizeTags(tagsItems) {
      var _this3 = this;

      var whitelistWithProps = this.settings.whitelist[0] instanceof Object,
          isComplex = tagsItems instanceof Array && tagsItems[0] instanceof Object && "value" in tagsItems[0],
          // checks if the value is a "complex" which means an Array of Objects, each object is a tag
      temp = []; // no need to continue if "tagsItems" is an Array of Objects

      if (isComplex) return tagsItems; // if the value is a "simple" String, ex: "aaa, bbb, ccc"

      if (typeof tagsItems == 'string') {
        if (!tagsItems.trim()) return []; // go over each tag and add it (if there were multiple ones)

        tagsItems = tagsItems.split(this.settings.delimiters).filter(function (n) {
          return n;
        }).map(function (v) {
          return {
            value: v.trim()
          };
        });
      } else if (tagsItems instanceof Array) tagsItems = tagsItems.map(function (v) {
        return {
          value: v.trim()
        };
      }); // search if the tag exists in the whitelist as an Object (has props), to be able to use its properties


      if (whitelistWithProps) {
        tagsItems.forEach(function (tag) {
          var matchObj = _this3.settings.whitelist.filter(function (WL_item) {
            return WL_item.value.toLowerCase() == tag.value.toLowerCase();
          });

          if (matchObj[0]) temp.push(matchObj[0]); // set the Array (with the found Object) as the new value
          else if (_this3.settings.mode != 'mix') temp.push(tag);
        });
        return temp;
      }

      return tagsItems;
    },
    parseMixTags: function parseMixTags(s) {
      var _this4 = this;

      var htmlString = '';
      s = s.split(this.settings.pattern); // this.DOM.scope.innerHTML

      htmlString = s.shift() + s.map(function (part) {
        var tagElm, i, tagData;
        if (!part) return '';

        for (i in part) {
          if (part[i].match(/,|\.| /)) {
            tagData = _this4.normalizeTags.call(_this4, part.substr(0, i))[0];
            if (tagData) tagElm = _this4.createTagElem(tagData);else i = 0; // a tag was found but was not in the whitelist, so reset the "i" index

            break;
          }
        }

        return tagElm ? tagElm.outerHTML + part.slice(i) : _this4.settings.pattern + part;
      }).join('');
      return htmlString;
    },

    /**
     * Add a tag where it might be beside textNodes
     */
    addMixTag: function addMixTag(tagData) {
      if (!tagData) return;
      var sel = window.getSelection(),
          node = sel.focusNode,
          nodeText = node.textContent,
          wrapElm = document.createDocumentFragment(),
          tagElm = this.createTagElem(tagData),
          textNodeBefore,
          textNodeAfter,
          range,
          parrernLen = this.settings.pattern.length;

      if (sel.rangeCount > 0) {
        range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        range.setStart(node, 0);
        textNodeBefore = range.toString().slice(0, -this.state.tag.length - parrernLen);
        textNodeAfter = nodeText.slice(textNodeBefore.length + this.state.tag.length + parrernLen, nodeText.length);
        textNodeBefore = document.createTextNode(textNodeBefore);
        textNodeAfter = document.createTextNode(textNodeAfter.trim() ? textNodeAfter : " \u200B");
        wrapElm.appendChild(textNodeBefore);
        wrapElm.appendChild(tagElm);
        wrapElm.appendChild(textNodeAfter);
      }

      node.parentNode.replaceChild(wrapElm, node);
      this.update();
      this.input.setRangeAtStartEnd.call(this, true, textNodeAfter);
    },

    /**
     * add a "tag" element to the "tags" component
     * @param {String/Array} tagsItems [A string (single or multiple values with a delimiter), or an Array of Objects or just Array of Strings]
     * @param {Boolean} clearInput [flag if the input's value should be cleared after adding tags]
     * @return {Array} Array of DOM elements (tags)
     */
    addTags: function addTags(tagsItems, clearInput) {
      var _this5 = this;

      var tagElems = [];
      tagsItems = this.normalizeTags.call(this, tagsItems);
      if (this.settings.mode == 'mix') return this.addMixTag(tagsItems[0]);
      this.DOM.input.removeAttribute('style');
      tagsItems.forEach(function (tagData) {
        var tagValidation, tagElm;

        if (typeof _this5.settings.transformTag === 'function') {
          tagData.value = _this5.settings.transformTag.call(_this5, tagData.value) || tagData.value;
        }

        tagValidation = _this5.validateTag.call(_this5, tagData.value);

        if (tagValidation !== true) {
          tagData.class = tagData.class ? tagData.class + " tagify--notAllowed" : "tagify--notAllowed";
          tagData.title = tagValidation;

          _this5.markTagByValue(tagData.value);

          _this5.trigger("invalid", {
            value: tagData.value,
            index: _this5.value.length,
            message: tagValidation
          });
        } // Create tag HTML element


        tagElm = _this5.createTagElem(tagData);
        tagElems.push(tagElm); // add the tag to the component's DOM

        appendTag.call(_this5, tagElm);

        if (tagValidation === true) {
          // update state
          _this5.value.push(tagData);

          _this5.update();

          _this5.trigger('add', _this5.extend({}, {
            index: _this5.value.length,
            tag: tagElm
          }, tagData));
        } else if (!_this5.settings.keepInvalidTags) {
          // remove invalid tags (if "keepInvalidTags" is set to "false")
          setTimeout(function () {
            _this5.removeTag(tagElm, true);
          }, 1000);
        }
      });

      if (tagsItems.length && clearInput) {
        this.input.set.call(this);
      }
      /**
       * appened (validated) tag to the component's DOM scope
       * @return {[type]} [description]
       */


      function appendTag(tagElm) {
        var insertBeforeNode = this.DOM.scope.lastElementChild;
        if (insertBeforeNode === this.DOM.input) this.DOM.scope.insertBefore(tagElm, insertBeforeNode);else this.DOM.scope.appendChild(tagElm);
      }

      return tagElems;
    },
    minify: function minify(html) {
      return html.replace(new RegExp("\>[\r\n ]+\<", "g"), "><");
    },

    /**
     * creates a DOM tag element and injects it into the component (this.DOM.scope)
     * @param  Object}  tagData [text value & properties for the created tag]
     * @return {Object} [DOM element]
     */
    createTagElem: function createTagElem(tagData) {
      var tagElm,
          v = this.escapeHtml(tagData.value),
          template = "<tag title='" + v + "' contenteditable='false'>\n                            <x title=''></x><div><span>" + v + "</span></div>\n                        </tag>";

      if (typeof this.settings.tagTemplate === "function") {
        try {
          template = this.settings.tagTemplate(v, tagData);
        } catch (err) {}
      } // for a certain Tag element, add attributes.


      function addTagAttrs(tagElm, tagData) {
        var i,
            keys = Object.keys(tagData);

        for (i = keys.length; i--;) {
          var propName = keys[i];
          if (!tagData.hasOwnProperty(propName)) return;
          tagElm.setAttribute(propName, tagData[propName]);
        }
      }

      template = this.minify(template);
      tagElm = this.parseHTML(template); // add any attribuets, if exists

      addTagAttrs(tagElm, tagData);
      return tagElm;
    },

    /**
     * Removes a tag
     * @param  {Object|String}  tagElm          [DOM element or a String value]
     * @param  {Boolean}        silent          [A flag, which when turned on, does not removes any value and does not update the original input value but simply removes the tag from tagify]
     * @param  {Number}         tranDuration    [Transition duration in MS]
     */
    removeTag: function removeTag(tagElm, silent) {
      var tranDuration = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 250;
      if (!tagElm || !(tagElm instanceof HTMLElement)) return;
      if (typeof tagElm == 'string') tagElm = this.getTagElmByValue(tagElm);

      var _this = this,
          tagData,
          tagIdx = this.getTagIndexByValue(tagElm.textContent); //this.getNodeIndex(tagElm); (getNodeIndex is unreliable)


      if (tranDuration && tranDuration > 10) animation();else removeNode();

      if (!silent) {
        tagData = this.value.splice(tagIdx, 1)[0]; // remove the tag from the data object

        this.trigger('remove', this.extend({}, {
          index: tagIdx,
          tag: tagElm
        }, tagData));
      }

      function animation() {
        tagElm.style.width = parseFloat(window.getComputedStyle(tagElm).width) + 'px';
        document.body.clientTop; // force repaint for the width to take affect before the "hide" class below

        tagElm.classList.add('tagify--hide'); // manual timeout (hack, since transitionend cannot be used because of hover)

        setTimeout(removeNode, 400);
      }

      function removeNode() {
        if (!tagElm.parentNode) return;
        tagElm.parentNode.removeChild(tagElm);

        _this.update(); // update the original input with the current value

      }
    },
    removeAllTags: function removeAllTags() {
      this.value = [];
      this.update();
      Array.prototype.slice.call(this.DOM.scope.querySelectorAll('tag')).forEach(function (elm) {
        return elm.parentNode.removeChild(elm);
      });
    },

    /**
     * update the origianl (hidden) input field's value
     * see - https://stackoverflow.com/q/50957841/104380
     */
    update: function update() {
      this.DOM.originalInput.value = this.settings.mode == 'mix' ? this.DOM.input.textContent : JSON.stringify(this.value);
    },

    /**
     * Dropdown controller
     * @type {Object}
     */
    dropdown: {
      init: function init() {
        this.DOM.dropdown = this.dropdown.build.call(this);
      },
      build: function build() {
        var className = ("tagify__dropdown " + this.settings.dropdown.classname).trim(),
            template = "<div class=\"" + className + "\"></div>";
        return this.parseHTML(template);
      },
      show: function show(value) {
        var _this6 = this;

        var listItems, listHTML;
        if (!this.settings.whitelist.length) return; // if no value was supplied, show all the "whitelist" items in the dropdown
        // @type [Array] listItems

        listItems = value ? this.dropdown.filterListItems.call(this, value) : this.settings.whitelist.filter(function (item) {
          return _this6.isTagDuplicate(item.value || item) == -1;
        }); // don't include already preset tags

        listHTML = this.dropdown.createListHTML.call(this, listItems); // set the first item from the suggestions list as the autocomplete value

        if (this.settings.autoComplete) {
          this.input.autocomplete.suggest.call(this, listItems.length ? listItems[0].value : '');
        }

        if (!listHTML) {
          // this.dropdown.hide.call(this);
          return;
        }

        this.DOM.dropdown.innerHTML = listHTML;
        this.dropdown.position.call(this); // if the dropdown has yet to be appended to the document,
        // append the dropdown to the body element & handle events

        if (!this.DOM.dropdown.parentNode != document.body) {
          document.body.appendChild(this.DOM.dropdown);
          this.events.binding.call(this, false); // unbind the main events

          this.dropdown.events.binding.call(this);
        }
      },
      hide: function hide() {
        if (!this.DOM.dropdown || this.DOM.dropdown.parentNode != document.body) return;
        document.body.removeChild(this.DOM.dropdown);
        window.removeEventListener('resize', this.dropdown.position);
        this.dropdown.events.binding.call(this, false); // unbind all events

        this.events.binding.call(this); // re-bind main events
      },
      position: function position() {
        var rect = this.DOM.scope.getBoundingClientRect();
        this.DOM.dropdown.style.cssText = "left: " + (rect.left + window.pageXOffset) + "px; \
                                               top: " + (rect.top + rect.height - 1 + window.pageYOffset) + "px; \
                                               width: " + rect.width + "px";
      },

      /**
       * @type {Object}
       */
      events: {
        /**
         * Events should only be binded when the dropdown is rendered and removed when isn't
         * @param  {Boolean} bindUnbind [optional. true when wanting to unbind all the events]
         * @return {[type]}             [description]
         */
        binding: function binding() {
          var bindUnbind = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

          // references to the ".bind()" methods must be saved so they could be unbinded later
          var _CBR = this.listeners.dropdown = this.listeners.dropdown || {
            position: this.dropdown.position.bind(this),
            onKeyDown: this.dropdown.events.callbacks.onKeyDown.bind(this),
            onMouseOver: this.dropdown.events.callbacks.onMouseOver.bind(this),
            onClick: this.dropdown.events.callbacks.onClick.bind(this)
          },
              action = bindUnbind ? 'addEventListener' : 'removeEventListener';

          window[action]('resize', _CBR.position);
          window[action]('keydown', _CBR.onKeyDown);
          window[action]('mousedown', _CBR.onClick);
          this.DOM.dropdown[action]('mouseover', _CBR.onMouseOver); //  this.DOM.dropdown[action]('click', _CBR.onClick);
        },
        callbacks: {
          onKeyDown: function onKeyDown(e) {
            var selectedElm = this.DOM.dropdown.querySelectorAll("[class$='--active']")[0],
                newValue = "";

            switch (e.key) {
              case 'ArrowDown':
              case 'ArrowUp':
              case 'Down': // >IE11

              case 'Up':
                // >IE11
                e.preventDefault();
                if (selectedElm) selectedElm = selectedElm[(e.key == 'ArrowUp' || e.key == 'Up' ? "previous" : "next") + "ElementSibling"]; // if no element was found, loop

                if (!selectedElm) selectedElm = this.DOM.dropdown.children[e.key == 'ArrowUp' || e.key == 'Up' ? this.DOM.dropdown.children.length - 1 : 0];
                this.dropdown.highlightOption.call(this, selectedElm, true);
                break;

              case 'Escape':
              case 'Esc':
                // IE11
                this.dropdown.hide.call(this);
                break;

              case 'ArrowRight':
              case 'Tab':
                e.preventDefault();
                if (!this.input.autocomplete.set.call(this, selectedElm ? selectedElm.textContent : null)) return false;

              case 'Enter':
                e.preventDefault();
                newValue = selectedElm ? selectedElm.getAttribute("value") : this.input.value;
                this.addTags(newValue, true);
                this.dropdown.hide.call(this);
                return false;
                break;
            }
          },
          onMouseOver: function onMouseOver(e) {
            // event delegation check
            if (e.target.className.includes('__item')) this.dropdown.highlightOption.call(this, e.target);
          },
          onClick: function onClick(e) {
            var _this7 = this;

            var onClickOutside = function onClickOutside() {
              return _this7.dropdown.hide.call(_this7);
            },
                listItemElm;

            if (e.button != 0) return; // allow only mouse left-clicks

            if (e.target == document.documentElement) return onClickOutside();
            listItemElm = [e.target, e.target.parentNode].filter(function (a) {
              return a.className.includes("tagify__dropdown__item");
            })[0];

            if (listItemElm) {
              this.addTags(listItemElm.getAttribute("value"), true);
              this.dropdown.hide.call(this);
            } // clicked outside the dropdown, so just close it
            else onClickOutside();
          }
        }
      },
      highlightOption: function highlightOption(elm, adjustScroll) {
        if (!elm) return;
        var className = "tagify__dropdown__item--active"; // for IE support, which doesn't allow "forEach" on "NodeList" Objects

        [].forEach.call(this.DOM.dropdown.querySelectorAll("[class$='--active']"), function (activeElm) {
          return activeElm.classList.remove(className);
        }); // this.DOM.dropdown.querySelectorAll("[class$='--active']").forEach(activeElm => activeElm.classList.remove(className));

        elm.classList.add(className);
        if (adjustScroll) elm.parentNode.scrollTop = elm.clientHeight + elm.offsetTop - elm.parentNode.clientHeight;
      },

      /**
       * returns an HTML string of the suggestions' list items
       * @return {[type]} [description]
       */
      filterListItems: function filterListItems(value) {
        if (!value) return "";
        var list = [],
            whitelist = this.settings.whitelist,
            suggestionsCount = this.settings.dropdown.maxItems || Infinity,
            whitelistItem,
            valueIsInWhitelist,
            i = 0;

        for (; i < whitelist.length; i++) {
          whitelistItem = whitelist[i] instanceof Object ? whitelist[i] : {
            value: whitelist[i]
          }, //normalize value as an Object
          valueIsInWhitelist = whitelistItem.value.toLowerCase().replace(/\s/g, '').indexOf(value.toLowerCase().replace(/\s/g, '')) == 0; // for fuzzy-search use ">="
          // match for the value within each "whitelist" item

          if (valueIsInWhitelist && this.isTagDuplicate(whitelistItem.value) == -1 && suggestionsCount--) list.push(whitelistItem);
          if (suggestionsCount == 0) break;
        }

        return list;
      },

      /**
       * Creates the dropdown items' HTML
       * @param  {Array} list  [Array of Objects]
       * @return {String}
       */
      createListHTML: function createListHTML(list) {
        var getItem = this.settings.dropdown.itemTemplate || function (item) {
          var attributes = (typeof item === "undefined" ? "undefined" : _typeof(item)) === "object" ? getAttributesString(item) : "value='" + item + "'";
          return "<div class='tagify__dropdown__item " + (item.class ? item.class : "") + "' " + attributes + ">" + (item.value || item) + "</div>";
        }; // for a certain Tag element, add attributes.


        function getAttributesString(item) {
          var i,
              keys = Object.keys(item),
              s = "";

          for (i = keys.length; i--;) {
            var propName = keys[i];
            if (propName != 'class' && !item.hasOwnProperty(propName)) return;
            s += " " + propName + (item[propName] ? "=" + item[propName] : "");
          }

          return s;
        }

        return list.map(getItem).join("");
      }
    }
  };
})(jQuery);