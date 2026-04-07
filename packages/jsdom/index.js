class NodeBase {
  constructor() {
    this.parentNode = null;
    this.childNodes = [];
  }

  appendChild(node) {
    if (typeof node === "string") {
      node = new TextNode(node);
    }

    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }

  get parentElement() {
    return this.parentNode instanceof ElementNode ? this.parentNode : null;
  }
}

class TextNode extends NodeBase {
  constructor(text) {
    super();
    this.nodeType = 3;
    this.data = String(text);
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value);
  }
}

class ElementNode extends NodeBase {
  constructor(tagName) {
    super();
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this._textContent = "";
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name.startsWith("data-")) {
      const key = toDatasetKey(name.slice(5));
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  get lastElementChild() {
    for (let index = this.childNodes.length - 1; index >= 0; index -= 1) {
      const child = this.childNodes[index];
      if (child instanceof ElementNode) {
        return child;
      }
    }
    return null;
  }

  get textContent() {
    if (this.childNodes.length === 0) {
      return this._textContent;
    }

    return this.childNodes.map((child) => child.textContent ?? "").join("");
  }

  set textContent(value) {
    this._textContent = String(value);
    this.childNodes = [];
  }

  get innerHTML() {
    return this.textContent;
  }

  set innerHTML(value) {
    this._textContent = String(value);
    this.childNodes = [];
  }

  appendChild(node) {
    if (typeof node === "string") {
      node = new TextNode(node);
    }

    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  insertAdjacentElement(position, element) {
    if (position !== "afterend") {
      throw new Error(`Unsupported insertAdjacentElement position: ${position}`);
    }

    const parent = this.parentNode;
    if (!parent) {
      throw new Error("Cannot insert adjacent element without a parent");
    }

    const index = parent.childNodes.indexOf(this);
    parent.childNodes.splice(index + 1, 0, element);
    element.parentNode = parent;
    return element;
  }

  closest(selector) {
    const tags = selector.split(",").map((item) => item.trim().toUpperCase());
    let current = this;
    while (current) {
      if (current instanceof ElementNode && tags.includes(current.tagName)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
}

class DocumentNode extends NodeBase {
  constructor(window) {
    super();
    this.nodeType = 9;
    this.defaultView = window;
    this.body = new ElementNode("body");
    this.body.parentNode = this;
    this.childNodes = [this.body];
    this._selection = new SelectionNode();
  }

  createElement(tagName) {
    return new ElementNode(tagName);
  }

  createTextNode(text) {
    return new TextNode(text);
  }

  createRange() {
    return new RangeNode();
  }

  getSelection() {
    return this._selection;
  }
}

class RangeNode {
  constructor() {
    this.startContainer = null;
  }

  selectNodeContents(node) {
    this.startContainer = node;
  }
}

class SelectionNode {
  constructor() {
    this._ranges = [];
  }

  get rangeCount() {
    return this._ranges.length;
  }

  addRange(range) {
    this._ranges.push(range);
  }

  removeAllRanges() {
    this._ranges = [];
  }

  getRangeAt(index) {
    return this._ranges[index];
  }

  toString() {
    const range = this._ranges[0];
    if (!range || !range.startContainer) {
      return "";
    }
    return range.startContainer.textContent ?? "";
  }
}

class VirtualConsole {
  sendTo() {
    return this;
  }
}

class EventTargetNode {
  addEventListener() {}

  removeEventListener() {}

  dispatchEvent() {
    return true;
  }
}

class EventNode {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.composed = Boolean(init.composed);
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

class MessageEventNode extends EventNode {
  constructor(type, init = {}) {
    super(type, init);
    this.data = init.data;
  }
}

class CookieJar {}

class ResourceLoader {}

class JSDOM {
  constructor(html = "<!DOCTYPE html>", _options = {}) {
    const window = createWindow();
    this.window = window;

    if (typeof html === "string" && html.includes("<body>")) {
      window.document.body.textContent = stripHtml(html);
    }
  }
}

function createWindow() {
  const window = {};
  const listeners = new Map();
  window.EventTarget = EventTargetNode;
  window.Event = EventNode;
  window.CustomEvent = EventNode;
  window.MessageEvent = MessageEventNode;
  window.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
  window.Element = ElementNode;
  window.HTMLElement = ElementNode;
  window.Text = TextNode;
  window.Range = RangeNode;
  window.Selection = SelectionNode;
  window.document = new DocumentNode(window);
  window.getSelection = () => window.document.getSelection();
  window.window = window;
  window.self = window;
  window.globalThis = window;
  window.close = () => {};
  window.console = console;
  window.Buffer = Buffer;
  window.navigator = { userAgent: "shim-jsdom" };
  window.location = { href: "http://localhost/" };
  window.addEventListener = (type, listener) => {
    const entries = listeners.get(type) ?? [];
    entries.push(listener);
    listeners.set(type, entries);
  };
  window.removeEventListener = (type, listener) => {
    const entries = listeners.get(type);
    if (!entries) {
      return;
    }

    const index = entries.indexOf(listener);
    if (index >= 0) {
      entries.splice(index, 1);
    }
  };
  window.dispatchEvent = (event) => {
    const entries = listeners.get(event.type) ?? [];
    for (const listener of entries) {
      listener.call(window, event);
    }
    return true;
  };
  window.setTimeout = setTimeout.bind(globalThis);
  window.clearTimeout = clearTimeout.bind(globalThis);
  window.setInterval = setInterval.bind(globalThis);
  window.clearInterval = clearInterval.bind(globalThis);
  window.queueMicrotask = queueMicrotask.bind(globalThis);
  window.Promise = Promise;
  window.Date = Date;
  window.Math = Math;
  window.JSON = JSON;
  window.Array = Array;
  window.Object = Object;
  window.String = String;
  window.Number = Number;
  window.Boolean = Boolean;
  window.RegExp = RegExp;
  window.Error = Error;
  window.TypeError = TypeError;
  window.SyntaxError = SyntaxError;
  window.RangeError = RangeError;
  window.WeakMap = WeakMap;
  window.Map = Map;
  window.Set = Set;
  window.Symbol = Symbol;
  window.parseInt = parseInt;
  window.parseFloat = parseFloat;
  window.isNaN = isNaN;
  window.isFinite = isFinite;
  window.structuredClone = globalThis.structuredClone?.bind(globalThis);
  return window;
}

function toDatasetKey(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, "");
}

export { CookieJar, JSDOM, ResourceLoader, VirtualConsole };
