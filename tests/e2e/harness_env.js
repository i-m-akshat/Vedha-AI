/**
 * Vedha AI Chrome Extension — Standalone DOM & MV3 Test Harness Environment
 * 
 * Provides an independent, pure Node.js implementation of:
 * 1. DOM Core & HTML Form Elements (InputElement, SelectElement, TextAreaElement, ButtonElement)
 * 2. React 16-19 _valueTracker simulation & Composed Event Dispatch
 * 3. Shadow DOM encapsulation (attachShadow, shadowRoot)
 * 4. CSS Selector engine (tag, class, id, attribute, :not, :disabled, :checked, combinators)
 * 5. Chrome Extension MV3 API Mock (runtime, tabs, storage, sidePanel, scripting, windows)
 * 6. Isolated Script Loader with VM execution & memory exports
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- 1. Event System ---
class Event {
  constructor(type, eventInit = {}) {
    this.type = type;
    this.bubbles = !!eventInit.bubbles;
    this.cancelable = !!eventInit.cancelable;
    this.composed = !!eventInit.composed;
    this.target = null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this._propagationStopped = false;
    this._immediatePropagationStopped = false;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }

  stopImmediatePropagation() {
    this._immediatePropagationStopped = true;
    this._propagationStopped = true;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

class CustomEvent extends Event {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.detail = eventInit.detail !== undefined ? eventInit.detail : null;
  }
}

class UIEvent extends Event {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.view = eventInit.view || null;
    this.detail = eventInit.detail || 0;
  }
}

class MouseEvent extends UIEvent {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.clientX = eventInit.clientX || 0;
    this.clientY = eventInit.clientY || 0;
    this.button = eventInit.button || 0;
    this.buttons = eventInit.buttons || 0;
  }
}

class PointerEvent extends MouseEvent {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.pointerId = eventInit.pointerId || 1;
    this.pointerType = eventInit.pointerType || 'mouse';
  }
}

class InputEvent extends UIEvent {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.data = eventInit.data !== undefined ? eventInit.data : null;
    this.inputType = eventInit.inputType || 'insertText';
  }
}

class FocusEvent extends UIEvent {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.relatedTarget = eventInit.relatedTarget || null;
  }
}

class KeyboardEvent extends UIEvent {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.key = eventInit.key || '';
    this.code = eventInit.code || '';
    this.keyCode = eventInit.keyCode || 0;
  }
}

// --- 2. CSS Style Declaration & ClassList ---
class CSSStyleDeclaration {
  constructor(element) {
    this._element = element;
    this._properties = new Map();
  }

  setProperty(propertyName, value, priority = '') {
    const key = propertyName.trim().toLowerCase();
    this._properties.set(key, { value: String(value), priority: priority.trim().toLowerCase() });
    const camel = key.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    this[camel] = String(value);
    this[key] = String(value);
  }

  getPropertyValue(propertyName) {
    const key = propertyName.trim().toLowerCase();
    const entry = this._properties.get(key);
    return entry ? entry.value : (this[key] || '');
  }

  getPropertyPriority(propertyName) {
    const key = propertyName.trim().toLowerCase();
    const entry = this._properties.get(key);
    return entry ? entry.priority : '';
  }

  removeProperty(propertyName) {
    const key = propertyName.trim().toLowerCase();
    const entry = this._properties.get(key);
    const prev = entry ? entry.value : '';
    this._properties.delete(key);
    const camel = key.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    delete this[camel];
    delete this[key];
    return prev;
  }

  get cssText() {
    const parts = [];
    for (const [key, entry] of this._properties.entries()) {
      const prio = entry.priority ? ` !${entry.priority}` : '';
      parts.push(`${key}: ${entry.value}${prio}`);
    }
    return parts.join('; ');
  }

  set cssText(text) {
    this._properties.clear();
    if (!text) return;
    const rules = text.split(';');
    for (const rule of rules) {
      const idx = rule.indexOf(':');
      if (idx !== -1) {
        const prop = rule.slice(0, idx).trim();
        let val = rule.slice(idx + 1).trim();
        let prio = '';
        if (val.toLowerCase().includes('!important')) {
          prio = 'important';
          val = val.replace(/!important/i, '').trim();
        }
        this.setProperty(prop, val, prio);
      }
    }
  }
}

class DOMTokenList {
  constructor(element) {
    this._element = element;
    this._tokens = new Set();
  }

  _syncFromAttr() {
    const cls = this._element.getAttribute('class') || '';
    this._tokens = new Set(cls.split(/\s+/).filter(Boolean));
  }

  _syncToAttr() {
    const cls = Array.from(this._tokens).join(' ');
    if (cls) {
      this._element.setAttribute('class', cls);
    } else {
      this._element.removeAttribute('class');
    }
  }

  add(...tokens) {
    this._syncFromAttr();
    for (const t of tokens) if (t) this._tokens.add(String(t));
    this._syncToAttr();
  }

  remove(...tokens) {
    this._syncFromAttr();
    for (const t of tokens) this._tokens.delete(String(t));
    this._syncToAttr();
  }

  contains(token) {
    this._syncFromAttr();
    return this._tokens.has(String(token));
  }

  toggle(token, force) {
    this._syncFromAttr();
    const has = this.contains(token);
    const shouldAdd = force !== undefined ? !!force : !has;
    if (shouldAdd) this.add(token);
    else this.remove(token);
    return shouldAdd;
  }

  toString() {
    this._syncFromAttr();
    return Array.from(this._tokens).join(' ');
  }
}

// --- 3. DOM Nodes & Elements ---
class Node {
  constructor(nodeType = 1, nodeName = '') {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.childNodes = [];
    this.parentNode = null;
    this.parentElement = null;
    this.ownerDocument = null;
    this._eventListeners = new Map();
  }

  get textContent() {
    if (this.nodeType === 3) return this._text || '';
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.childNodes = [];
    if (val !== undefined && val !== null && String(val) !== '') {
      const textNode = new TextNode(String(val));
      this.appendChild(textNode);
    }
  }

  contains(otherNode) {
    if (!otherNode) return false;
    let curr = otherNode;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode || curr.parentElement;
    }
    return false;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    child.parentElement = this.nodeType === 1 ? this : null;
    child.ownerDocument = this.ownerDocument || (this.nodeType === 9 ? this : null);
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
      child.parentElement = null;
      return child;
    }
    throw new Error('NotFoundError: node is not a child of this node');
  }

  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx === -1) throw new Error('NotFoundError: reference node not found');
    if (newNode.parentNode) {
      newNode.parentNode.removeChild(newNode);
    }
    newNode.parentNode = this;
    newNode.parentElement = this.nodeType === 1 ? this : null;
    newNode.ownerDocument = this.ownerDocument;
    this.childNodes.splice(idx, 0, newNode);
    return newNode;
  }

  replaceChild(newChild, oldChild) {
    this.insertBefore(newChild, oldChild);
    return this.removeChild(oldChild);
  }

  addEventListener(type, listener, options = {}) {
    const key = String(type).toLowerCase();
    if (!this._eventListeners.has(key)) {
      this._eventListeners.set(key, []);
    }
    this._eventListeners.get(key).push({ listener, options });
  }

  removeEventListener(type, listener) {
    const key = String(type).toLowerCase();
    const list = this._eventListeners.get(key);
    if (list) {
      this._eventListeners.set(key, list.filter(item => item.listener !== listener));
    }
  }

  dispatchEvent(event) {
    event.target = this;
    let current = this;
    const path = [];
    while (current) {
      path.push(current);
      current = current.parentElement || current.parentNode;
    }

    // Target phase
    event.currentTarget = this;
    const listeners = this._eventListeners.get(event.type.toLowerCase()) || [];
    for (const item of [...listeners]) {
      if (event._immediatePropagationStopped) break;
      try {
        if (typeof item.listener === 'function') {
          item.listener.call(this, event);
        } else if (item.listener && typeof item.listener.handleEvent === 'function') {
          item.listener.handleEvent(event);
        }
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }

    // Bubbling phase
    if (event.bubbles && !event._propagationStopped) {
      for (let i = 1; i < path.length; i++) {
        if (event._propagationStopped) break;
        const ancestor = path[i];
        event.currentTarget = ancestor;
        const ancListeners = ancestor._eventListeners.get(event.type.toLowerCase()) || [];
        for (const item of [...ancListeners]) {
          if (event._immediatePropagationStopped) break;
          try {
            if (typeof item.listener === 'function') {
              item.listener.call(ancestor, event);
            } else if (item.listener && typeof item.listener.handleEvent === 'function') {
              item.listener.handleEvent(event);
            }
          } catch (err) {
            console.error('Error in bubbling listener:', err);
          }
        }
      }
    }
    return !event.defaultPrevented;
  }
}

class TextNode extends Node {
  constructor(text = '') {
    super(3, '#text');
    this._text = String(text);
  }

  get textContent() {
    return this._text;
  }

  set textContent(val) {
    this._text = String(val);
  }
}

class CommentNode extends Node {
  constructor(text = '') {
    super(8, '#comment');
    this._text = String(text);
  }
}

class ShadowRoot extends Node {
  constructor(host, mode = 'open') {
    super(11, '#shadow-root');
    this.host = host;
    this.mode = mode;
  }

  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    return querySelectorAll(this, selector);
  }

  get innerHTML() {
    return serializeChildren(this);
  }

  set innerHTML(html) {
    this.childNodes = [];
    parseHTMLToNode(html, this);
  }
}

class Element extends Node {
  constructor(tagName = 'div') {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.style = new CSSStyleDeclaration(this);
    this.classList = new DOMTokenList(this);
    this._shadowRoot = null;
    this._rect = { top: 0, left: 0, bottom: 40, right: 120, width: 120, height: 40, x: 0, y: 0 };

    this.dataset = new Proxy({}, {
      get: (_, prop) => {
        const attr = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        return this.getAttribute(attr);
      },
      set: (_, prop, val) => {
        const attr = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        this.setAttribute(attr, String(val));
        return true;
      }
    });
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(val) { this.setAttribute('id', val); }

  get className() { return this.getAttribute('class') || ''; }
  set className(val) { this.setAttribute('class', val); }

  setAttribute(name, value) {
    const k = name.toLowerCase();
    const v = String(value);
    this.attributes.set(k, v);
    if (k === 'style') {
      this.style.cssText = v;
    }
  }

  getAttribute(name) {
    const k = name.toLowerCase();
    if (k === 'style') {
      return this.style.cssText;
    }
    const val = this.attributes.get(k);
    return val !== undefined ? val : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  removeAttribute(name) {
    this.attributes.delete(name.toLowerCase());
  }

  getAttributeNames() {
    return Array.from(this.attributes.keys());
  }

  get children() {
    return this.childNodes.filter(n => n.nodeType === 1);
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get lastElementChild() {
    const c = this.children;
    return c[c.length - 1] || null;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return (idx !== -1 && idx + 1 < siblings.length) ? siblings[idx + 1] : null;
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return (idx > 0) ? siblings[idx - 1] : null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  attachShadow(options = { mode: 'open' }) {
    if (this._shadowRoot) throw new Error('InvalidStateError: Shadow root already exists');
    this._shadowRoot = new ShadowRoot(this, options.mode);
    return this._shadowRoot;
  }

  get shadowRoot() {
    return this._shadowRoot;
  }

  getBoundingClientRect() {
    return { ...this._rect };
  }

  setBoundingClientRect(rect) {
    this._rect = { ...this._rect, ...rect };
  }

  scrollIntoView() {}

  focus() {
    this.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
  }

  blur() {
    this.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
  }

  click() {
    // Mirror real browser default action: clicking a checkbox toggles it;
    // clicking a radio checks it and unchecks same-name group siblings.
    // Without this, click-based remediation can never be observed by tests.
    try {
      const tag = (this.tagName || this.nodeName || '').toUpperCase();
      const type = String(this.getAttribute ? (this.getAttribute('type') || '') : '').toLowerCase();
      if (tag === 'INPUT' && (type === 'checkbox' || type === 'radio') && !this.disabled) {
        if (type === 'checkbox') {
          this._checked = !this._checked;
        } else if (!this._checked) {
          const name = this.getAttribute ? this.getAttribute('name') : null;
          const doc = this.ownerDocument;
          if (name && doc && typeof doc.querySelectorAll === 'function') {
            const group = doc.querySelectorAll('input[type="radio"]');
            for (const sib of group || []) {
              if (sib !== this && sib.getAttribute && sib.getAttribute('name') === name) {
                sib._checked = false;
              }
            }
          }
          this._checked = true;
        }
      }
    } catch (_) { /* default-action simulation must never break dispatch */ }
    this.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  get innerHTML() {
    return serializeChildren(this);
  }

  set innerHTML(html) {
    this.childNodes = [];
    parseHTMLToNode(html, this);
  }

  get outerHTML() {
    return serializeElement(this);
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let curr = this;
    while (curr && curr.nodeType === 1) {
      if (matchesSelector(curr, selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    return querySelectorAll(this, selector);
  }
}

// Form Elements with React reactivity simulation and validity
class HTMLInputElement extends Element {
  constructor() {
    super('input');
    this._value = undefined;
    this._checked = false;
    this.validity = {
      valid: true,
      badInput: false,
      valueMissing: false,
      typeMismatch: false,
      patternMismatch: false,
      tooLong: false,
      tooShort: false,
      rangeUnderflow: false,
      rangeOverflow: false,
      stepMismatch: false,
      customError: false
    };
    this.validationMessage = '';
  }

  get type() { return this.getAttribute('type') || 'text'; }
  set type(val) { this.setAttribute('type', val); }

  get name() { return this.getAttribute('name') || ''; }
  set name(val) { this.setAttribute('name', val); }

  get value() { 
    return this._value !== undefined ? this._value : (this.getAttribute('value') || ''); 
  }
  set value(val) {
    const prev = this.value;
    this._value = String(val);
    if (this._valueTracker) {
      this._valueTracker.setValue(prev);
    }
  }

  get checked() { return this._checked; }
  set checked(val) { this._checked = !!val; }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(val) {
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get required() { return this.hasAttribute('required'); }
  set required(val) {
    if (val) this.setAttribute('required', '');
    else this.removeAttribute('required');
  }

  setCustomValidity(msg) {
    this.validationMessage = String(msg || '');
    this.validity.customError = !!this.validationMessage;
    this.validity.valid = !this.validationMessage;
  }

  checkValidity() {
    if (this.required && !this.value) {
      this.validity.valueMissing = true;
      this.validity.valid = false;
      this.validationMessage = 'Please fill out this field.';
      return false;
    }
    return this.validity.valid;
  }
}

class HTMLTextAreaElement extends Element {
  constructor() {
    super('textarea');
    this._value = undefined;
    this.validity = { valid: true, valueMissing: false, customError: false };
    this.validationMessage = '';
  }

  get value() { 
    return this._value !== undefined ? this._value : (this.getAttribute('value') || this.textContent || ''); 
  }
  set value(val) {
    const prev = this.value;
    this._value = String(val);
    if (this._valueTracker) {
      this._valueTracker.setValue(prev);
    }
  }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(val) {
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get required() { return this.hasAttribute('required'); }
  set required(val) {
    if (val) this.setAttribute('required', '');
    else this.removeAttribute('required');
  }

  setCustomValidity(msg) {
    this.validationMessage = String(msg || '');
    this.validity.customError = !!this.validationMessage;
    this.validity.valid = !this.validationMessage;
  }

  checkValidity() {
    return this.validity.valid;
  }
}

class HTMLSelectElement extends Element {
  constructor() {
    super('select');
    this._value = '';
    this.validity = { valid: true, valueMissing: false, customError: false };
    this.validationMessage = '';
  }

  get options() {
    return this.querySelectorAll('option');
  }

  get selectedIndex() {
    const opts = this.options;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].selected) return i;
    }
    return opts.length > 0 ? 0 : -1;
  }

  set selectedIndex(idx) {
    const opts = this.options;
    for (let i = 0; i < opts.length; i++) {
      opts[i].selected = (i === idx);
      if (i === idx) this._value = opts[i].value;
    }
  }

  get value() {
    const idx = this.selectedIndex;
    const opts = this.options;
    if (idx >= 0 && idx < opts.length) {
      return opts[idx].value;
    }
    return this._value;
  }

  set value(val) {
    this._value = String(val);
    const opts = this.options;
    for (const opt of opts) {
      opt.selected = (opt.value === this._value);
    }
  }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(val) {
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  get required() { return this.hasAttribute('required'); }
  set required(val) {
    if (val) this.setAttribute('required', '');
    else this.removeAttribute('required');
  }

  setCustomValidity(msg) {
    this.validationMessage = String(msg || '');
    this.validity.customError = !!this.validationMessage;
    this.validity.valid = !this.validationMessage;
  }

  checkValidity() {
    return this.validity.valid;
  }
}

class HTMLOptionElement extends Element {
  constructor() {
    super('option');
    this._selected = false;
  }

  get value() {
    return this.hasAttribute('value') ? this.getAttribute('value') : this.textContent.trim();
  }
  set value(val) { this.setAttribute('value', val); }

  get text() { return this.textContent.trim(); }
  set text(val) { this.textContent = val; }

  get selected() { return this._selected || this.hasAttribute('selected'); }
  set selected(val) { this._selected = !!val; }
}

class HTMLButtonElement extends Element {
  constructor() {
    super('button');
  }

  get type() { return this.getAttribute('type') || 'submit'; }
  set type(val) { this.setAttribute('type', val); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(val) {
    if (val) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }
}

// --- 4. CSS Selector Engine ---
function matchesSelector(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  selector = selector.trim();

  // Comma-separated selectors
  if (selector.includes(',')) {
    const parts = selector.split(',').map(s => s.trim());
    return parts.some(p => matchesSelector(el, p));
  }

  // Combinator > (child)
  if (selector.includes(' > ')) {
    const parts = selector.split(' > ').map(s => s.trim());
    const right = parts.pop();
    if (!matchesSimpleSelector(el, right)) return false;
    const parent = el.parentElement;
    if (!parent) return false;
    return matchesSelector(parent, parts.join(' > '));
  }

  // Combinator (descendant)
  if (selector.includes(' ')) {
    const parts = selector.split(/\s+/).map(s => s.trim());
    const right = parts.pop();
    if (!matchesSimpleSelector(el, right)) return false;
    let curr = el.parentElement;
    while (curr) {
      if (matchesSelector(curr, parts.join(' '))) return true;
      curr = curr.parentElement;
    }
    return false;
  }

  return matchesSimpleSelector(el, selector);
}

function matchesSimpleSelector(el, sel) {
  if (!sel || sel === '*') return true;

  // Handle :not(...)
  const notMatch = sel.match(/:not\(([^)]+)\)/);
  if (notMatch) {
    const inner = notMatch[1];
    const stripped = sel.replace(notMatch[0], '');
    if (matchesSelector(el, inner)) return false;
    if (stripped) return matchesSimpleSelector(el, stripped);
    return true;
  }

  // Handle :disabled
  if (sel.includes(':disabled')) {
    if (!el.disabled && !el.hasAttribute('disabled')) return false;
    sel = sel.replace(':disabled', '');
    if (!sel) return true;
  }

  // Handle :checked
  if (sel.includes(':checked')) {
    if (!el.checked && !el.hasAttribute('checked')) return false;
    sel = sel.replace(':checked', '');
    if (!sel) return true;
  }

  // Extract attributes: [attr], [attr='val'], [attr*='val'], [attr^='val'], [attr$='val']
  const attrRegex = /\[([a-zA-Z0-9_-]+)(?:([*^$]?=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g;
  let m;
  let remaining = sel;
  while ((m = attrRegex.exec(sel)) !== null) {
    const attrName = m[1].toLowerCase();
    const op = m[2];
    const val = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);

    if (!el.hasAttribute(attrName)) return false;
    if (op) {
      const elVal = el.getAttribute(attrName) || '';
      if (op === '=' && elVal !== val) return false;
      if (op === '*=' && !elVal.includes(val)) return false;
      if (op === '^=' && !elVal.startsWith(val)) return false;
      if (op === '$=' && !elVal.endsWith(val)) return false;
    }
    remaining = remaining.replace(m[0], '');
  }

  if (!remaining) return true;

  // Split remaining into tag, classes, id
  const tagMatch = remaining.match(/^[a-zA-Z0-9_-]+/);
  if (tagMatch) {
    const expectedTag = tagMatch[0].toUpperCase();
    if (el.tagName !== expectedTag) return false;
    remaining = remaining.slice(tagMatch[0].length);
  }

  if (remaining.includes('#')) {
    const idParts = remaining.split('#');
    const id = idParts[1].split('.')[0];
    if (el.id !== id) return false;
    remaining = idParts[0] + (idParts[1].includes('.') ? '.' + idParts[1].split('.').slice(1).join('.') : '');
  }

  if (remaining.includes('.')) {
    const classes = remaining.split('.').filter(Boolean);
    for (const c of classes) {
      if (!el.classList.contains(c)) return false;
    }
  }

  return true;
}

function querySelectorAll(root, selector) {
  const results = [];
  function walk(node) {
    if (node.nodeType === 1 && node !== root) {
      if (matchesSelector(node, selector)) {
        results.push(node);
      }
    }
    for (const child of node.childNodes) {
      if (child.nodeType === 1) {
        walk(child);
      }
    }
  }
  walk(root);
  return results;
}

function querySelector(root, selector) {
  const all = querySelectorAll(root, selector);
  return all.length > 0 ? all[0] : null;
}

// --- 5. HTML Parser & Serializer ---
function parseHTMLToNode(html, parentNode) {
  if (!html) return;
  const doc = parentNode.ownerDocument || parentNode;

  // Simple token regex for tags and text
  const tagRegex = /<\/?([a-zA-Z0-9_-]+)((?:\s+[^>]*?)?)\s*(\/?)>|([^<]+)/g;
  let match;
  let curr = parentNode;
  const voidTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'area']);

  while ((match = tagRegex.exec(html)) !== null) {
    const [raw, tagName, attrString, selfClosingSlash, textContent] = match;

    if (textContent) {
      if (textContent.trim() || textContent.includes(' ')) {
        const tNode = doc.createTextNode(textContent);
        curr.appendChild(tNode);
      }
      continue;
    }

    const isClosing = raw.startsWith('</');
    const tag = (tagName || '').toLowerCase();

    if (isClosing) {
      if (curr !== parentNode && curr.parentElement) {
        curr = curr.parentElement;
      }
      continue;
    }

    // Opening tag
    const el = doc.createElement(tag);
    if (attrString) {
      const attrRegex = /([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let am;
      while ((am = attrRegex.exec(attrString)) !== null) {
        const aname = am[1];
        const aval = am[2] !== undefined ? am[2] : (am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : ''));
        el.setAttribute(aname, aval);
        if (aname === 'disabled') el.disabled = true;
        if (aname === 'checked') el.checked = true;
        if (aname === 'required') el.required = true;
      }
    }

    curr.appendChild(el);

    const isSelfClosing = selfClosingSlash === '/' || voidTags.has(tag);
    if (!isSelfClosing) {
      curr = el;
    }
  }
}

function serializeElement(el) {
  const tag = el.tagName.toLowerCase();
  const attrs = [];
  for (const [name, val] of el.attributes.entries()) {
    attrs.push(`${name}="${val.replace(/"/g, '&quot;')}"`);
  }
  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
  const voidTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  if (voidTags.has(tag)) {
    return `<${tag}${attrStr}/>`;
  }
  return `<${tag}${attrStr}>${serializeChildren(el)}</${tag}>`;
}

function serializeChildren(node) {
  let res = '';
  for (const c of node.childNodes) {
    if (c.nodeType === 3) res += c.textContent;
    else if (c.nodeType === 1) res += serializeElement(c);
  }
  return res;
}

// --- 6. Document & Window ---
class Document extends Node {
  constructor() {
    super(9, '#document');
    this.ownerDocument = this;
    this.documentElement = new Element('html');
    this.documentElement.ownerDocument = this;
    this.appendChild(this.documentElement);

    this.head = new Element('head');
    this.head.ownerDocument = this;
    this.documentElement.appendChild(this.head);

    this.body = new Element('body');
    this.body.ownerDocument = this;
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    const t = tagName.toLowerCase();
    let el;
    if (t === 'input') el = new HTMLInputElement();
    else if (t === 'textarea') el = new HTMLTextAreaElement();
    else if (t === 'select') el = new HTMLSelectElement();
    else if (t === 'option') el = new HTMLOptionElement();
    else if (t === 'button') el = new HTMLButtonElement();
    else el = new Element(t);
    el.ownerDocument = this;
    return el;
  }

  createTextNode(text) {
    const n = new TextNode(text);
    n.ownerDocument = this;
    return n;
  }

  createDocumentFragment() {
    const frag = new Node(11, '#document-fragment');
    frag.ownerDocument = this;
    return frag;
  }

  getElementById(id) {
    return querySelector(this, `#${id}`);
  }

  getElementsByClassName(cls) {
    return querySelectorAll(this, `.${cls}`);
  }

  getElementsByTagName(tag) {
    return querySelectorAll(this, tag);
  }

  querySelector(selector) {
    return querySelector(this.documentElement, selector);
  }

  querySelectorAll(selector) {
    return querySelectorAll(this.documentElement, selector);
  }
}

class StorageMock {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    return this._store.has(String(key)) ? this._store.get(String(key)) : null;
  }

  setItem(key, val) {
    this._store.set(String(key), String(val));
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  key(idx) {
    return Array.from(this._store.keys())[idx] || null;
  }

  get length() {
    return this._store.size;
  }
}

class MutationObserverMock {
  constructor(callback) {
    this.callback = callback;
    this.records = [];
  }
  observe(target, options) {}
  disconnect() { this.records = []; }
  takeRecords() {
    const r = this.records;
    this.records = [];
    return r;
  }
}

// --- 7. Chrome Extension MV3 API Mock ---
function createChromeMock(config = {}) {
  const messageListeners = [];
  const localStorageMap = new Map();
  const sessionStorageMap = new Map();
  const tabsList = config.tabs || [
    { id: 1, active: true, url: config.url || 'https://www.linkedin.com/jobs/search/' }
  ];
  let sidePanelBehavior = { openPanelOnActionClick: false };

  return {
    runtime: {
      onMessage: {
        addListener(fn) {
          messageListeners.push(fn);
        },
        removeListener(fn) {
          const idx = messageListeners.indexOf(fn);
          if (idx !== -1) messageListeners.splice(idx, 1);
        },
        hasListener(fn) {
          return messageListeners.includes(fn);
        },
        dispatch(request, sender = { tab: { id: 1 } }) {
          return new Promise(resolve => {
            let responded = false;
            const sendResponse = response => {
              if (!responded) {
                responded = true;
                resolve(response);
              }
            };
            let hasAsync = false;
            for (const listener of [...messageListeners]) {
              try {
                const res = listener(request, sender, sendResponse);
                if (res === true) {
                  hasAsync = true;
                }
              } catch (e) {
                console.error('Error dispatching message:', e);
              }
            }
            const timeoutMs = hasAsync ? 15000 : 10;
            setTimeout(() => {
              if (!responded) resolve(null);
            }, timeoutMs);
          });
        },
      },
      sendMessage(request, callback) {
        return new Promise(resolve => {
          let resolved = false;
          const sendResponse = res => {
            if (!resolved) {
              resolved = true;
              if (typeof callback === 'function') callback(res);
              resolve(res);
            }
          };
          let hasAsync = false;
          for (const listener of [...messageListeners]) {
            try {
              const res = listener(request, {}, sendResponse);
              if (res === true) hasAsync = true;
            } catch (_) {}
          }
          const timeoutMs = hasAsync ? 15000 : 10;
          setTimeout(() => {
            if (!resolved) {
              if (typeof callback === 'function') callback(null);
              resolve(null);
            }
          }, timeoutMs);
        });
      },
      getURL(file) {
        return `chrome-extension://vedha-extension-mock/${file}`;
      },
      lastError: null
    },
    storage: {
      local: {
        get(keys, callback) {
          return new Promise(resolve => {
            const res = {};
            if (typeof keys === 'string') {
              if (localStorageMap.has(keys)) res[keys] = localStorageMap.get(keys);
            } else if (Array.isArray(keys)) {
              for (const k of keys) {
                if (localStorageMap.has(k)) res[k] = localStorageMap.get(k);
              }
            } else if (keys && typeof keys === 'object') {
              for (const [k, def] of Object.entries(keys)) {
                res[k] = localStorageMap.has(k) ? localStorageMap.get(k) : def;
              }
            } else {
              for (const [k, v] of localStorageMap.entries()) res[k] = v;
            }
            if (typeof callback === 'function') callback(res);
            resolve(res);
          });
        },
        set(obj, callback) {
          return new Promise(resolve => {
            for (const [k, v] of Object.entries(obj)) {
              localStorageMap.set(k, v);
            }
            if (typeof callback === 'function') callback();
            resolve();
          });
        },
        remove(keys, callback) {
          return new Promise(resolve => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) localStorageMap.delete(k);
            if (typeof callback === 'function') callback();
            resolve();
          });
        },
        clear(callback) {
          return new Promise(resolve => {
            localStorageMap.clear();
            if (typeof callback === 'function') callback();
            resolve();
          });
        }
      },
      session: {
        get(keys, callback) {
          const res = {};
          for (const [k, v] of sessionStorageMap.entries()) res[k] = v;
          if (typeof callback === 'function') callback(res);
          return Promise.resolve(res);
        },
        set(obj, callback) {
          for (const [k, v] of Object.entries(obj)) sessionStorageMap.set(k, v);
          if (typeof callback === 'function') callback();
          return Promise.resolve();
        }
      }
    },
    tabs: {
      query(queryInfo, callback) {
        return new Promise(resolve => {
          let matches = [...tabsList];
          if (queryInfo.active !== undefined) {
            matches = matches.filter(t => t.active === queryInfo.active);
          }
          if (typeof callback === 'function') callback(matches);
          resolve(matches);
        });
      },
      sendMessage(tabId, message, options, callback) {
        const cb = typeof options === 'function' ? options : callback;
        return this.runtime.sendMessage(message, cb);
      },
      create(props, callback) {
        const newTab = { id: tabsList.length + 1, active: true, ...props };
        tabsList.push(newTab);
        if (typeof callback === 'function') callback(newTab);
        return Promise.resolve(newTab);
      },
      onActivated: {
        listeners: [],
        addListener(fn) { this.listeners.push(fn); },
        dispatch(activeInfo) { for (const fn of this.listeners) fn(activeInfo); }
      },
      onUpdated: {
        listeners: [],
        addListener(fn) { this.listeners.push(fn); },
        dispatch(tabId, changeInfo, tab) { for (const fn of this.listeners) fn(tabId, changeInfo, tab); }
      }
    },
    windows: {
      getCurrent(callback) {
        const win = { id: 100 };
        if (typeof callback === 'function') callback(win);
        return Promise.resolve(win);
      }
    },
    sidePanel: {
      open(options, callback) {
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      setPanelBehavior(behavior, callback) {
        sidePanelBehavior = { ...behavior };
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      getPanelBehavior(callback) {
        if (typeof callback === 'function') callback(sidePanelBehavior);
        return Promise.resolve(sidePanelBehavior);
      }
    },
    scripting: {
      executeScript(details, callback) {
        const result = [{ result: true }];
        if (typeof callback === 'function') callback(result);
        return Promise.resolve(result);
      }
    }
  };
}

// --- 8. Environment Orchestrator ---
function createBrowserEnvironment(options = {}) {
  const url = options.url || 'https://www.linkedin.com/jobs/search/';
  const parsedUrl = new URL(url);

  const doc = new Document();
  if (options.html) {
    doc.body.innerHTML = options.html;
  }

  const activeTimers = [];
  let virtualTimeOffset = 0;

  const MockDate = new Proxy(Date, {
    construct(target, args) {
      if (args.length === 0) return new target(target.now() + virtualTimeOffset);
      return new target(...args);
    },
    get(target, prop) {
      if (prop === 'now') return () => target.now() + virtualTimeOffset;
      return target[prop];
    }
  });

  const trackedSetTimeout = (fn, delay, ...args) => {
    // In test environment, cap all simulated delays to max 5ms for rapid test execution
    const effectiveDelay = typeof delay === 'number' ? Math.min(Math.max(delay, 0), 5) : 0;
    const id = setTimeout(() => {
      if (typeof delay === 'number') {
        virtualTimeOffset += delay;
      }
      try {
        fn(...args);
      } catch (err) {
        // Log timer errors if any
      }
    }, effectiveDelay);
    activeTimers.push({ type: 'timeout', id });
    return id;
  };

  const trackedClearTimeout = id => {
    clearTimeout(id);
    const idx = activeTimers.findIndex(t => t.id === id);
    if (idx !== -1) activeTimers.splice(idx, 1);
  };

  const trackedSetInterval = (fn, delay, ...args) => {
    const effectiveDelay = (typeof delay === 'number' && delay > 100) ? 20 : delay;
    const id = setInterval(fn, effectiveDelay, ...args);
    if (id.unref) id.unref();
    activeTimers.push({ type: 'interval', id });
    return id;
  };

  const trackedClearInterval = id => {
    clearInterval(id);
    const idx = activeTimers.findIndex(t => t.id === id);
    if (idx !== -1) activeTimers.splice(idx, 1);
  };

  const win = {
    Date: MockDate,
    document: doc,
    window: null,
    self: null,
    top: null,
    location: {
      href: parsedUrl.href,
      origin: parsedUrl.origin,
      protocol: parsedUrl.protocol,
      host: parsedUrl.host,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || '',
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      hash: parsedUrl.hash
    },
    localStorage: new StorageMock(),
    sessionStorage: new StorageMock(),
    innerWidth: options.viewportWidth || 1280,
    innerHeight: options.viewportHeight || 800,
    outerWidth: options.viewportWidth || 1280,
    outerHeight: options.viewportHeight || 800,
    getComputedStyle: el => {
      const s = el.style || {};
      return {
        display: s.display || 'block',
        visibility: s.visibility || 'visible',
        opacity: s.opacity !== undefined && s.opacity !== '' ? s.opacity : '1',
        overflow: s.overflow || 'visible',
        zIndex: s.zIndex || s.getPropertyValue('z-index') || '0',
        position: s.position || 'static',
        width: s.width || '100px',
        height: s.height || '30px',
        getPropertyValue: prop => s.getPropertyValue(prop)
      };
    },
    setTimeout: trackedSetTimeout,
    clearTimeout: trackedClearTimeout,
    setInterval: trackedSetInterval,
    clearInterval: trackedClearInterval,
    MutationObserver: MutationObserverMock,
    Event,
    CustomEvent,
    UIEvent,
    MouseEvent,
    PointerEvent,
    InputEvent,
    FocusEvent,
    KeyboardEvent,
    Node,
    Element,
    HTMLInputElement,
    HTMLTextAreaElement,
    HTMLSelectElement,
    HTMLOptionElement,
    HTMLButtonElement,
    URL,
    console,
    fetch: typeof fetch !== 'undefined' ? fetch : async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    })
  };

  win.window = win;
  win.self = win;
  win.top = win;

  const chromeMock = createChromeMock({ url: win.location.href });
  win.chrome = chromeMock;

  const cleanup = () => {
    for (const t of activeTimers) {
      if (t.type === 'interval') clearInterval(t.id);
      else clearTimeout(t.id);
    }
    activeTimers.length = 0;
  };

  return {
    window: win,
    document: doc,
    chrome: chromeMock,
    cleanup
  };
}

// Script Loaders
function loadExtensionContentScript(env) {
  const contentPath = path.resolve(__dirname, '../../extension/content.js');
  let rawCode = fs.readFileSync(contentPath, 'utf8');

  // Inject in-memory introspection hook before the closing IIFE parenthesis
  // Strictly in-memory without modifying extension/content.js on disk!
  const hook = `
  window.__VEDHA_TEST_EXPORTS__ = {
    DEFAULT_CANDIDATE_PROFILE: typeof DEFAULT_CANDIDATE_PROFILE !== 'undefined' ? DEFAULT_CANDIDATE_PROFILE : null,
    findActiveValidationErrors: typeof findActiveValidationErrors !== 'undefined' ? findActiveValidationErrors : null,
    remediateValidationErrors: typeof remediateValidationErrors !== 'undefined' ? remediateValidationErrors : null,
    findFormProgressionButton: typeof findFormProgressionButton !== 'undefined' ? findFormProgressionButton : null,
    manageModalStacking: typeof manageModalStacking !== 'undefined' ? manageModalStacking : null,
    injectFloatingCopilotWidget: typeof injectFloatingCopilotWidget !== 'undefined' ? injectFloatingCopilotWidget : null,
    setNativeValue: typeof setNativeValue !== 'undefined' ? setNativeValue : null,
    showCopilotReviewHud: typeof showCopilotReviewHud !== 'undefined' ? showCopilotReviewHud : null,
    findEasyApplyButton: typeof findEasyApplyButton !== 'undefined' ? findEasyApplyButton : null,
    findEasyApplyModal: typeof findEasyApplyModal !== 'undefined' ? findEasyApplyModal : null,
    isMsgOrChatElement: typeof isMsgOrChatElement !== 'undefined' ? isMsgOrChatElement : null,
    clickElementNaturally: typeof clickElementNaturally !== 'undefined' ? clickElementNaturally : null,
    waitForEasyApplySurface: typeof waitForEasyApplySurface !== 'undefined' ? waitForEasyApplySurface : null
  };
`;
  const modifiedCode = rawCode.replace(/\n\s*\}\)\(\);?\s*$/, `${hook}\n})();`);

  const context = vm.createContext(env.window);
  vm.runInContext(modifiedCode, context, { filename: 'extension/content.js' });
  return env.window.__VEDHA_TEST_EXPORTS__ || {};
}

function loadExtensionPopup(env) {
  const popupHtmlPath = path.resolve(__dirname, '../../extension/popup.html');
  const popupJsPath = path.resolve(__dirname, '../../extension/popup.js');

  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  env.document.body.innerHTML = html;

  let jsCode = fs.readFileSync(popupJsPath, 'utf8');
  const context = vm.createContext(env.window);
  vm.runInContext(jsCode, context, { filename: 'extension/popup.js' });

  // Dispatch DOMContentLoaded to trigger popup logic
  env.document.dispatchEvent(new Event('DOMContentLoaded'));
}

function loadExtensionBackground(env) {
  const bgPath = path.resolve(__dirname, '../../extension/background.js');
  if (!fs.existsSync(bgPath)) {
    return null;
  }
  const bgCode = fs.readFileSync(bgPath, 'utf8');
  const context = vm.createContext(env.window);
  vm.runInContext(bgCode, context, { filename: 'extension/background.js' });
  return true;
}

function readExtensionManifest() {
  const manifestPath = path.resolve(__dirname, '../../extension/manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

module.exports = {
  createBrowserEnvironment,
  loadExtensionContentScript,
  loadExtensionPopup,
  loadExtensionBackground,
  readExtensionManifest,
  Event,
  CustomEvent,
  InputEvent,
  MouseEvent,
  PointerEvent
};
