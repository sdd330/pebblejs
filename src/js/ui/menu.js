var util2 = require('util2');
var myutil = require('myutil');
var Emitter = require('emitter');
var WindowStack = require('ui/windowstack');
var Window = require('ui/window');
var simply = require('ui/simply');

var Menu = function(menuDef) {
  Window.call(this, menuDef);
  this._dynamic = false;
  this._sections = {};
  this._selection = { sectionIndex: 0, itemIndex: 0 };
  this._selections = [];
};

Menu._codeName = 'menu';

util2.inherit(Menu, Window);

util2.copy(Emitter.prototype, Menu.prototype);

Menu.prototype._show = function() {
  this._resolveMenu();
  Window.prototype._show.apply(this, arguments);
};

Menu.prototype._numPreloadItems = 5;

Menu.prototype._prop = function(state, clear, pushing) {
  if (this === WindowStack.top()) {
    simply.impl.menu.call(this, state, clear, pushing);
    this._resolveSection(this._selection);
  }
};

Menu.prototype.action = function() {
  throw new Error("Menus don't support action bars.");
};

Menu.prototype.buttonConfig = function() {
  throw new Error("Menus don't support changing button configurations.");
};

Menu.prototype._buttonAutoConfig = function() {};

var getMetaSection = function(sectionIndex) {
  return (this._sections[sectionIndex] || ( this._sections[sectionIndex] = {} ));
};

var getSections = function() {
  var sections = this.state.sections;
  if (sections instanceof Array) {
    return sections;
  }
  if (typeof sections === 'number') {
    sections = new Array(sections);
    return (this.state.sections = sections);
  }
  if (typeof sections === 'function') {
    this.sectionsProvider = this.state.sections;
    delete this.state.sections;
  }
  if (this.sectionsProvider) {
    sections = this.sectionsProvider.call(this);
    if (sections) {
      this.state.sections = sections;
      return getSections.call(this);
    }
  }
  return (this.state.sections = []);
};

var getSection = function(e, create) {
  var sections = getSections.call(this);
  var section = sections[e.sectionIndex];
  if (section) {
    return section;
  }
  if (this.sectionProvider) {
    section = this.sectionProvider.call(this, e);
    if (section) {
      return (sections[e.sectionIndex] = section);
    }
  }
  if (!create) { return; }
  return (sections[e.sectionIndex] = {});
};

var getItems = function(e, create) {
  var section = getSection.call(this, e, create);
  if (!section) {
    if (e.sectionIndex > 0) { return; }
    section = this.state.sections[0] = {};
  }
  if (section.items instanceof Array) {
    return section.items;
  }
  if (typeof section.items === 'number') {
    return (section.items = new Array(section.items));
  }
  if (typeof section.items === 'function') {
    this._sections[e.sectionIndex] = section.items;
    delete section.items;
  }
  var itemsProvider = getMetaSection.call(this, e.sectionIndex).items || this.itemsProvider;
  if (itemsProvider) {
    var items = itemsProvider.call(this, e);
    if (items) {
      section.items = items;
      return getItems.call(this, e, create);
    }
  }
  return (section.items = []);
};

var getItem = function(e, create) {
  var items = getItems.call(this, e, create);
  var item = items[e.itemIndex];
  if (item) {
    return item;
  }
  var itemProvider = getMetaSection.call(this, e.sectionIndex).item || this.itemProvider;
  if (itemProvider) {
    item = itemProvider.call(this, e);
    if (item) {
      return (items[e.itemIndex] = item);
    }
  }
  if (!create) { return; }
  return (items[e.itemIndex] = {});
};

Menu.prototype._resolveMenu = function() {
  var sections = getSections.call(this);
  if (this === WindowStack.top()) {
    simply.impl.menu.call(this, this.state);
    return true;
  }
};

Menu.prototype._resolveSection = function(e, clear) {
  var section = getSection.call(this, e);
  if (!section) { return; }
  section.items = getItems.call(this, e);
  if (this === WindowStack.top()) {
    simply.impl.menuSection.call(this, e.sectionIndex, section, clear);
    var select = this._selection;
    if (select.sectionIndex === e.sectionIndex) {
      this._preloadSection(select);
    }
    return true;
  }
};

Menu.prototype._resolveItem = function(e) {
  var item = getItem.call(this, e);
  if (!item) { return; }
  if (this === WindowStack.top()) {
    simply.impl.menuItem.call(this, e.sectionIndex, e.itemIndex, item);
    return true;
  }
};

Menu.prototype._preloadItems = function(e) {
  var select = util2.copy(e);
  select.itemIndex = Math.max(0, select.itemIndex - Math.floor(this._numPreloadItems / 2));
  for (var i = 0; i < this._numPreloadItems; ++i) {
    this._resolveItem(select);
    select.itemIndex++;
  }
};

Menu.prototype._preloadSection = function(e) {
  simply.impl.menuSelection(e.sectionIndex, e.itemIndex);
  this._preloadItems(e);
};

Menu.prototype._emitSelect = function(e) {
  this._selection = e;
  var item = getItem.call(this, e);
  switch (e.type) {
    case 'select':
      if (item && typeof item.select === 'function') {
        if (item.select(e) === false) {
          return false;
        }
      }
      break;
    case 'longSelect':
      if (item && typeof item.longSelect === 'function') {
        if (item.longSelect(e) === false) {
          return false;
        }
      }
      break;
    case 'selection':
      var handlers = this._selections;
      this._selections = [];
      if (item && typeof item.selected === 'function') {
        if (item.selected(e) === false) {
          return false;
        }
      }
      for (var i = 0, ii = handlers.length; i < ii; ++i) {
        if (handlers[i](e) === false) {
          break;
        }
      }
      break;
  }
};

Menu.prototype.sections = function(sections) {
  if (typeof sections === 'function') {
    delete this.state.sections;
    this.sectionsProvider = sections;
    this._resolveMenu();
    return this;
  }
  this.state.sections = sections;
  this._resolveMenu();
  return this;
};

Menu.prototype.section = function(sectionIndex, section) {
  if (typeof sectionIndex === 'object') {
    sectionIndex = sectionIndex.sectionIndex || 0;
  } else if (typeof sectionIndex === 'function') {
    this.sectionProvider = sectionIndex;
    return this;
  }
  var menuIndex = { sectionIndex: sectionIndex };
  if (!section) {
    return getSection.call(this, menuIndex);
  }
  var sections = getSections.call(this);
  var prevLength = sections.length;
  sections[sectionIndex] = util2.copy(section, sections[sectionIndex]);
  if (sections.length !== prevLength) {
    this._resolveMenu();
  }
  this._resolveSection(menuIndex, typeof section.items !== 'undefined');
  return this;
};

Menu.prototype.items = function(sectionIndex, items) {
  if (typeof sectionIndex === 'object') {
    sectionIndex = sectionIndex.sectionIndex || 0;
  } else if (typeof sectionIndex === 'function') {
    this.itemsProvider = sectionIndex;
    return this;
  }
  if (typeof items === 'function') {
    getMetaSection.call(this, sectionIndex).items = items;
    return this;
  }
  var menuIndex = { sectionIndex: sectionIndex };
  if (!items) {
    return getItems.call(this, menuIndex);
  }
  var section = getSection.call(this, menuIndex, true);
  section.items = items;
  this._resolveSection(menuIndex, true);
  return this;
};

Menu.prototype.item = function(sectionIndex, itemIndex, item) {
  if (typeof sectionIndex === 'object') {
    item = itemIndex || item;
    itemIndex = sectionIndex.itemIndex;
    sectionIndex = sectionIndex.sectionIndex || 0;
  } else if (typeof sectionIndex === 'function') {
    this.itemProvider = sectionIndex;
    return this;
  }
  if (typeof itemIndex === 'function') {
    item = itemIndex;
    itemIndex = null;
  }
  if (typeof item === 'function') {
    getMetaSection.call(this, sectionIndex).item = item;
    return this;
  }
  var menuIndex = { sectionIndex: sectionIndex, itemIndex: itemIndex };
  if (!item) {
    return getItem.call(this, menuIndex);
  }
  var items = getItems.call(this, menuIndex, true);
  var prevLength = items.length;
  items[itemIndex] = util2.copy(item, items[itemIndex]);
  if (items.length !== prevLength) {
    this._resolveSection(menuIndex);
  }
  this._resolveItem(menuIndex);
  return this;
};

Menu.prototype.selection = function(callback) {
  this._selections.push(callback);
  simply.impl.menuSelection();
};

Menu.emit = function(type, subtype, e) {
  Window.emit(type, subtype, e, Menu);
};

Menu.emitSection = function(sectionIndex) {
  var menu = WindowStack.top();
  if (!(menu instanceof Menu)) { return; }
  var e = {
    sectionIndex: sectionIndex
  };
  if (Menu.emit('section', null, e) === false) {
    return false;
  }
  menu._resolveSection(e);
};

Menu.emitItem = function(sectionIndex, itemIndex) {
  var menu = WindowStack.top();
  if (!(menu instanceof Menu)) { return; }
  var e = {
    sectionIndex: sectionIndex,
    itemIndex: itemIndex,
  };
  if (Menu.emit('item', null, e) === false) {
    return false;
  }
  menu._resolveItem(e);
};

Menu.emitSelect = function(type, sectionIndex, itemIndex) {
  var menu = WindowStack.top();
  if (!(menu instanceof Menu)) { return; }
  var e = {
    sectionIndex: sectionIndex,
    itemIndex: itemIndex,
  };
  switch (type) {
    case 'menuSelect': type = 'select'; break;
    case 'menuLongSelect': type = 'longSelect'; break;
    case 'menuSelection': type = 'selection'; break;
  }
  if (Menu.emit(type, null, e) === false) {
    return false;
  }
  menu._emitSelect(e);
};

module.exports = Menu;
