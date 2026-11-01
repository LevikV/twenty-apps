import { createRequire as __createRequire } from 'module';
const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e2) {
    throw mod = 0, e2;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@sniptt/guards/build/guards/primitives.js
var require_primitives = __commonJS({
  "node_modules/@sniptt/guards/build/guards/primitives.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isSymbol = exports.isBigInt = exports.isString = exports.isNumber = exports.isBoolean = exports.isUndefined = void 0;
    var isUndefined = (term) => {
      return typeof term === "undefined";
    };
    exports.isUndefined = isUndefined;
    var isBoolean = (term) => {
      return typeof term === "boolean";
    };
    exports.isBoolean = isBoolean;
    var isNumber = (term) => {
      return typeof term === "number" && !Number.isNaN(term);
    };
    exports.isNumber = isNumber;
    var isString = (term) => {
      return typeof term === "string";
    };
    exports.isString = isString;
    var isBigInt = (term) => {
      return typeof term === "bigint";
    };
    exports.isBigInt = isBigInt;
    var isSymbol = (term) => {
      return typeof term === "symbol";
    };
    exports.isSymbol = isSymbol;
  }
});

// node_modules/@sniptt/guards/build/guards/structural.js
var require_structural = __commonJS({
  "node_modules/@sniptt/guards/build/guards/structural.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isDate = exports.isWeakSet = exports.isWeakMap = exports.isSet = exports.isMap = exports.isArray = exports.isObject = exports.isFunction = exports.isNull = void 0;
    var isNull = (term) => {
      return term === null;
    };
    exports.isNull = isNull;
    var isFunction = (term) => {
      return typeof term === "function";
    };
    exports.isFunction = isFunction;
    var isObject = (term) => {
      return !exports.isNull(term) && typeof term === "object";
    };
    exports.isObject = isObject;
    var isArray = (term) => {
      return Array.isArray(term);
    };
    exports.isArray = isArray;
    var isMap = (term) => {
      return term instanceof Map;
    };
    exports.isMap = isMap;
    var isSet = (term) => {
      return term instanceof Set;
    };
    exports.isSet = isSet;
    var isWeakMap = (term) => {
      return term instanceof WeakMap;
    };
    exports.isWeakMap = isWeakMap;
    var isWeakSet = (term) => {
      return term instanceof WeakSet;
    };
    exports.isWeakSet = isWeakSet;
    var isDate = (term) => {
      return term instanceof Date;
    };
    exports.isDate = isDate;
  }
});

// node_modules/@sniptt/guards/build/guards/convenience.js
var require_convenience = __commonJS({
  "node_modules/@sniptt/guards/build/guards/convenience.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isNegativeInteger = exports.isNonNegativeInteger = exports.isPositiveInteger = exports.isInteger = exports.isNumberOrNaN = exports.isNonEmptyString = exports.isNonEmptyArray = exports.isObjectOrNull = void 0;
    var primitives_1 = require_primitives();
    var structural_1 = require_structural();
    var isObjectOrNull = (term) => {
      return typeof term === "object";
    };
    exports.isObjectOrNull = isObjectOrNull;
    var isNonEmptyArray = (term) => {
      return structural_1.isArray(term) && term.length > 0;
    };
    exports.isNonEmptyArray = isNonEmptyArray;
    var isNonEmptyString = (term) => {
      return primitives_1.isString(term) && term.length > 0;
    };
    exports.isNonEmptyString = isNonEmptyString;
    var isNumberOrNaN = (term) => {
      return typeof term === "number";
    };
    exports.isNumberOrNaN = isNumberOrNaN;
    var isInteger = (term) => {
      return primitives_1.isNumber(term) && Number.isInteger(term);
    };
    exports.isInteger = isInteger;
    var isPositiveInteger = (term) => {
      return exports.isInteger(term) && term > 0;
    };
    exports.isPositiveInteger = isPositiveInteger;
    var isNonNegativeInteger = (term) => {
      return exports.isInteger(term) && term >= 0;
    };
    exports.isNonNegativeInteger = isNonNegativeInteger;
    var isNegativeInteger = (term) => {
      return exports.isInteger(term) && term < 0;
    };
    exports.isNegativeInteger = isNegativeInteger;
  }
});

// node_modules/@sniptt/guards/build/index.js
var require_build = __commonJS({
  "node_modules/@sniptt/guards/build/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o3, m2, k3, k22) {
      if (k22 === void 0) k22 = k3;
      Object.defineProperty(o3, k22, { enumerable: true, get: function() {
        return m2[k3];
      } });
    }) : (function(o3, m2, k3, k22) {
      if (k22 === void 0) k22 = k3;
      o3[k22] = m2[k3];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o3, v3) {
      Object.defineProperty(o3, "default", { enumerable: true, value: v3 });
    }) : function(o3, v3) {
      o3["default"] = v3;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k3 in mod) if (k3 !== "default" && Object.prototype.hasOwnProperty.call(mod, k3)) __createBinding(result, mod, k3);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = exports && exports.__exportStar || function(m2, exports2) {
      for (var p2 in m2) if (p2 !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p2)) __createBinding(exports2, m2, p2);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.structural = exports.primitives = exports.convenience = void 0;
    exports.convenience = __importStar(require_convenience());
    __exportStar(require_convenience(), exports);
    exports.primitives = __importStar(require_primitives());
    __exportStar(require_primitives(), exports);
    exports.structural = __importStar(require_structural());
    __exportStar(require_structural(), exports);
  }
});

// twenty-sdk-define-stub:__twenty-sdk-define-stub__
var __defineFactoryStub = (config) => ({
  success: true,
  config,
  errors: []
});
var __anyHandler = {
  get(_target, prop) {
    if (prop === "__esModule") return true;
    if (prop === Symbol.toPrimitive) return () => "";
    if (typeof prop === "symbol") return void 0;
    return new Proxy(() => void 0, __anyHandler);
  },
  apply() {
    return new Proxy(() => void 0, __anyHandler);
  }
};
var __anyStub = new Proxy(() => void 0, __anyHandler);
var defineLogicFunction = __defineFactoryStub;

// node_modules/twenty-sdk/dist/logic-function/index.mjs
var import_guards = __toESM(require_build(), 1);

// node_modules/uuid/dist-node/stringify.js
var byteToHex = [];
for (let i4 = 0; i4 < 256; ++i4) {
  byteToHex.push((i4 + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist-node/rng.js
import { randomFillSync } from "node:crypto";
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist-node/native.js
import { randomUUID } from "node:crypto";
var native_default = { randomUUID };

// node_modules/uuid/dist-node/v4.js
function _v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i4 = 0; i4 < 16; ++i4) {
      buf[offset + i4] = rnds[i4];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  return _v4(options, buf, offset);
}
var v4_default = v4;

// node_modules/twenty-sdk/dist/logic-function/index.mjs
import { MetadataApiClient as i3 } from "twenty-client-sdk/metadata";

// node_modules/twenty-client-sdk/dist/application-yzkKx8Nd.mjs
var e = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
function t(t3) {
  return typeof t3 == "string" && e.test(t3);
}
function n(e2) {
  if (!t(e2)) throw TypeError("Invalid UUID");
  let n3;
  return Uint8Array.of((n3 = parseInt(e2.slice(0, 8), 16)) >>> 24, n3 >>> 16 & 255, n3 >>> 8 & 255, n3 & 255, (n3 = parseInt(e2.slice(9, 13), 16)) >>> 8, n3 & 255, (n3 = parseInt(e2.slice(14, 18), 16)) >>> 8, n3 & 255, (n3 = parseInt(e2.slice(19, 23), 16)) >>> 8, n3 & 255, (n3 = parseInt(e2.slice(24, 36), 16)) / 1099511627776 & 255, n3 / 4294967296 & 255, n3 >>> 24 & 255, n3 >>> 16 & 255, n3 >>> 8 & 255, n3 & 255);
}
var r = [];
for (let e2 = 0; e2 < 256; ++e2) r.push((e2 + 256).toString(16).slice(1));
function i(e2, t3 = 0) {
  return (r[e2[t3 + 0]] + r[e2[t3 + 1]] + r[e2[t3 + 2]] + r[e2[t3 + 3]] + "-" + r[e2[t3 + 4]] + r[e2[t3 + 5]] + "-" + r[e2[t3 + 6]] + r[e2[t3 + 7]] + "-" + r[e2[t3 + 8]] + r[e2[t3 + 9]] + "-" + r[e2[t3 + 10]] + r[e2[t3 + 11]] + r[e2[t3 + 12]] + r[e2[t3 + 13]] + r[e2[t3 + 14]] + r[e2[t3 + 15]]).toLowerCase();
}
var a;
var o = new Uint8Array(16);
function s() {
  if (!a) {
    if (typeof crypto > "u" || !crypto.getRandomValues) throw Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    a = crypto.getRandomValues.bind(crypto);
  }
  return a(o);
}
function c(e2) {
  e2 = unescape(encodeURIComponent(e2));
  let t3 = new Uint8Array(e2.length);
  for (let n3 = 0; n3 < e2.length; ++n3) t3[n3] = e2.charCodeAt(n3);
  return t3;
}
var l = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
var u = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function d(e2, t3, r2, a3, o3, s3) {
  let l4 = typeof r2 == "string" ? c(r2) : r2, u4 = typeof a3 == "string" ? n(a3) : a3;
  if (typeof a3 == "string" && (a3 = n(a3)), a3?.length !== 16) throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
  let d2 = new Uint8Array(16 + l4.length);
  if (d2.set(u4), d2.set(l4, u4.length), d2 = t3(d2), d2[6] = d2[6] & 15 | e2, d2[8] = d2[8] & 63 | 128, o3) {
    if (s3 ||= 0, s3 < 0 || s3 + 16 > o3.length) throw RangeError(`UUID byte range ${s3}:${s3 + 15} is out of buffer bounds`);
    for (let e3 = 0; e3 < 16; ++e3) o3[s3 + e3] = d2[e3];
    return o3;
  }
  return i(d2);
}
var f = { randomUUID: typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto) };
function p(e2, t3, n3) {
  if (f.randomUUID && !t3 && !e2) return f.randomUUID();
  e2 ||= {};
  let r2 = e2.random ?? e2.rng?.() ?? s();
  if (r2.length < 16) throw Error("Random bytes length must be >= 16");
  if (r2[6] = r2[6] & 15 | 64, r2[8] = r2[8] & 63 | 128, t3) {
    if (n3 ||= 0, n3 < 0 || n3 + 16 > t3.length) throw RangeError(`UUID byte range ${n3}:${n3 + 15} is out of buffer bounds`);
    for (let e3 = 0; e3 < 16; ++e3) t3[n3 + e3] = r2[e3];
    return t3;
  }
  return i(r2);
}
function ee(e2, t3, n3, r2) {
  switch (e2) {
    case 0:
      return t3 & n3 ^ ~t3 & r2;
    case 1:
      return t3 ^ n3 ^ r2;
    case 2:
      return t3 & n3 ^ t3 & r2 ^ n3 & r2;
    case 3:
      return t3 ^ n3 ^ r2;
  }
}
function m(e2, t3) {
  return e2 << t3 | e2 >>> 32 - t3;
}
function te(e2) {
  let t3 = [
    1518500249,
    1859775393,
    2400959708,
    3395469782
  ], n3 = [
    1732584193,
    4023233417,
    2562383102,
    271733878,
    3285377520
  ], r2 = new Uint8Array(e2.length + 1);
  r2.set(e2), r2[e2.length] = 128, e2 = r2;
  let i4 = e2.length / 4 + 2, a3 = Math.ceil(i4 / 16), o3 = Array(a3);
  for (let t4 = 0; t4 < a3; ++t4) {
    let n4 = new Uint32Array(16);
    for (let r3 = 0; r3 < 16; ++r3) n4[r3] = e2[t4 * 64 + r3 * 4] << 24 | e2[t4 * 64 + r3 * 4 + 1] << 16 | e2[t4 * 64 + r3 * 4 + 2] << 8 | e2[t4 * 64 + r3 * 4 + 3];
    o3[t4] = n4;
  }
  o3[a3 - 1][14] = (e2.length - 1) * 8 / 2 ** 32, o3[a3 - 1][14] = Math.floor(o3[a3 - 1][14]), o3[a3 - 1][15] = (e2.length - 1) * 8 & 4294967295;
  for (let e3 = 0; e3 < a3; ++e3) {
    let r3 = new Uint32Array(80);
    for (let t4 = 0; t4 < 16; ++t4) r3[t4] = o3[e3][t4];
    for (let e4 = 16; e4 < 80; ++e4) r3[e4] = m(r3[e4 - 3] ^ r3[e4 - 8] ^ r3[e4 - 14] ^ r3[e4 - 16], 1);
    let i5 = n3[0], a4 = n3[1], s3 = n3[2], c3 = n3[3], l4 = n3[4];
    for (let e4 = 0; e4 < 80; ++e4) {
      let n4 = Math.floor(e4 / 20), o4 = m(i5, 5) + ee(n4, a4, s3, c3) + l4 + t3[n4] + r3[e4] >>> 0;
      l4 = c3, c3 = s3, s3 = m(a4, 30) >>> 0, a4 = i5, i5 = o4;
    }
    n3[0] = n3[0] + i5 >>> 0, n3[1] = n3[1] + a4 >>> 0, n3[2] = n3[2] + s3 >>> 0, n3[3] = n3[3] + c3 >>> 0, n3[4] = n3[4] + l4 >>> 0;
  }
  return Uint8Array.of(n3[0] >> 24, n3[0] >> 16, n3[0] >> 8, n3[0], n3[1] >> 24, n3[1] >> 16, n3[1] >> 8, n3[1], n3[2] >> 24, n3[2] >> 16, n3[2] >> 8, n3[2], n3[3] >> 24, n3[3] >> 16, n3[3] >> 8, n3[3], n3[4] >> 24, n3[4] >> 16, n3[4] >> 8, n3[4]);
}
function ne(e2, t3, n3, r2) {
  return d(80, te, e2, t3, n3, r2);
}
ne.DNS = l, ne.URL = u, Object.freeze({ status: "aborted" });
function h(e2, t3, n3) {
  function r2(n4, r3) {
    var i5;
    Object.defineProperty(n4, "_zod", {
      value: n4._zod ?? {},
      enumerable: false
    }), (i5 = n4._zod).traits ?? (i5.traits = /* @__PURE__ */ new Set()), n4._zod.traits.add(e2), t3(n4, r3);
    for (let e3 in o3.prototype) e3 in n4 || Object.defineProperty(n4, e3, { value: o3.prototype[e3].bind(n4) });
    n4._zod.constr = o3, n4._zod.def = r3;
  }
  let i4 = n3?.Parent ?? Object;
  class a3 extends i4 {
  }
  Object.defineProperty(a3, "name", { value: e2 });
  function o3(e3) {
    var t4;
    let i5 = n3?.Parent ? new a3() : this;
    r2(i5, e3), (t4 = i5._zod).deferred ?? (t4.deferred = []);
    for (let e4 of i5._zod.deferred) e4();
    return i5;
  }
  return Object.defineProperty(o3, "init", { value: r2 }), Object.defineProperty(o3, Symbol.hasInstance, { value: (t4) => n3?.Parent && t4 instanceof n3.Parent ? true : t4?._zod?.traits?.has(e2) }), Object.defineProperty(o3, "name", { value: e2 }), o3;
}
var g = class extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
};
var re = class extends Error {
  constructor(e2) {
    super(`Encountered unidirectional transform during encode: ${e2}`), this.name = "ZodEncodeError";
  }
};
var _ = {};
function v(e2) {
  return e2 && Object.assign(_, e2), _;
}
function ie(e2) {
  let t3 = Object.values(e2).filter((e3) => typeof e3 == "number");
  return Object.entries(e2).filter(([e3, n3]) => t3.indexOf(+e3) === -1).map(([e3, t4]) => t4);
}
function y(e2, t3) {
  return typeof t3 == "bigint" ? t3.toString() : t3;
}
function b(e2) {
  return { get value() {
    {
      let t3 = e2();
      return Object.defineProperty(this, "value", { value: t3 }), t3;
    }
    throw Error("cached value already set");
  } };
}
function ae(e2) {
  return e2 == null;
}
function oe(e2) {
  let t3 = +!!e2.startsWith("^"), n3 = e2.endsWith("$") ? e2.length - 1 : e2.length;
  return e2.slice(t3, n3);
}
var se = /* @__PURE__ */ Symbol("evaluating");
function x(e2, t3, n3) {
  let r2;
  Object.defineProperty(e2, t3, {
    get() {
      if (r2 !== se) return r2 === void 0 && (r2 = se, r2 = n3()), r2;
    },
    set(n4) {
      Object.defineProperty(e2, t3, { value: n4 });
    },
    configurable: true
  });
}
function S(e2, t3, n3) {
  Object.defineProperty(e2, t3, {
    value: n3,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function C(...e2) {
  let t3 = {};
  for (let n3 of e2) Object.assign(t3, Object.getOwnPropertyDescriptors(n3));
  return Object.defineProperties({}, t3);
}
function ce(e2) {
  return JSON.stringify(e2);
}
var le = "captureStackTrace" in Error ? Error.captureStackTrace : (...e2) => {
};
function w(e2) {
  return typeof e2 == "object" && !!e2 && !Array.isArray(e2);
}
var ue = b(() => {
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare")) return false;
  try {
    return Function(""), true;
  } catch {
    return false;
  }
});
function T(e2) {
  if (w(e2) === false) return false;
  let t3 = e2.constructor;
  if (t3 === void 0) return true;
  let n3 = t3.prototype;
  return !(w(n3) === false || Object.prototype.hasOwnProperty.call(n3, "isPrototypeOf") === false);
}
function de(e2) {
  return T(e2) ? { ...e2 } : Array.isArray(e2) ? [...e2] : e2;
}
var fe = /* @__PURE__ */ new Set([
  "string",
  "number",
  "symbol"
]);
function E(e2) {
  return e2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function D(e2, t3, n3) {
  let r2 = new e2._zod.constr(t3 ?? e2._zod.def);
  return (!t3 || n3?.parent) && (r2._zod.parent = e2), r2;
}
function O(e2) {
  let t3 = e2;
  if (!t3) return {};
  if (typeof t3 == "string") return { error: () => t3 };
  if (t3?.message !== void 0) {
    if (t3?.error !== void 0) throw Error("Cannot specify both `message` and `error` params");
    t3.error = t3.message;
  }
  return delete t3.message, typeof t3.error == "string" ? {
    ...t3,
    error: () => t3.error
  } : t3;
}
function pe(e2) {
  return Object.keys(e2).filter((t3) => e2[t3]._zod.optin === "optional" && e2[t3]._zod.optout === "optional");
}
-Number.MAX_VALUE, Number.MAX_VALUE;
function me(e2, t3) {
  let n3 = e2._zod.def;
  return D(e2, C(e2._zod.def, {
    get shape() {
      let e3 = {};
      for (let r2 in t3) {
        if (!(r2 in n3.shape)) throw Error(`Unrecognized key: "${r2}"`);
        t3[r2] && (e3[r2] = n3.shape[r2]);
      }
      return S(this, "shape", e3), e3;
    },
    checks: []
  }));
}
function he(e2, t3) {
  let n3 = e2._zod.def;
  return D(e2, C(e2._zod.def, {
    get shape() {
      let r2 = { ...e2._zod.def.shape };
      for (let e3 in t3) {
        if (!(e3 in n3.shape)) throw Error(`Unrecognized key: "${e3}"`);
        t3[e3] && delete r2[e3];
      }
      return S(this, "shape", r2), r2;
    },
    checks: []
  }));
}
function ge(e2, t3) {
  if (!T(t3)) throw Error("Invalid input to extend: expected a plain object");
  let n3 = e2._zod.def.checks;
  if (n3 && n3.length > 0) throw Error("Object schemas containing refinements cannot be extended. Use `.safeExtend()` instead.");
  return D(e2, C(e2._zod.def, {
    get shape() {
      let n4 = {
        ...e2._zod.def.shape,
        ...t3
      };
      return S(this, "shape", n4), n4;
    },
    checks: []
  }));
}
function _e(e2, t3) {
  if (!T(t3)) throw Error("Invalid input to safeExtend: expected a plain object");
  return D(e2, {
    ...e2._zod.def,
    get shape() {
      let n3 = {
        ...e2._zod.def.shape,
        ...t3
      };
      return S(this, "shape", n3), n3;
    },
    checks: e2._zod.def.checks
  });
}
function ve(e2, t3) {
  return D(e2, C(e2._zod.def, {
    get shape() {
      let n3 = {
        ...e2._zod.def.shape,
        ...t3._zod.def.shape
      };
      return S(this, "shape", n3), n3;
    },
    get catchall() {
      return t3._zod.def.catchall;
    },
    checks: []
  }));
}
function ye(e2, t3, n3) {
  return D(t3, C(t3._zod.def, {
    get shape() {
      let r2 = t3._zod.def.shape, i4 = { ...r2 };
      if (n3) for (let t4 in n3) {
        if (!(t4 in r2)) throw Error(`Unrecognized key: "${t4}"`);
        n3[t4] && (i4[t4] = e2 ? new e2({
          type: "optional",
          innerType: r2[t4]
        }) : r2[t4]);
      }
      else for (let t4 in r2) i4[t4] = e2 ? new e2({
        type: "optional",
        innerType: r2[t4]
      }) : r2[t4];
      return S(this, "shape", i4), i4;
    },
    checks: []
  }));
}
function be(e2, t3, n3) {
  return D(t3, C(t3._zod.def, {
    get shape() {
      let r2 = t3._zod.def.shape, i4 = { ...r2 };
      if (n3) for (let t4 in n3) {
        if (!(t4 in i4)) throw Error(`Unrecognized key: "${t4}"`);
        n3[t4] && (i4[t4] = new e2({
          type: "nonoptional",
          innerType: r2[t4]
        }));
      }
      else for (let t4 in r2) i4[t4] = new e2({
        type: "nonoptional",
        innerType: r2[t4]
      });
      return S(this, "shape", i4), i4;
    },
    checks: []
  }));
}
function k(e2, t3 = 0) {
  if (e2.aborted === true) return true;
  for (let n3 = t3; n3 < e2.issues.length; n3++) if (e2.issues[n3]?.continue !== true) return true;
  return false;
}
function xe(e2, t3) {
  return t3.map((t4) => {
    var n3;
    return (n3 = t4).path ?? (n3.path = []), t4.path.unshift(e2), t4;
  });
}
function A(e2) {
  return typeof e2 == "string" ? e2 : e2?.message;
}
function j(e2, t3, n3) {
  let r2 = {
    ...e2,
    path: e2.path ?? []
  };
  return e2.message || (r2.message = A(e2.inst?._zod.def?.error?.(e2)) ?? A(t3?.error?.(e2)) ?? A(n3.customError?.(e2)) ?? A(n3.localeError?.(e2)) ?? "Invalid input"), delete r2.inst, delete r2.continue, t3?.reportInput || delete r2.input, r2;
}
function Se(e2) {
  return Array.isArray(e2) ? "array" : typeof e2 == "string" ? "string" : "unknown";
}
function M(...e2) {
  let [t3, n3, r2] = e2;
  return typeof t3 == "string" ? {
    message: t3,
    code: "custom",
    input: n3,
    inst: r2
  } : { ...t3 };
}
var Ce = (e2, t3) => {
  e2.name = "$ZodError", Object.defineProperty(e2, "_zod", {
    value: e2._zod,
    enumerable: false
  }), Object.defineProperty(e2, "issues", {
    value: t3,
    enumerable: false
  }), e2.message = JSON.stringify(t3, y, 2), Object.defineProperty(e2, "toString", {
    value: () => e2.message,
    enumerable: false
  });
};
var we = h("$ZodError", Ce);
var Te = h("$ZodError", Ce, { Parent: Error });
function Ee(e2, t3 = (e3) => e3.message) {
  let n3 = {}, r2 = [];
  for (let i4 of e2.issues) i4.path.length > 0 ? (n3[i4.path[0]] = n3[i4.path[0]] || [], n3[i4.path[0]].push(t3(i4))) : r2.push(t3(i4));
  return {
    formErrors: r2,
    fieldErrors: n3
  };
}
function De(e2, t3) {
  let n3 = t3 || function(e3) {
    return e3.message;
  }, r2 = { _errors: [] }, i4 = (e3) => {
    for (let t4 of e3.issues) if (t4.code === "invalid_union" && t4.errors.length) t4.errors.map((e4) => i4({ issues: e4 }));
    else if (t4.code === "invalid_key") i4({ issues: t4.issues });
    else if (t4.code === "invalid_element") i4({ issues: t4.issues });
    else if (t4.path.length === 0) r2._errors.push(n3(t4));
    else {
      let e4 = r2, i5 = 0;
      for (; i5 < t4.path.length; ) {
        let r3 = t4.path[i5];
        i5 === t4.path.length - 1 ? (e4[r3] = e4[r3] || { _errors: [] }, e4[r3]._errors.push(n3(t4))) : e4[r3] = e4[r3] || { _errors: [] }, e4 = e4[r3], i5++;
      }
    }
  };
  return i4(e2), r2;
}
var N = (e2) => (t3, n3, r2, i4) => {
  let a3 = r2 ? Object.assign(r2, { async: false }) : { async: false }, o3 = t3._zod.run({
    value: n3,
    issues: []
  }, a3);
  if (o3 instanceof Promise) throw new g();
  if (o3.issues.length) {
    let t4 = new (i4?.Err ?? e2)(o3.issues.map((e3) => j(e3, a3, v())));
    throw le(t4, i4?.callee), t4;
  }
  return o3.value;
};
var P = (e2) => async (t3, n3, r2, i4) => {
  let a3 = r2 ? Object.assign(r2, { async: true }) : { async: true }, o3 = t3._zod.run({
    value: n3,
    issues: []
  }, a3);
  if (o3 instanceof Promise && (o3 = await o3), o3.issues.length) {
    let t4 = new (i4?.Err ?? e2)(o3.issues.map((e3) => j(e3, a3, v())));
    throw le(t4, i4?.callee), t4;
  }
  return o3.value;
};
var F = (e2) => (t3, n3, r2) => {
  let i4 = r2 ? {
    ...r2,
    async: false
  } : { async: false }, a3 = t3._zod.run({
    value: n3,
    issues: []
  }, i4);
  if (a3 instanceof Promise) throw new g();
  return a3.issues.length ? {
    success: false,
    error: new (e2 ?? we)(a3.issues.map((e3) => j(e3, i4, v())))
  } : {
    success: true,
    data: a3.value
  };
};
var Oe = /* @__PURE__ */ F(Te);
var I = (e2) => async (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { async: true }) : { async: true }, a3 = t3._zod.run({
    value: n3,
    issues: []
  }, i4);
  return a3 instanceof Promise && (a3 = await a3), a3.issues.length ? {
    success: false,
    error: new e2(a3.issues.map((e3) => j(e3, i4, v())))
  } : {
    success: true,
    data: a3.value
  };
};
var ke = /* @__PURE__ */ I(Te);
var Ae = (e2) => (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return N(e2)(t3, n3, i4);
};
var je = (e2) => (t3, n3, r2) => N(e2)(t3, n3, r2);
var Me = (e2) => async (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return P(e2)(t3, n3, i4);
};
var Ne = (e2) => async (t3, n3, r2) => P(e2)(t3, n3, r2);
var Pe = (e2) => (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return F(e2)(t3, n3, i4);
};
var Fe = (e2) => (t3, n3, r2) => F(e2)(t3, n3, r2);
var Ie = (e2) => async (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return I(e2)(t3, n3, i4);
};
var Le = (e2) => async (t3, n3, r2) => I(e2)(t3, n3, r2);
var Re = /^[cC][^\s-]{8,}$/;
var ze = /^[0-9a-z]+$/;
var Be = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
var Ve = /^[0-9a-vA-V]{20}$/;
var He = /^[A-Za-z0-9]{27}$/;
var Ue = /^[a-zA-Z0-9_-]{21}$/;
var We = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var Ge = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var Ke = (e2) => e2 ? RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
var qe = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var Je = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function Ye() {
  return new RegExp(Je, "u");
}
var Xe = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var Ze = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var Qe = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var $e = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var et = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var tt = /^[A-Za-z0-9_-]*$/;
var nt = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
var rt = /^\+(?:[0-9]){6,14}[0-9]$/;
var it = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
var at = /* @__PURE__ */ RegExp(`^${it}$`);
function ot(e2) {
  let t3 = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e2.precision == "number" ? e2.precision === -1 ? `${t3}` : e2.precision === 0 ? `${t3}:[0-5]\\d` : `${t3}:[0-5]\\d\\.\\d{${e2.precision}}` : `${t3}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function st(e2) {
  return RegExp(`^${ot(e2)}$`);
}
function ct(e2) {
  let t3 = ot({ precision: e2.precision }), n3 = ["Z"];
  e2.local && n3.push(""), e2.offset && n3.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  let r2 = `${t3}(?:${n3.join("|")})`;
  return RegExp(`^${it}T(?:${r2})$`);
}
var lt = (e2) => {
  let t3 = e2 ? `[\\s\\S]{${e2?.minimum ?? 0},${e2?.maximum ?? ""}}` : "[\\s\\S]*";
  return RegExp(`^${t3}$`);
};
var ut = /^[^A-Z]*$/;
var dt = /^[^a-z]*$/;
var L = /* @__PURE__ */ h("$ZodCheck", (e2, t3) => {
  var n3;
  e2._zod ??= {}, e2._zod.def = t3, (n3 = e2._zod).onattach ?? (n3.onattach = []);
});
var ft = /* @__PURE__ */ h("$ZodCheckMaxLength", (e2, t3) => {
  var n3;
  L.init(e2, t3), (n3 = e2._zod.def).when ?? (n3.when = (e3) => {
    let t4 = e3.value;
    return !ae(t4) && t4.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag.maximum ?? Infinity;
    t3.maximum < n4 && (e3._zod.bag.maximum = t3.maximum);
  }), e2._zod.check = (n4) => {
    let r2 = n4.value;
    if (r2.length <= t3.maximum) return;
    let i4 = Se(r2);
    n4.issues.push({
      origin: i4,
      code: "too_big",
      maximum: t3.maximum,
      inclusive: true,
      input: r2,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var pt = /* @__PURE__ */ h("$ZodCheckMinLength", (e2, t3) => {
  var n3;
  L.init(e2, t3), (n3 = e2._zod.def).when ?? (n3.when = (e3) => {
    let t4 = e3.value;
    return !ae(t4) && t4.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag.minimum ?? -Infinity;
    t3.minimum > n4 && (e3._zod.bag.minimum = t3.minimum);
  }), e2._zod.check = (n4) => {
    let r2 = n4.value;
    if (r2.length >= t3.minimum) return;
    let i4 = Se(r2);
    n4.issues.push({
      origin: i4,
      code: "too_small",
      minimum: t3.minimum,
      inclusive: true,
      input: r2,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var mt = /* @__PURE__ */ h("$ZodCheckLengthEquals", (e2, t3) => {
  var n3;
  L.init(e2, t3), (n3 = e2._zod.def).when ?? (n3.when = (e3) => {
    let t4 = e3.value;
    return !ae(t4) && t4.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag;
    n4.minimum = t3.length, n4.maximum = t3.length, n4.length = t3.length;
  }), e2._zod.check = (n4) => {
    let r2 = n4.value, i4 = r2.length;
    if (i4 === t3.length) return;
    let a3 = Se(r2), o3 = i4 > t3.length;
    n4.issues.push({
      origin: a3,
      ...o3 ? {
        code: "too_big",
        maximum: t3.length
      } : {
        code: "too_small",
        minimum: t3.length
      },
      inclusive: true,
      exact: true,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var R = /* @__PURE__ */ h("$ZodCheckStringFormat", (e2, t3) => {
  var n3, r2;
  L.init(e2, t3), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag;
    n4.format = t3.format, t3.pattern && (n4.patterns ??= /* @__PURE__ */ new Set(), n4.patterns.add(t3.pattern));
  }), t3.pattern ? (n3 = e2._zod).check ?? (n3.check = (n4) => {
    t3.pattern.lastIndex = 0, !t3.pattern.test(n4.value) && n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t3.format,
      input: n4.value,
      ...t3.pattern ? { pattern: t3.pattern.toString() } : {},
      inst: e2,
      continue: !t3.abort
    });
  }) : (r2 = e2._zod).check ?? (r2.check = () => {
  });
});
var ht = /* @__PURE__ */ h("$ZodCheckRegex", (e2, t3) => {
  R.init(e2, t3), e2._zod.check = (n3) => {
    t3.pattern.lastIndex = 0, !t3.pattern.test(n3.value) && n3.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n3.value,
      pattern: t3.pattern.toString(),
      inst: e2,
      continue: !t3.abort
    });
  };
});
var gt = /* @__PURE__ */ h("$ZodCheckLowerCase", (e2, t3) => {
  t3.pattern ??= ut, R.init(e2, t3);
});
var _t = /* @__PURE__ */ h("$ZodCheckUpperCase", (e2, t3) => {
  t3.pattern ??= dt, R.init(e2, t3);
});
var vt = /* @__PURE__ */ h("$ZodCheckIncludes", (e2, t3) => {
  L.init(e2, t3);
  let n3 = E(t3.includes), r2 = new RegExp(typeof t3.position == "number" ? `^.{${t3.position}}${n3}` : n3);
  t3.pattern = r2, e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.patterns ??= /* @__PURE__ */ new Set(), t4.patterns.add(r2);
  }), e2._zod.check = (n4) => {
    n4.value.includes(t3.includes, t3.position) || n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t3.includes,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var yt = /* @__PURE__ */ h("$ZodCheckStartsWith", (e2, t3) => {
  L.init(e2, t3);
  let n3 = RegExp(`^${E(t3.prefix)}.*`);
  t3.pattern ??= n3, e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.patterns ??= /* @__PURE__ */ new Set(), t4.patterns.add(n3);
  }), e2._zod.check = (n4) => {
    n4.value.startsWith(t3.prefix) || n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: t3.prefix,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var bt = /* @__PURE__ */ h("$ZodCheckEndsWith", (e2, t3) => {
  L.init(e2, t3);
  let n3 = RegExp(`.*${E(t3.suffix)}$`);
  t3.pattern ??= n3, e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.patterns ??= /* @__PURE__ */ new Set(), t4.patterns.add(n3);
  }), e2._zod.check = (n4) => {
    n4.value.endsWith(t3.suffix) || n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: t3.suffix,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var xt = /* @__PURE__ */ h("$ZodCheckOverwrite", (e2, t3) => {
  L.init(e2, t3), e2._zod.check = (e3) => {
    e3.value = t3.tx(e3.value);
  };
});
var St = class {
  constructor(e2 = []) {
    this.content = [], this.indent = 0, this && (this.args = e2);
  }
  indented(e2) {
    this.indent += 1, e2(this), --this.indent;
  }
  write(e2) {
    if (typeof e2 == "function") {
      e2(this, { execution: "sync" }), e2(this, { execution: "async" });
      return;
    }
    let t3 = e2.split("\n").filter((e3) => e3), n3 = Math.min(...t3.map((e3) => e3.length - e3.trimStart().length)), r2 = t3.map((e3) => e3.slice(n3)).map((e3) => " ".repeat(this.indent * 2) + e3);
    for (let e3 of r2) this.content.push(e3);
  }
  compile() {
    let e2 = Function, t3 = this?.args, n3 = [...(this?.content ?? [""]).map((e3) => `  ${e3}`)];
    return new e2(...t3, n3.join("\n"));
  }
};
var Ct = {
  major: 4,
  minor: 1,
  patch: 11
};
var z = /* @__PURE__ */ h("$ZodType", (e2, t3) => {
  var n3;
  e2 ??= {}, e2._zod.def = t3, e2._zod.bag = e2._zod.bag || {}, e2._zod.version = Ct;
  let r2 = [...e2._zod.def.checks ?? []];
  e2._zod.traits.has("$ZodCheck") && r2.unshift(e2);
  for (let t4 of r2) for (let n4 of t4._zod.onattach) n4(e2);
  if (r2.length === 0) (n3 = e2._zod).deferred ?? (n3.deferred = []), e2._zod.deferred?.push(() => {
    e2._zod.run = e2._zod.parse;
  });
  else {
    let t4 = (e3, t5, n5) => {
      let r3 = k(e3), i4;
      for (let a3 of t5) {
        if (a3._zod.def.when) {
          if (!a3._zod.def.when(e3)) continue;
        } else if (r3) continue;
        let t6 = e3.issues.length, o3 = a3._zod.check(e3);
        if (o3 instanceof Promise && n5?.async === false) throw new g();
        if (i4 || o3 instanceof Promise) i4 = (i4 ?? Promise.resolve()).then(async () => {
          await o3, e3.issues.length !== t6 && (r3 ||= k(e3, t6));
        });
        else {
          if (e3.issues.length === t6) continue;
          r3 ||= k(e3, t6);
        }
      }
      return i4 ? i4.then(() => e3) : e3;
    }, n4 = (n5, i4, a3) => {
      if (k(n5)) return n5.aborted = true, n5;
      let o3 = t4(i4, r2, a3);
      if (o3 instanceof Promise) {
        if (a3.async === false) throw new g();
        return o3.then((t5) => e2._zod.parse(t5, a3));
      }
      return e2._zod.parse(o3, a3);
    };
    e2._zod.run = (i4, a3) => {
      if (a3.skipChecks) return e2._zod.parse(i4, a3);
      if (a3.direction === "backward") {
        let t5 = e2._zod.parse({
          value: i4.value,
          issues: []
        }, {
          ...a3,
          skipChecks: true
        });
        return t5 instanceof Promise ? t5.then((e3) => n4(e3, i4, a3)) : n4(t5, i4, a3);
      }
      let o3 = e2._zod.parse(i4, a3);
      if (o3 instanceof Promise) {
        if (a3.async === false) throw new g();
        return o3.then((e3) => t4(e3, r2, a3));
      }
      return t4(o3, r2, a3);
    };
  }
  e2["~standard"] = {
    validate: (t4) => {
      try {
        let n4 = Oe(e2, t4);
        return n4.success ? { value: n4.data } : { issues: n4.error?.issues };
      } catch {
        return ke(e2, t4).then((e3) => e3.success ? { value: e3.data } : { issues: e3.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  };
});
var B = /* @__PURE__ */ h("$ZodString", (e2, t3) => {
  z.init(e2, t3), e2._zod.pattern = [...e2?._zod.bag?.patterns ?? []].pop() ?? lt(e2._zod.bag), e2._zod.parse = (n3, r2) => {
    if (t3.coerce) try {
      n3.value = String(n3.value);
    } catch {
    }
    return typeof n3.value == "string" || n3.issues.push({
      expected: "string",
      code: "invalid_type",
      input: n3.value,
      inst: e2
    }), n3;
  };
});
var V = /* @__PURE__ */ h("$ZodStringFormat", (e2, t3) => {
  R.init(e2, t3), B.init(e2, t3);
});
var wt = /* @__PURE__ */ h("$ZodGUID", (e2, t3) => {
  t3.pattern ??= Ge, V.init(e2, t3);
});
var Tt = /* @__PURE__ */ h("$ZodUUID", (e2, t3) => {
  if (t3.version) {
    let e3 = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[t3.version];
    if (e3 === void 0) throw Error(`Invalid UUID version: "${t3.version}"`);
    t3.pattern ??= Ke(e3);
  } else t3.pattern ??= Ke();
  V.init(e2, t3);
});
var Et = /* @__PURE__ */ h("$ZodEmail", (e2, t3) => {
  t3.pattern ??= qe, V.init(e2, t3);
});
var Dt = /* @__PURE__ */ h("$ZodURL", (e2, t3) => {
  V.init(e2, t3), e2._zod.check = (n3) => {
    try {
      let r2 = n3.value.trim(), i4 = new URL(r2);
      t3.hostname && (t3.hostname.lastIndex = 0, t3.hostname.test(i4.hostname) || n3.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: nt.source,
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      })), t3.protocol && (t3.protocol.lastIndex = 0, t3.protocol.test(i4.protocol.endsWith(":") ? i4.protocol.slice(0, -1) : i4.protocol) || n3.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t3.protocol.source,
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      })), t3.normalize ? n3.value = i4.href : n3.value = r2;
      return;
    } catch {
      n3.issues.push({
        code: "invalid_format",
        format: "url",
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      });
    }
  };
});
var Ot = /* @__PURE__ */ h("$ZodEmoji", (e2, t3) => {
  t3.pattern ??= Ye(), V.init(e2, t3);
});
var kt = /* @__PURE__ */ h("$ZodNanoID", (e2, t3) => {
  t3.pattern ??= Ue, V.init(e2, t3);
});
var At = /* @__PURE__ */ h("$ZodCUID", (e2, t3) => {
  t3.pattern ??= Re, V.init(e2, t3);
});
var jt = /* @__PURE__ */ h("$ZodCUID2", (e2, t3) => {
  t3.pattern ??= ze, V.init(e2, t3);
});
var Mt = /* @__PURE__ */ h("$ZodULID", (e2, t3) => {
  t3.pattern ??= Be, V.init(e2, t3);
});
var Nt = /* @__PURE__ */ h("$ZodXID", (e2, t3) => {
  t3.pattern ??= Ve, V.init(e2, t3);
});
var Pt = /* @__PURE__ */ h("$ZodKSUID", (e2, t3) => {
  t3.pattern ??= He, V.init(e2, t3);
});
var Ft = /* @__PURE__ */ h("$ZodISODateTime", (e2, t3) => {
  t3.pattern ??= ct(t3), V.init(e2, t3);
});
var It = /* @__PURE__ */ h("$ZodISODate", (e2, t3) => {
  t3.pattern ??= at, V.init(e2, t3);
});
var Lt = /* @__PURE__ */ h("$ZodISOTime", (e2, t3) => {
  t3.pattern ??= st(t3), V.init(e2, t3);
});
var Rt = /* @__PURE__ */ h("$ZodISODuration", (e2, t3) => {
  t3.pattern ??= We, V.init(e2, t3);
});
var zt = /* @__PURE__ */ h("$ZodIPv4", (e2, t3) => {
  t3.pattern ??= Xe, V.init(e2, t3), e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.format = "ipv4";
  });
});
var Bt = /* @__PURE__ */ h("$ZodIPv6", (e2, t3) => {
  t3.pattern ??= Ze, V.init(e2, t3), e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.format = "ipv6";
  }), e2._zod.check = (n3) => {
    try {
      new URL(`http://[${n3.value}]`);
    } catch {
      n3.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      });
    }
  };
});
var Vt = /* @__PURE__ */ h("$ZodCIDRv4", (e2, t3) => {
  t3.pattern ??= Qe, V.init(e2, t3);
});
var Ht = /* @__PURE__ */ h("$ZodCIDRv6", (e2, t3) => {
  t3.pattern ??= $e, V.init(e2, t3), e2._zod.check = (n3) => {
    let r2 = n3.value.split("/");
    try {
      if (r2.length !== 2) throw Error();
      let [e3, t4] = r2;
      if (!t4) throw Error();
      let n4 = Number(t4);
      if (`${n4}` !== t4 || n4 < 0 || n4 > 128) throw Error();
      new URL(`http://[${e3}]`);
    } catch {
      n3.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      });
    }
  };
});
function Ut(e2) {
  if (e2 === "") return true;
  if (e2.length % 4 != 0) return false;
  try {
    return atob(e2), true;
  } catch {
    return false;
  }
}
var Wt = /* @__PURE__ */ h("$ZodBase64", (e2, t3) => {
  t3.pattern ??= et, V.init(e2, t3), e2._zod.onattach.push((e3) => {
    e3._zod.bag.contentEncoding = "base64";
  }), e2._zod.check = (n3) => {
    Ut(n3.value) || n3.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n3.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
function Gt(e2) {
  if (!tt.test(e2)) return false;
  let t3 = e2.replace(/[-_]/g, (e3) => e3 === "-" ? "+" : "/");
  return Ut(t3.padEnd(Math.ceil(t3.length / 4) * 4, "="));
}
var Kt = /* @__PURE__ */ h("$ZodBase64URL", (e2, t3) => {
  t3.pattern ??= tt, V.init(e2, t3), e2._zod.onattach.push((e3) => {
    e3._zod.bag.contentEncoding = "base64url";
  }), e2._zod.check = (n3) => {
    Gt(n3.value) || n3.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n3.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var qt = /* @__PURE__ */ h("$ZodE164", (e2, t3) => {
  t3.pattern ??= rt, V.init(e2, t3);
});
function Jt(e2, t3 = null) {
  try {
    let n3 = e2.split(".");
    if (n3.length !== 3) return false;
    let [r2] = n3;
    if (!r2) return false;
    let i4 = JSON.parse(atob(r2));
    return !("typ" in i4 && i4?.typ !== "JWT" || !i4.alg || t3 && (!("alg" in i4) || i4.alg !== t3));
  } catch {
    return false;
  }
}
var Yt = /* @__PURE__ */ h("$ZodJWT", (e2, t3) => {
  V.init(e2, t3), e2._zod.check = (n3) => {
    Jt(n3.value, t3.alg) || n3.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n3.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var Xt = /* @__PURE__ */ h("$ZodUnknown", (e2, t3) => {
  z.init(e2, t3), e2._zod.parse = (e3) => e3;
});
var Zt = /* @__PURE__ */ h("$ZodNever", (e2, t3) => {
  z.init(e2, t3), e2._zod.parse = (t4, n3) => (t4.issues.push({
    expected: "never",
    code: "invalid_type",
    input: t4.value,
    inst: e2
  }), t4);
});
function Qt(e2, t3, n3) {
  e2.issues.length && t3.issues.push(...xe(n3, e2.issues)), t3.value[n3] = e2.value;
}
var $t = /* @__PURE__ */ h("$ZodArray", (e2, t3) => {
  z.init(e2, t3), e2._zod.parse = (n3, r2) => {
    let i4 = n3.value;
    if (!Array.isArray(i4)) return n3.issues.push({
      expected: "array",
      code: "invalid_type",
      input: i4,
      inst: e2
    }), n3;
    n3.value = Array(i4.length);
    let a3 = [];
    for (let e3 = 0; e3 < i4.length; e3++) {
      let o3 = i4[e3], s3 = t3.element._zod.run({
        value: o3,
        issues: []
      }, r2);
      s3 instanceof Promise ? a3.push(s3.then((t4) => Qt(t4, n3, e3))) : Qt(s3, n3, e3);
    }
    return a3.length ? Promise.all(a3).then(() => n3) : n3;
  };
});
function H(e2, t3, n3, r2) {
  e2.issues.length && t3.issues.push(...xe(n3, e2.issues)), e2.value === void 0 ? n3 in r2 && (t3.value[n3] = void 0) : t3.value[n3] = e2.value;
}
function en(e2) {
  let t3 = Object.keys(e2.shape);
  for (let n4 of t3) if (!e2.shape?.[n4]?._zod?.traits?.has("$ZodType")) throw Error(`Invalid element at key "${n4}": expected a Zod schema`);
  let n3 = pe(e2.shape);
  return {
    ...e2,
    keys: t3,
    keySet: new Set(t3),
    numKeys: t3.length,
    optionalKeys: new Set(n3)
  };
}
function tn(e2, t3, n3, r2, i4, a3) {
  let o3 = [], s3 = i4.keySet, c3 = i4.catchall._zod, l4 = c3.def.type;
  for (let i5 of Object.keys(t3)) {
    if (s3.has(i5)) continue;
    if (l4 === "never") {
      o3.push(i5);
      continue;
    }
    let a4 = c3.run({
      value: t3[i5],
      issues: []
    }, r2);
    a4 instanceof Promise ? e2.push(a4.then((e3) => H(e3, n3, i5, t3))) : H(a4, n3, i5, t3);
  }
  return o3.length && n3.issues.push({
    code: "unrecognized_keys",
    keys: o3,
    input: t3,
    inst: a3
  }), e2.length ? Promise.all(e2).then(() => n3) : n3;
}
var nn = /* @__PURE__ */ h("$ZodObject", (e2, t3) => {
  if (z.init(e2, t3), !Object.getOwnPropertyDescriptor(t3, "shape")?.get) {
    let e3 = t3.shape;
    Object.defineProperty(t3, "shape", { get: () => {
      let n4 = { ...e3 };
      return Object.defineProperty(t3, "shape", { value: n4 }), n4;
    } });
  }
  let n3 = b(() => en(t3));
  x(e2._zod, "propValues", () => {
    let e3 = t3.shape, n4 = {};
    for (let t4 in e3) {
      let r3 = e3[t4]._zod;
      if (r3.values) {
        n4[t4] ?? (n4[t4] = /* @__PURE__ */ new Set());
        for (let e4 of r3.values) n4[t4].add(e4);
      }
    }
    return n4;
  });
  let r2 = w, i4 = t3.catchall, a3;
  e2._zod.parse = (t4, o3) => {
    a3 ??= n3.value;
    let s3 = t4.value;
    if (!r2(s3)) return t4.issues.push({
      expected: "object",
      code: "invalid_type",
      input: s3,
      inst: e2
    }), t4;
    t4.value = {};
    let c3 = [], l4 = a3.shape;
    for (let e3 of a3.keys) {
      let n4 = l4[e3]._zod.run({
        value: s3[e3],
        issues: []
      }, o3);
      n4 instanceof Promise ? c3.push(n4.then((n5) => H(n5, t4, e3, s3))) : H(n4, t4, e3, s3);
    }
    return i4 ? tn(c3, s3, t4, o3, n3.value, e2) : c3.length ? Promise.all(c3).then(() => t4) : t4;
  };
});
var rn = /* @__PURE__ */ h("$ZodObjectJIT", (e2, t3) => {
  nn.init(e2, t3);
  let n3 = e2._zod.parse, r2 = b(() => en(t3)), i4 = (e3) => {
    let t4 = new St([
      "shape",
      "payload",
      "ctx"
    ]), n4 = r2.value, i5 = (e4) => {
      let t5 = ce(e4);
      return `shape[${t5}]._zod.run({ value: input[${t5}], issues: [] }, ctx)`;
    };
    t4.write("const input = payload.value;");
    let a4 = /* @__PURE__ */ Object.create(null), o4 = 0;
    for (let e4 of n4.keys) a4[e4] = `key_${o4++}`;
    t4.write("const newResult = {};");
    for (let e4 of n4.keys) {
      let n5 = a4[e4], r3 = ce(e4);
      t4.write(`const ${n5} = ${i5(e4)};`), t4.write(`
        if (${n5}.issues.length) {
          payload.issues = payload.issues.concat(${n5}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${r3}, ...iss.path] : [${r3}]
          })));
        }
        
        
        if (${n5}.value === undefined) {
          if (${r3} in input) {
            newResult[${r3}] = undefined;
          }
        } else {
          newResult[${r3}] = ${n5}.value;
        }
        
      `);
    }
    t4.write("payload.value = newResult;"), t4.write("return payload;");
    let s4 = t4.compile();
    return (t5, n5) => s4(e3, t5, n5);
  }, a3, o3 = w, s3 = !_.jitless, c3 = s3 && ue.value, l4 = t3.catchall, u4;
  e2._zod.parse = (d2, f2) => {
    u4 ??= r2.value;
    let p2 = d2.value;
    return o3(p2) ? s3 && c3 && f2?.async === false && f2.jitless !== true ? (a3 ||= i4(t3.shape), d2 = a3(d2, f2), l4 ? tn([], p2, d2, f2, u4, e2) : d2) : n3(d2, f2) : (d2.issues.push({
      expected: "object",
      code: "invalid_type",
      input: p2,
      inst: e2
    }), d2);
  };
});
function an(e2, t3, n3, r2) {
  for (let n4 of e2) if (n4.issues.length === 0) return t3.value = n4.value, t3;
  let i4 = e2.filter((e3) => !k(e3));
  return i4.length === 1 ? (t3.value = i4[0].value, i4[0]) : (t3.issues.push({
    code: "invalid_union",
    input: t3.value,
    inst: n3,
    errors: e2.map((e3) => e3.issues.map((e4) => j(e4, r2, v())))
  }), t3);
}
var on = /* @__PURE__ */ h("$ZodUnion", (e2, t3) => {
  z.init(e2, t3), x(e2._zod, "optin", () => t3.options.some((e3) => e3._zod.optin === "optional") ? "optional" : void 0), x(e2._zod, "optout", () => t3.options.some((e3) => e3._zod.optout === "optional") ? "optional" : void 0), x(e2._zod, "values", () => {
    if (t3.options.every((e3) => e3._zod.values)) return new Set(t3.options.flatMap((e3) => Array.from(e3._zod.values)));
  }), x(e2._zod, "pattern", () => {
    if (t3.options.every((e3) => e3._zod.pattern)) {
      let e3 = t3.options.map((e4) => e4._zod.pattern);
      return RegExp(`^(${e3.map((e4) => oe(e4.source)).join("|")})$`);
    }
  });
  let n3 = t3.options.length === 1, r2 = t3.options[0]._zod.run;
  e2._zod.parse = (i4, a3) => {
    if (n3) return r2(i4, a3);
    let o3 = false, s3 = [];
    for (let e3 of t3.options) {
      let t4 = e3._zod.run({
        value: i4.value,
        issues: []
      }, a3);
      if (t4 instanceof Promise) s3.push(t4), o3 = true;
      else {
        if (t4.issues.length === 0) return t4;
        s3.push(t4);
      }
    }
    return o3 ? Promise.all(s3).then((t4) => an(t4, i4, e2, a3)) : an(s3, i4, e2, a3);
  };
});
var sn = /* @__PURE__ */ h("$ZodIntersection", (e2, t3) => {
  z.init(e2, t3), e2._zod.parse = (e3, n3) => {
    let r2 = e3.value, i4 = t3.left._zod.run({
      value: r2,
      issues: []
    }, n3), a3 = t3.right._zod.run({
      value: r2,
      issues: []
    }, n3);
    return i4 instanceof Promise || a3 instanceof Promise ? Promise.all([i4, a3]).then(([t4, n4]) => cn(e3, t4, n4)) : cn(e3, i4, a3);
  };
});
function U(e2, t3) {
  if (e2 === t3 || e2 instanceof Date && t3 instanceof Date && +e2 == +t3) return {
    valid: true,
    data: e2
  };
  if (T(e2) && T(t3)) {
    let n3 = Object.keys(t3), r2 = Object.keys(e2).filter((e3) => n3.indexOf(e3) !== -1), i4 = {
      ...e2,
      ...t3
    };
    for (let n4 of r2) {
      let r3 = U(e2[n4], t3[n4]);
      if (!r3.valid) return {
        valid: false,
        mergeErrorPath: [n4, ...r3.mergeErrorPath]
      };
      i4[n4] = r3.data;
    }
    return {
      valid: true,
      data: i4
    };
  }
  if (Array.isArray(e2) && Array.isArray(t3)) {
    if (e2.length !== t3.length) return {
      valid: false,
      mergeErrorPath: []
    };
    let n3 = [];
    for (let r2 = 0; r2 < e2.length; r2++) {
      let i4 = e2[r2], a3 = t3[r2], o3 = U(i4, a3);
      if (!o3.valid) return {
        valid: false,
        mergeErrorPath: [r2, ...o3.mergeErrorPath]
      };
      n3.push(o3.data);
    }
    return {
      valid: true,
      data: n3
    };
  }
  return {
    valid: false,
    mergeErrorPath: []
  };
}
function cn(e2, t3, n3) {
  if (t3.issues.length && e2.issues.push(...t3.issues), n3.issues.length && e2.issues.push(...n3.issues), k(e2)) return e2;
  let r2 = U(t3.value, n3.value);
  if (!r2.valid) throw Error(`Unmergable intersection. Error path: ${JSON.stringify(r2.mergeErrorPath)}`);
  return e2.value = r2.data, e2;
}
var ln = /* @__PURE__ */ h("$ZodEnum", (e2, t3) => {
  z.init(e2, t3);
  let n3 = ie(t3.entries), r2 = new Set(n3);
  e2._zod.values = r2, e2._zod.pattern = RegExp(`^(${n3.filter((e3) => fe.has(typeof e3)).map((e3) => typeof e3 == "string" ? E(e3) : e3.toString()).join("|")})$`), e2._zod.parse = (t4, i4) => {
    let a3 = t4.value;
    return r2.has(a3) || t4.issues.push({
      code: "invalid_value",
      values: n3,
      input: a3,
      inst: e2
    }), t4;
  };
});
var un = /* @__PURE__ */ h("$ZodTransform", (e2, t3) => {
  z.init(e2, t3), e2._zod.parse = (n3, r2) => {
    if (r2.direction === "backward") throw new re(e2.constructor.name);
    let i4 = t3.transform(n3.value, n3);
    if (r2.async) return (i4 instanceof Promise ? i4 : Promise.resolve(i4)).then((e3) => (n3.value = e3, n3));
    if (i4 instanceof Promise) throw new g();
    return n3.value = i4, n3;
  };
});
function dn(e2, t3) {
  return e2.issues.length && t3 === void 0 ? {
    issues: [],
    value: void 0
  } : e2;
}
var fn = /* @__PURE__ */ h("$ZodOptional", (e2, t3) => {
  z.init(e2, t3), e2._zod.optin = "optional", e2._zod.optout = "optional", x(e2._zod, "values", () => t3.innerType._zod.values ? /* @__PURE__ */ new Set([...t3.innerType._zod.values, void 0]) : void 0), x(e2._zod, "pattern", () => {
    let e3 = t3.innerType._zod.pattern;
    return e3 ? RegExp(`^(${oe(e3.source)})?$`) : void 0;
  }), e2._zod.parse = (e3, n3) => {
    if (t3.innerType._zod.optin === "optional") {
      let r2 = t3.innerType._zod.run(e3, n3);
      return r2 instanceof Promise ? r2.then((t4) => dn(t4, e3.value)) : dn(r2, e3.value);
    }
    return e3.value === void 0 ? e3 : t3.innerType._zod.run(e3, n3);
  };
});
var pn = /* @__PURE__ */ h("$ZodNullable", (e2, t3) => {
  z.init(e2, t3), x(e2._zod, "optin", () => t3.innerType._zod.optin), x(e2._zod, "optout", () => t3.innerType._zod.optout), x(e2._zod, "pattern", () => {
    let e3 = t3.innerType._zod.pattern;
    return e3 ? RegExp(`^(${oe(e3.source)}|null)$`) : void 0;
  }), x(e2._zod, "values", () => t3.innerType._zod.values ? /* @__PURE__ */ new Set([...t3.innerType._zod.values, null]) : void 0), e2._zod.parse = (e3, n3) => e3.value === null ? e3 : t3.innerType._zod.run(e3, n3);
});
var mn = /* @__PURE__ */ h("$ZodDefault", (e2, t3) => {
  z.init(e2, t3), e2._zod.optin = "optional", x(e2._zod, "values", () => t3.innerType._zod.values), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") return t3.innerType._zod.run(e3, n3);
    if (e3.value === void 0) return e3.value = t3.defaultValue, e3;
    let r2 = t3.innerType._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then((e4) => hn(e4, t3)) : hn(r2, t3);
  };
});
function hn(e2, t3) {
  return e2.value === void 0 && (e2.value = t3.defaultValue), e2;
}
var gn = /* @__PURE__ */ h("$ZodPrefault", (e2, t3) => {
  z.init(e2, t3), e2._zod.optin = "optional", x(e2._zod, "values", () => t3.innerType._zod.values), e2._zod.parse = (e3, n3) => (n3.direction === "backward" || e3.value === void 0 && (e3.value = t3.defaultValue), t3.innerType._zod.run(e3, n3));
});
var _n = /* @__PURE__ */ h("$ZodNonOptional", (e2, t3) => {
  z.init(e2, t3), x(e2._zod, "values", () => {
    let e3 = t3.innerType._zod.values;
    return e3 ? new Set([...e3].filter((e4) => e4 !== void 0)) : void 0;
  }), e2._zod.parse = (n3, r2) => {
    let i4 = t3.innerType._zod.run(n3, r2);
    return i4 instanceof Promise ? i4.then((t4) => vn(t4, e2)) : vn(i4, e2);
  };
});
function vn(e2, t3) {
  return !e2.issues.length && e2.value === void 0 && e2.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e2.value,
    inst: t3
  }), e2;
}
var yn = /* @__PURE__ */ h("$ZodCatch", (e2, t3) => {
  z.init(e2, t3), x(e2._zod, "optin", () => t3.innerType._zod.optin), x(e2._zod, "optout", () => t3.innerType._zod.optout), x(e2._zod, "values", () => t3.innerType._zod.values), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") return t3.innerType._zod.run(e3, n3);
    let r2 = t3.innerType._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then((r3) => (e3.value = r3.value, r3.issues.length && (e3.value = t3.catchValue({
      ...e3,
      error: { issues: r3.issues.map((e4) => j(e4, n3, v())) },
      input: e3.value
    }), e3.issues = []), e3)) : (e3.value = r2.value, r2.issues.length && (e3.value = t3.catchValue({
      ...e3,
      error: { issues: r2.issues.map((e4) => j(e4, n3, v())) },
      input: e3.value
    }), e3.issues = []), e3);
  };
});
var bn = /* @__PURE__ */ h("$ZodPipe", (e2, t3) => {
  z.init(e2, t3), x(e2._zod, "values", () => t3.in._zod.values), x(e2._zod, "optin", () => t3.in._zod.optin), x(e2._zod, "optout", () => t3.out._zod.optout), x(e2._zod, "propValues", () => t3.in._zod.propValues), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") {
      let r3 = t3.out._zod.run(e3, n3);
      return r3 instanceof Promise ? r3.then((e4) => W(e4, t3.in, n3)) : W(r3, t3.in, n3);
    }
    let r2 = t3.in._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then((e4) => W(e4, t3.out, n3)) : W(r2, t3.out, n3);
  };
});
function W(e2, t3, n3) {
  return e2.issues.length ? (e2.aborted = true, e2) : t3._zod.run({
    value: e2.value,
    issues: e2.issues
  }, n3);
}
var xn = /* @__PURE__ */ h("$ZodReadonly", (e2, t3) => {
  z.init(e2, t3), x(e2._zod, "propValues", () => t3.innerType._zod.propValues), x(e2._zod, "values", () => t3.innerType._zod.values), x(e2._zod, "optin", () => t3.innerType._zod.optin), x(e2._zod, "optout", () => t3.innerType._zod.optout), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") return t3.innerType._zod.run(e3, n3);
    let r2 = t3.innerType._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then(Sn) : Sn(r2);
  };
});
function Sn(e2) {
  return e2.value = Object.freeze(e2.value), e2;
}
var Cn = /* @__PURE__ */ h("$ZodCustom", (e2, t3) => {
  L.init(e2, t3), z.init(e2, t3), e2._zod.parse = (e3, t4) => e3, e2._zod.check = (n3) => {
    let r2 = n3.value, i4 = t3.fn(r2);
    if (i4 instanceof Promise) return i4.then((t4) => wn(t4, n3, r2, e2));
    wn(i4, n3, r2, e2);
  };
});
function wn(e2, t3, n3, r2) {
  if (!e2) {
    let e3 = {
      code: "custom",
      input: n3,
      inst: r2,
      path: [...r2._zod.def.path ?? []],
      continue: !r2._zod.def.abort
    };
    r2._zod.def.params && (e3.params = r2._zod.def.params), t3.issues.push(M(e3));
  }
}
var Tn = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(e2, ...t3) {
    let n3 = t3[0];
    if (this._map.set(e2, n3), n3 && typeof n3 == "object" && "id" in n3) {
      if (this._idmap.has(n3.id)) throw Error(`ID ${n3.id} already exists in the registry`);
      this._idmap.set(n3.id, e2);
    }
    return this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(e2) {
    let t3 = this._map.get(e2);
    return t3 && typeof t3 == "object" && "id" in t3 && this._idmap.delete(t3.id), this._map.delete(e2), this;
  }
  get(e2) {
    let t3 = e2._zod.parent;
    if (t3) {
      let n3 = { ...this.get(t3) ?? {} };
      delete n3.id;
      let r2 = {
        ...n3,
        ...this._map.get(e2)
      };
      return Object.keys(r2).length ? r2 : void 0;
    }
    return this._map.get(e2);
  }
  has(e2) {
    return this._map.has(e2);
  }
};
function En() {
  return new Tn();
}
var G = /* @__PURE__ */ En();
function Dn(e2, t3) {
  return new e2({
    type: "string",
    ...O(t3)
  });
}
function On(e2, t3) {
  return new e2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function kn(e2, t3) {
  return new e2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function An(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function jn(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...O(t3)
  });
}
function Mn(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...O(t3)
  });
}
function Nn(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...O(t3)
  });
}
function Pn(e2, t3) {
  return new e2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Fn(e2, t3) {
  return new e2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function In(e2, t3) {
  return new e2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Ln(e2, t3) {
  return new e2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Rn(e2, t3) {
  return new e2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function zn(e2, t3) {
  return new e2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Bn(e2, t3) {
  return new e2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Vn(e2, t3) {
  return new e2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Hn(e2, t3) {
  return new e2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Un(e2, t3) {
  return new e2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Wn(e2, t3) {
  return new e2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Gn(e2, t3) {
  return new e2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Kn(e2, t3) {
  return new e2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function qn(e2, t3) {
  return new e2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Jn(e2, t3) {
  return new e2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Yn(e2, t3) {
  return new e2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...O(t3)
  });
}
function Xn(e2, t3) {
  return new e2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...O(t3)
  });
}
function Zn(e2, t3) {
  return new e2({
    type: "string",
    format: "date",
    check: "string_format",
    ...O(t3)
  });
}
function Qn(e2, t3) {
  return new e2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...O(t3)
  });
}
function $n(e2, t3) {
  return new e2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...O(t3)
  });
}
function er(e2) {
  return new e2({ type: "unknown" });
}
function tr(e2, t3) {
  return new e2({
    type: "never",
    ...O(t3)
  });
}
function nr(e2, t3) {
  return new ft({
    check: "max_length",
    ...O(t3),
    maximum: e2
  });
}
function K(e2, t3) {
  return new pt({
    check: "min_length",
    ...O(t3),
    minimum: e2
  });
}
function rr(e2, t3) {
  return new mt({
    check: "length_equals",
    ...O(t3),
    length: e2
  });
}
function ir(e2, t3) {
  return new ht({
    check: "string_format",
    format: "regex",
    ...O(t3),
    pattern: e2
  });
}
function ar(e2) {
  return new gt({
    check: "string_format",
    format: "lowercase",
    ...O(e2)
  });
}
function or(e2) {
  return new _t({
    check: "string_format",
    format: "uppercase",
    ...O(e2)
  });
}
function sr(e2, t3) {
  return new vt({
    check: "string_format",
    format: "includes",
    ...O(t3),
    includes: e2
  });
}
function cr(e2, t3) {
  return new yt({
    check: "string_format",
    format: "starts_with",
    ...O(t3),
    prefix: e2
  });
}
function lr(e2, t3) {
  return new bt({
    check: "string_format",
    format: "ends_with",
    ...O(t3),
    suffix: e2
  });
}
function q(e2) {
  return new xt({
    check: "overwrite",
    tx: e2
  });
}
function ur(e2) {
  return q((t3) => t3.normalize(e2));
}
function dr() {
  return q((e2) => e2.trim());
}
function fr() {
  return q((e2) => e2.toLowerCase());
}
function pr() {
  return q((e2) => e2.toUpperCase());
}
function mr(e2, t3, n3) {
  return new e2({
    type: "array",
    element: t3,
    ...O(n3)
  });
}
function hr(e2, t3, n3) {
  return new e2({
    type: "custom",
    check: "custom",
    fn: t3,
    ...O(n3)
  });
}
function gr(e2) {
  let t3 = _r((n3) => (n3.addIssue = (e3) => {
    if (typeof e3 == "string") n3.issues.push(M(e3, n3.value, t3._zod.def));
    else {
      let r2 = e3;
      r2.fatal && (r2.continue = false), r2.code ??= "custom", r2.input ??= n3.value, r2.inst ??= t3, r2.continue ??= !t3._zod.def.abort, n3.issues.push(M(r2));
    }
  }, e2(n3.value, n3)));
  return t3;
}
function _r(e2, t3) {
  let n3 = new L({
    check: "custom",
    ...O(t3)
  });
  return n3._zod.check = e2, n3;
}
var vr = /* @__PURE__ */ h("ZodISODateTime", (e2, t3) => {
  Ft.init(e2, t3), X.init(e2, t3);
});
function yr(e2) {
  return Xn(vr, e2);
}
var br = /* @__PURE__ */ h("ZodISODate", (e2, t3) => {
  It.init(e2, t3), X.init(e2, t3);
});
function xr(e2) {
  return Zn(br, e2);
}
var Sr = /* @__PURE__ */ h("ZodISOTime", (e2, t3) => {
  Lt.init(e2, t3), X.init(e2, t3);
});
function Cr(e2) {
  return Qn(Sr, e2);
}
var wr = /* @__PURE__ */ h("ZodISODuration", (e2, t3) => {
  Rt.init(e2, t3), X.init(e2, t3);
});
function Tr(e2) {
  return $n(wr, e2);
}
var Er = (e2, t3) => {
  we.init(e2, t3), e2.name = "ZodError", Object.defineProperties(e2, {
    format: { value: (t4) => De(e2, t4) },
    flatten: { value: (t4) => Ee(e2, t4) },
    addIssue: { value: (t4) => {
      e2.issues.push(t4), e2.message = JSON.stringify(e2.issues, y, 2);
    } },
    addIssues: { value: (t4) => {
      e2.issues.push(...t4), e2.message = JSON.stringify(e2.issues, y, 2);
    } },
    isEmpty: { get() {
      return e2.issues.length === 0;
    } }
  });
};
h("ZodError", Er);
var J = h("ZodError", Er, { Parent: Error });
var Dr = /* @__PURE__ */ N(J);
var Or = /* @__PURE__ */ P(J);
var kr = /* @__PURE__ */ F(J);
var Ar = /* @__PURE__ */ I(J);
var jr = /* @__PURE__ */ Ae(J);
var Mr = /* @__PURE__ */ je(J);
var Nr = /* @__PURE__ */ Me(J);
var Pr = /* @__PURE__ */ Ne(J);
var Fr = /* @__PURE__ */ Pe(J);
var Ir = /* @__PURE__ */ Fe(J);
var Lr = /* @__PURE__ */ Ie(J);
var Rr = /* @__PURE__ */ Le(J);
var Y = /* @__PURE__ */ h("ZodType", (e2, t3) => (z.init(e2, t3), e2.def = t3, e2.type = t3.type, Object.defineProperty(e2, "_def", { value: t3 }), e2.check = (...n3) => e2.clone(C(t3, { checks: [...t3.checks ?? [], ...n3.map((e3) => typeof e3 == "function" ? { _zod: {
  check: e3,
  def: { check: "custom" },
  onattach: []
} } : e3)] })), e2.clone = (t4, n3) => D(e2, t4, n3), e2.brand = () => e2, e2.register = ((t4, n3) => (t4.add(e2, n3), e2)), e2.parse = (t4, n3) => Dr(e2, t4, n3, { callee: e2.parse }), e2.safeParse = (t4, n3) => kr(e2, t4, n3), e2.parseAsync = async (t4, n3) => Or(e2, t4, n3, { callee: e2.parseAsync }), e2.safeParseAsync = async (t4, n3) => Ar(e2, t4, n3), e2.spa = e2.safeParseAsync, e2.encode = (t4, n3) => jr(e2, t4, n3), e2.decode = (t4, n3) => Mr(e2, t4, n3), e2.encodeAsync = async (t4, n3) => Nr(e2, t4, n3), e2.decodeAsync = async (t4, n3) => Pr(e2, t4, n3), e2.safeEncode = (t4, n3) => Fr(e2, t4, n3), e2.safeDecode = (t4, n3) => Ir(e2, t4, n3), e2.safeEncodeAsync = async (t4, n3) => Lr(e2, t4, n3), e2.safeDecodeAsync = async (t4, n3) => Rr(e2, t4, n3), e2.refine = (t4, n3) => e2.check(zi(t4, n3)), e2.superRefine = (t4) => e2.check(Bi(t4)), e2.overwrite = (t4) => e2.check(q(t4)), e2.optional = () => Ci(e2), e2.nullable = () => Ti(e2), e2.nullish = () => Ci(Ti(e2)), e2.nonoptional = (t4) => ji(e2, t4), e2.array = () => di(e2), e2.or = (t4) => hi([e2, t4]), e2.and = (t4) => _i(e2, t4), e2.transform = (t4) => Fi(e2, xi(t4)), e2.default = (t4) => Di(e2, t4), e2.prefault = (t4) => ki(e2, t4), e2.catch = (t4) => Ni(e2, t4), e2.pipe = (t4) => Fi(e2, t4), e2.readonly = () => Li(e2), e2.describe = (t4) => {
  let n3 = e2.clone();
  return G.add(n3, { description: t4 }), n3;
}, Object.defineProperty(e2, "description", {
  get() {
    return G.get(e2)?.description;
  },
  configurable: true
}), e2.meta = (...t4) => {
  if (t4.length === 0) return G.get(e2);
  let n3 = e2.clone();
  return G.add(n3, t4[0]), n3;
}, e2.isOptional = () => e2.safeParse(void 0).success, e2.isNullable = () => e2.safeParse(null).success, e2));
var zr = /* @__PURE__ */ h("_ZodString", (e2, t3) => {
  B.init(e2, t3), Y.init(e2, t3);
  let n3 = e2._zod.bag;
  e2.format = n3.format ?? null, e2.minLength = n3.minimum ?? null, e2.maxLength = n3.maximum ?? null, e2.regex = (...t4) => e2.check(ir(...t4)), e2.includes = (...t4) => e2.check(sr(...t4)), e2.startsWith = (...t4) => e2.check(cr(...t4)), e2.endsWith = (...t4) => e2.check(lr(...t4)), e2.min = (...t4) => e2.check(K(...t4)), e2.max = (...t4) => e2.check(nr(...t4)), e2.length = (...t4) => e2.check(rr(...t4)), e2.nonempty = (...t4) => e2.check(K(1, ...t4)), e2.lowercase = (t4) => e2.check(ar(t4)), e2.uppercase = (t4) => e2.check(or(t4)), e2.trim = () => e2.check(dr()), e2.normalize = (...t4) => e2.check(ur(...t4)), e2.toLowerCase = () => e2.check(fr()), e2.toUpperCase = () => e2.check(pr());
});
var Br = /* @__PURE__ */ h("ZodString", (e2, t3) => {
  B.init(e2, t3), zr.init(e2, t3), e2.email = (t4) => e2.check(On(Hr, t4)), e2.url = (t4) => e2.check(Pn(Wr, t4)), e2.jwt = (t4) => e2.check(Yn(ai, t4)), e2.emoji = (t4) => e2.check(Fn(Gr, t4)), e2.guid = (t4) => e2.check(kn(Ur, t4)), e2.uuid = (t4) => e2.check(An(Z, t4)), e2.uuidv4 = (t4) => e2.check(jn(Z, t4)), e2.uuidv6 = (t4) => e2.check(Mn(Z, t4)), e2.uuidv7 = (t4) => e2.check(Nn(Z, t4)), e2.nanoid = (t4) => e2.check(In(Kr, t4)), e2.guid = (t4) => e2.check(kn(Ur, t4)), e2.cuid = (t4) => e2.check(Ln(qr, t4)), e2.cuid2 = (t4) => e2.check(Rn(Jr, t4)), e2.ulid = (t4) => e2.check(zn(Yr, t4)), e2.base64 = (t4) => e2.check(Kn(ni, t4)), e2.base64url = (t4) => e2.check(qn(ri, t4)), e2.xid = (t4) => e2.check(Bn(Xr, t4)), e2.ksuid = (t4) => e2.check(Vn(Zr, t4)), e2.ipv4 = (t4) => e2.check(Hn(Qr, t4)), e2.ipv6 = (t4) => e2.check(Un($r, t4)), e2.cidrv4 = (t4) => e2.check(Wn(ei, t4)), e2.cidrv6 = (t4) => e2.check(Gn(ti, t4)), e2.e164 = (t4) => e2.check(Jn(ii, t4)), e2.datetime = (t4) => e2.check(yr(t4)), e2.date = (t4) => e2.check(xr(t4)), e2.time = (t4) => e2.check(Cr(t4)), e2.duration = (t4) => e2.check(Tr(t4));
});
function Vr(e2) {
  return Dn(Br, e2);
}
var X = /* @__PURE__ */ h("ZodStringFormat", (e2, t3) => {
  V.init(e2, t3), zr.init(e2, t3);
});
var Hr = /* @__PURE__ */ h("ZodEmail", (e2, t3) => {
  Et.init(e2, t3), X.init(e2, t3);
});
var Ur = /* @__PURE__ */ h("ZodGUID", (e2, t3) => {
  wt.init(e2, t3), X.init(e2, t3);
});
var Z = /* @__PURE__ */ h("ZodUUID", (e2, t3) => {
  Tt.init(e2, t3), X.init(e2, t3);
});
var Wr = /* @__PURE__ */ h("ZodURL", (e2, t3) => {
  Dt.init(e2, t3), X.init(e2, t3);
});
var Gr = /* @__PURE__ */ h("ZodEmoji", (e2, t3) => {
  Ot.init(e2, t3), X.init(e2, t3);
});
var Kr = /* @__PURE__ */ h("ZodNanoID", (e2, t3) => {
  kt.init(e2, t3), X.init(e2, t3);
});
var qr = /* @__PURE__ */ h("ZodCUID", (e2, t3) => {
  At.init(e2, t3), X.init(e2, t3);
});
var Jr = /* @__PURE__ */ h("ZodCUID2", (e2, t3) => {
  jt.init(e2, t3), X.init(e2, t3);
});
var Yr = /* @__PURE__ */ h("ZodULID", (e2, t3) => {
  Mt.init(e2, t3), X.init(e2, t3);
});
var Xr = /* @__PURE__ */ h("ZodXID", (e2, t3) => {
  Nt.init(e2, t3), X.init(e2, t3);
});
var Zr = /* @__PURE__ */ h("ZodKSUID", (e2, t3) => {
  Pt.init(e2, t3), X.init(e2, t3);
});
var Qr = /* @__PURE__ */ h("ZodIPv4", (e2, t3) => {
  zt.init(e2, t3), X.init(e2, t3);
});
var $r = /* @__PURE__ */ h("ZodIPv6", (e2, t3) => {
  Bt.init(e2, t3), X.init(e2, t3);
});
var ei = /* @__PURE__ */ h("ZodCIDRv4", (e2, t3) => {
  Vt.init(e2, t3), X.init(e2, t3);
});
var ti = /* @__PURE__ */ h("ZodCIDRv6", (e2, t3) => {
  Ht.init(e2, t3), X.init(e2, t3);
});
var ni = /* @__PURE__ */ h("ZodBase64", (e2, t3) => {
  Wt.init(e2, t3), X.init(e2, t3);
});
var ri = /* @__PURE__ */ h("ZodBase64URL", (e2, t3) => {
  Kt.init(e2, t3), X.init(e2, t3);
});
var ii = /* @__PURE__ */ h("ZodE164", (e2, t3) => {
  qt.init(e2, t3), X.init(e2, t3);
});
var ai = /* @__PURE__ */ h("ZodJWT", (e2, t3) => {
  Yt.init(e2, t3), X.init(e2, t3);
});
var oi = /* @__PURE__ */ h("ZodUnknown", (e2, t3) => {
  Xt.init(e2, t3), Y.init(e2, t3);
});
function si() {
  return er(oi);
}
var ci = /* @__PURE__ */ h("ZodNever", (e2, t3) => {
  Zt.init(e2, t3), Y.init(e2, t3);
});
function li(e2) {
  return tr(ci, e2);
}
var ui = /* @__PURE__ */ h("ZodArray", (e2, t3) => {
  $t.init(e2, t3), Y.init(e2, t3), e2.element = t3.element, e2.min = (t4, n3) => e2.check(K(t4, n3)), e2.nonempty = (t4) => e2.check(K(1, t4)), e2.max = (t4, n3) => e2.check(nr(t4, n3)), e2.length = (t4, n3) => e2.check(rr(t4, n3)), e2.unwrap = () => e2.element;
});
function di(e2, t3) {
  return mr(ui, e2, t3);
}
var fi = /* @__PURE__ */ h("ZodObject", (e2, t3) => {
  rn.init(e2, t3), Y.init(e2, t3), x(e2, "shape", () => t3.shape), e2.keyof = () => yi(Object.keys(e2._zod.def.shape)), e2.catchall = (t4) => e2.clone({
    ...e2._zod.def,
    catchall: t4
  }), e2.passthrough = () => e2.clone({
    ...e2._zod.def,
    catchall: si()
  }), e2.loose = () => e2.clone({
    ...e2._zod.def,
    catchall: si()
  }), e2.strict = () => e2.clone({
    ...e2._zod.def,
    catchall: li()
  }), e2.strip = () => e2.clone({
    ...e2._zod.def,
    catchall: void 0
  }), e2.extend = (t4) => ge(e2, t4), e2.safeExtend = (t4) => _e(e2, t4), e2.merge = (t4) => ve(e2, t4), e2.pick = (t4) => me(e2, t4), e2.omit = (t4) => he(e2, t4), e2.partial = (...t4) => ye(Si, e2, t4[0]), e2.required = (...t4) => be(Ai, e2, t4[0]);
});
function pi(e2, t3) {
  return new fi({
    type: "object",
    shape: e2 ?? {},
    ...O(t3)
  });
}
var mi = /* @__PURE__ */ h("ZodUnion", (e2, t3) => {
  on.init(e2, t3), Y.init(e2, t3), e2.options = t3.options;
});
function hi(e2, t3) {
  return new mi({
    type: "union",
    options: e2,
    ...O(t3)
  });
}
var gi = /* @__PURE__ */ h("ZodIntersection", (e2, t3) => {
  sn.init(e2, t3), Y.init(e2, t3);
});
function _i(e2, t3) {
  return new gi({
    type: "intersection",
    left: e2,
    right: t3
  });
}
var vi = /* @__PURE__ */ h("ZodEnum", (e2, t3) => {
  ln.init(e2, t3), Y.init(e2, t3), e2.enum = t3.entries, e2.options = Object.values(t3.entries);
  let n3 = new Set(Object.keys(t3.entries));
  e2.extract = (e3, r2) => {
    let i4 = {};
    for (let r3 of e3) if (n3.has(r3)) i4[r3] = t3.entries[r3];
    else throw Error(`Key ${r3} not found in enum`);
    return new vi({
      ...t3,
      checks: [],
      ...O(r2),
      entries: i4
    });
  }, e2.exclude = (e3, r2) => {
    let i4 = { ...t3.entries };
    for (let t4 of e3) if (n3.has(t4)) delete i4[t4];
    else throw Error(`Key ${t4} not found in enum`);
    return new vi({
      ...t3,
      checks: [],
      ...O(r2),
      entries: i4
    });
  };
});
function yi(e2, t3) {
  return new vi({
    type: "enum",
    entries: Array.isArray(e2) ? Object.fromEntries(e2.map((e3) => [e3, e3])) : e2,
    ...O(t3)
  });
}
var bi = /* @__PURE__ */ h("ZodTransform", (e2, t3) => {
  un.init(e2, t3), Y.init(e2, t3), e2._zod.parse = (n3, r2) => {
    if (r2.direction === "backward") throw new re(e2.constructor.name);
    n3.addIssue = (r3) => {
      if (typeof r3 == "string") n3.issues.push(M(r3, n3.value, t3));
      else {
        let t4 = r3;
        t4.fatal && (t4.continue = false), t4.code ??= "custom", t4.input ??= n3.value, t4.inst ??= e2, n3.issues.push(M(t4));
      }
    };
    let i4 = t3.transform(n3.value, n3);
    return i4 instanceof Promise ? i4.then((e3) => (n3.value = e3, n3)) : (n3.value = i4, n3);
  };
});
function xi(e2) {
  return new bi({
    type: "transform",
    transform: e2
  });
}
var Si = /* @__PURE__ */ h("ZodOptional", (e2, t3) => {
  fn.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function Ci(e2) {
  return new Si({
    type: "optional",
    innerType: e2
  });
}
var wi = /* @__PURE__ */ h("ZodNullable", (e2, t3) => {
  pn.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function Ti(e2) {
  return new wi({
    type: "nullable",
    innerType: e2
  });
}
var Ei = /* @__PURE__ */ h("ZodDefault", (e2, t3) => {
  mn.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType, e2.removeDefault = e2.unwrap;
});
function Di(e2, t3) {
  return new Ei({
    type: "default",
    innerType: e2,
    get defaultValue() {
      return typeof t3 == "function" ? t3() : de(t3);
    }
  });
}
var Oi = /* @__PURE__ */ h("ZodPrefault", (e2, t3) => {
  gn.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function ki(e2, t3) {
  return new Oi({
    type: "prefault",
    innerType: e2,
    get defaultValue() {
      return typeof t3 == "function" ? t3() : de(t3);
    }
  });
}
var Ai = /* @__PURE__ */ h("ZodNonOptional", (e2, t3) => {
  _n.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function ji(e2, t3) {
  return new Ai({
    type: "nonoptional",
    innerType: e2,
    ...O(t3)
  });
}
var Mi = /* @__PURE__ */ h("ZodCatch", (e2, t3) => {
  yn.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType, e2.removeCatch = e2.unwrap;
});
function Ni(e2, t3) {
  return new Mi({
    type: "catch",
    innerType: e2,
    catchValue: typeof t3 == "function" ? t3 : () => t3
  });
}
var Pi = /* @__PURE__ */ h("ZodPipe", (e2, t3) => {
  bn.init(e2, t3), Y.init(e2, t3), e2.in = t3.in, e2.out = t3.out;
});
function Fi(e2, t3) {
  return new Pi({
    type: "pipe",
    in: e2,
    out: t3
  });
}
var Ii = /* @__PURE__ */ h("ZodReadonly", (e2, t3) => {
  xn.init(e2, t3), Y.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function Li(e2) {
  return new Ii({
    type: "readonly",
    innerType: e2
  });
}
var Ri = /* @__PURE__ */ h("ZodCustom", (e2, t3) => {
  Cn.init(e2, t3), Y.init(e2, t3);
});
function zi(e2, t3 = {}) {
  return hr(Ri, e2, t3);
}
function Bi(e2) {
  return gr(e2);
}
var Vi = /* @__PURE__ */ (function() {
  function e2(e3) {
    this.groups = [], this.each = false, this.context = void 0, this.type = e3.type, this.name = e3.name, this.target = e3.target, this.propertyName = e3.propertyName, this.constraints = e3?.constraints, this.constraintCls = e3.constraintCls, this.validationTypeOptions = e3.validationTypeOptions, e3.validationOptions && (this.message = e3.validationOptions.message, this.groups = e3.validationOptions.groups, this.always = e3.validationOptions.always, this.each = e3.validationOptions.each, this.context = e3.validationOptions.context);
  }
  return e2;
})();
var Hi = (function() {
  function e2() {
  }
  return e2.prototype.transform = function(e3) {
    var t3 = [];
    return Object.keys(e3.properties).forEach(function(n3) {
      e3.properties[n3].forEach(function(r2) {
        var i4 = {
          message: r2.message,
          groups: r2.groups,
          always: r2.always,
          each: r2.each
        }, a3 = {
          type: r2.type,
          name: r2.name,
          target: e3.name,
          propertyName: n3,
          constraints: r2.constraints,
          validationTypeOptions: r2.options,
          validationOptions: i4
        };
        t3.push(new Vi(a3));
      });
    }), t3;
  }, e2;
})();
var Ui = function(e2) {
  var t3 = typeof Symbol == "function" && Symbol.iterator, n3 = t3 && e2[t3], r2 = 0;
  if (n3) return n3.call(e2);
  if (e2 && typeof e2.length == "number") return { next: function() {
    return e2 && r2 >= e2.length && (e2 = void 0), {
      value: e2 && e2[r2++],
      done: !e2
    };
  } };
  throw TypeError(t3 ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var Wi = function(e2, t3) {
  var n3 = typeof Symbol == "function" && e2[Symbol.iterator];
  if (!n3) return e2;
  var r2 = n3.call(e2), i4, a3 = [], o3;
  try {
    for (; (t3 === void 0 || t3-- > 0) && !(i4 = r2.next()).done; ) a3.push(i4.value);
  } catch (e3) {
    o3 = { error: e3 };
  } finally {
    try {
      i4 && !i4.done && (n3 = r2.return) && n3.call(r2);
    } finally {
      if (o3) throw o3.error;
    }
  }
  return a3;
};
var Gi = function(e2, t3, n3) {
  if (n3 || arguments.length === 2) for (var r2 = 0, i4 = t3.length, a3; r2 < i4; r2++) (a3 || !(r2 in t3)) && (a3 ||= Array.prototype.slice.call(t3, 0, r2), a3[r2] = t3[r2]);
  return e2.concat(a3 || Array.prototype.slice.call(t3));
};
(function() {
  function e2() {
    this.validationMetadatas = /* @__PURE__ */ new Map(), this.constraintMetadatas = /* @__PURE__ */ new Map();
  }
  return Object.defineProperty(e2.prototype, "hasValidationMetaData", {
    get: function() {
      return !!this.validationMetadatas.size;
    },
    enumerable: false,
    configurable: true
  }), e2.prototype.addValidationSchema = function(e3) {
    var t3 = this;
    new Hi().transform(e3).forEach(function(e4) {
      return t3.addValidationMetadata(e4);
    });
  }, e2.prototype.addValidationMetadata = function(e3) {
    var t3 = this.validationMetadatas.get(e3.target);
    t3 ? t3.push(e3) : this.validationMetadatas.set(e3.target, [e3]);
  }, e2.prototype.addConstraintMetadata = function(e3) {
    var t3 = this.constraintMetadatas.get(e3.target);
    t3 ? t3.push(e3) : this.constraintMetadatas.set(e3.target, [e3]);
  }, e2.prototype.groupByPropertyName = function(e3) {
    var t3 = {};
    return e3.forEach(function(e4) {
      t3[e4.propertyName] || (t3[e4.propertyName] = []), t3[e4.propertyName].push(e4);
    }), t3;
  }, e2.prototype.getTargetValidationMetadatas = function(e3, t3, n3, r2, i4) {
    var a3, o3, s3 = function(e4) {
      return e4.always === void 0 ? e4.groups && e4.groups.length ? false : n3 : e4.always;
    }, c3 = function(e4) {
      return !!(r2 && (!i4 || !i4.length) && e4.groups && e4.groups.length);
    }, l4 = (this.validationMetadatas.get(e3) || []).filter(function(n4) {
      return n4.target !== e3 && n4.target !== t3 ? false : s3(n4) ? true : c3(n4) ? false : i4 && i4.length > 0 ? n4.groups && !!n4.groups.find(function(e4) {
        return i4.indexOf(e4) !== -1;
      }) : true;
    }), u4 = [];
    try {
      for (var d2 = Ui(this.validationMetadatas.entries()), f2 = d2.next(); !f2.done; f2 = d2.next()) {
        var p2 = Wi(f2.value, 2), ee2 = p2[0], m2 = p2[1];
        e3.prototype instanceof ee2 && u4.push.apply(u4, Gi([], Wi(m2), false));
      }
    } catch (e4) {
      a3 = { error: e4 };
    } finally {
      try {
        f2 && !f2.done && (o3 = d2.return) && o3.call(d2);
      } finally {
        if (a3) throw a3.error;
      }
    }
    var te2 = u4.filter(function(t4) {
      return typeof t4.target == "string" || t4.target === e3 || t4.target instanceof Function && !(e3.prototype instanceof t4.target) ? false : s3(t4) ? true : c3(t4) ? false : i4 && i4.length > 0 ? t4.groups && !!t4.groups.find(function(e4) {
        return i4.indexOf(e4) !== -1;
      }) : true;
    }).filter(function(e4) {
      return !l4.find(function(t4) {
        return t4.propertyName === e4.propertyName && t4.type === e4.type;
      });
    });
    return l4.concat(te2);
  }, e2.prototype.getTargetValidatorConstraints = function(e3) {
    return this.constraintMetadatas.get(e3) || [];
  }, e2;
})(), (function() {
  function e2() {
  }
  return e2.isValid = function(e3) {
    var t3 = this;
    return e3 !== "isValid" && e3 !== "getMessage" && Object.keys(this).map(function(e4) {
      return t3[e4];
    }).indexOf(e3) !== -1;
  }, e2.CUSTOM_VALIDATION = "customValidation", e2.NESTED_VALIDATION = "nestedValidation", e2.PROMISE_VALIDATION = "promiseValidation", e2.CONDITIONAL_VALIDATION = "conditionalValidation", e2.WHITELIST = "whitelistValidation", e2.IS_DEFINED = "isDefined", e2;
})();
var Ki = new ((function() {
  function e2() {
    this.instances = [];
  }
  return e2.prototype.get = function(e3) {
    var t3 = this.instances.find(function(t4) {
      return t4.type === e3;
    });
    return t3 || (t3 = {
      type: e3,
      object: new e3()
    }, this.instances.push(t3)), t3.object;
  }, e2;
})())();
var qi;
var Q;
function Ji(e2) {
  if (qi) try {
    var t3 = qi.get(e2);
    if (t3 || !Q || !Q.fallback) return t3;
  } catch (e3) {
    if (!Q || !Q.fallbackOnErrors) throw e3;
  }
  return Ki.get(e2);
}
(function() {
  function e2(e3, t3, n3) {
    n3 === void 0 && (n3 = false), this.target = e3, this.name = t3, this.async = n3;
  }
  return Object.defineProperty(e2.prototype, "instance", {
    get: function() {
      return Ji(this.target);
    },
    enumerable: false,
    configurable: true
  }), e2;
})();
var $ = /* @__PURE__ */ (function(e2) {
  return e2.ACTOR = "ACTOR", e2.ADDRESS = "ADDRESS", e2.ARRAY = "ARRAY", e2.BOOLEAN = "BOOLEAN", e2.CURRENCY = "CURRENCY", e2.DATE = "DATE", e2.DATE_TIME = "DATE_TIME", e2.EMAILS = "EMAILS", e2.FILES = "FILES", e2.FULL_NAME = "FULL_NAME", e2.LINKS = "LINKS", e2.MORPH_RELATION = "MORPH_RELATION", e2.MULTI_SELECT = "MULTI_SELECT", e2.NUMBER = "NUMBER", e2.NUMERIC = "NUMERIC", e2.PHONES = "PHONES", e2.POSITION = "POSITION", e2.RATING = "RATING", e2.RAW_JSON = "RAW_JSON", e2.RELATION = "RELATION", e2.RICH_TEXT = "RICH_TEXT", e2.SELECT = "SELECT", e2.TEXT = "TEXT", e2.TS_VECTOR = "TS_VECTOR", e2.UUID = "UUID", e2;
})({});
var Yi = /* @__PURE__ */ (function(e2) {
  return e2.EMAIL = "EMAIL", e2.CALENDAR = "CALENDAR", e2.WORKFLOW = "WORKFLOW", e2.AGENT = "AGENT", e2.API = "API", e2.IMPORT = "IMPORT", e2.MANUAL = "MANUAL", e2.SYSTEM = "SYSTEM", e2.WEBHOOK = "WEBHOOK", e2.APPLICATION = "APPLICATION", e2;
})({});
var Xi = {
  type: $.ACTOR,
  properties: [
    {
      name: "source",
      type: $.SELECT,
      hidden: false,
      isRequired: true,
      options: Object.keys(Yi).map((e2, t3) => ({
        id: p(),
        label: `${Yi[e2].toLowerCase()}`,
        value: e2,
        position: t3
      }))
    },
    {
      name: "workspaceMemberId",
      type: $.UUID,
      hidden: "input",
      isRequired: false
    },
    {
      name: "name",
      type: $.TEXT,
      hidden: "input",
      isRequired: true
    },
    {
      name: "context",
      type: $.RAW_JSON,
      hidden: false,
      isRequired: false
    }
  ]
};
var Zi = {
  type: $.ADDRESS,
  properties: [
    {
      name: "addressStreet1",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressStreet2",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressCity",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressPostcode",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressState",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressCountry",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressLat",
      type: $.NUMERIC,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressLng",
      type: $.NUMERIC,
      hidden: false,
      isRequired: false
    }
  ]
};
var Qi = {
  type: $.CURRENCY,
  properties: [{
    name: "amountMicros",
    type: $.NUMERIC,
    hidden: false,
    isRequired: false
  }, {
    name: "currencyCode",
    type: $.TEXT,
    hidden: false,
    isRequired: false
  }]
};
var $i = {
  type: $.EMAILS,
  properties: [{
    name: "primaryEmail",
    type: $.TEXT,
    hidden: false,
    isRequired: false,
    isIncludedInUniqueConstraint: true
  }, {
    name: "additionalEmails",
    type: $.RAW_JSON,
    hidden: false,
    isRequired: false
  }]
};
var ea = {
  type: $.FULL_NAME,
  properties: [{
    name: "firstName",
    type: $.TEXT,
    hidden: false,
    isRequired: false,
    isIncludedInUniqueConstraint: false
  }, {
    name: "lastName",
    type: $.TEXT,
    hidden: false,
    isRequired: false,
    isIncludedInUniqueConstraint: false
  }]
};
var ta = {
  type: $.LINKS,
  properties: [
    {
      name: "primaryLinkLabel",
      type: $.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "primaryLinkUrl",
      type: $.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "secondaryLinks",
      type: $.RAW_JSON,
      hidden: false,
      isRequired: false
    }
  ]
};
var na = {
  type: $.PHONES,
  properties: [
    {
      name: "primaryPhoneNumber",
      type: $.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "primaryPhoneCountryCode",
      type: $.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "primaryPhoneCallingCode",
      type: $.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "additionalPhones",
      type: $.RAW_JSON,
      hidden: false,
      isRequired: false
    }
  ]
};
var ra = {
  type: $.RICH_TEXT,
  properties: [{
    name: "blocknote",
    type: $.TEXT,
    hidden: false,
    isRequired: false
  }, {
    name: "markdown",
    type: $.TEXT,
    hidden: false,
    isRequired: false
  }]
};
pi({
  blocknote: Vr().nullable().optional(),
  markdown: Vr().nullable()
}), /* @__PURE__ */ new Map([
  [$.LINKS, ta],
  [$.CURRENCY, Qi],
  [$.FULL_NAME, ea],
  [$.ADDRESS, Zi],
  [$.ACTOR, Xi],
  [$.EMAILS, $i],
  [$.PHONES, na],
  [$.RICH_TEXT, ra]
]), $.RELATION, $.MORPH_RELATION, $.FILES, $.TS_VECTOR, $.TEXT, $.ARRAY, $.BOOLEAN, $.DATE, $.DATE_TIME, $.NUMBER, $.NUMERIC, $.RAW_JSON, $.RICH_TEXT, $.SELECT, $.MULTI_SELECT;
var aa = "TWENTY_API_URL";
var oa = "TWENTY_APP_ACCESS_TOKEN";
var sa = "TWENTY_APP_APPLICATION_ACCESS_TOKEN";
var ca = "TWENTY_FUNCTIONS_URL";

// node_modules/twenty-client-sdk/dist/rest.mjs
var i2 = (e2) => e2 != null;
var a2 = class extends Error {
  constructor(e2, t3) {
    super(e2), this.name = "RestApiClientError", this.status = t3?.status, this.statusText = t3?.statusText, this.url = t3?.url, this.body = t3?.body;
  }
};
var o2 = () => globalThis.process?.env ?? {};
var s2 = (e2) => /^\/?s\//.test(e2);
var c2 = (e2) => e2.replace(/^(\/?)s\//, "$1");
var l2 = (e2, t3, n3) => {
  let r2 = /^https?:\/\//i.test(t3) ? t3 : `${e2}${t3.startsWith("/") ? "" : "/"}${t3}`;
  if (!i2(n3)) return r2;
  let a3 = new URLSearchParams();
  for (let [e3, t4] of Object.entries(n3)) i2(t4) && a3.append(e3, String(t4));
  let o3 = a3.toString();
  return o3.length === 0 ? r2 : r2.includes("?") ? `${r2}&${o3}` : `${r2}?${o3}`;
};
var u2 = class {
  constructor(e2) {
    this.refreshAccessTokenPromise = null, this.baseUrl = e2?.baseUrl, this.token = e2?.token, this.defaultHeaders = e2?.defaultHeaders, this.fetchImplementation = e2?.fetch ?? globalThis.fetch ?? null, this.authorizationToken = e2?.token ?? null, this.runAs = e2?.runAs;
  }
  request(e2, t3, n3) {
    return this.execute(e2, t3, n3?.body, n3);
  }
  get(e2, t3) {
    return this.execute("GET", e2, void 0, t3);
  }
  resolveUrl(e2, t3) {
    let n3 = this.resolveTarget(e2);
    return l2(n3.baseUrl, n3.path, t3?.query);
  }
  post(e2, t3, n3) {
    return this.execute("POST", e2, t3, n3);
  }
  put(e2, t3, n3) {
    return this.execute("PUT", e2, t3, n3);
  }
  patch(e2, t3, n3) {
    return this.execute("PATCH", e2, t3, n3);
  }
  delete(e2, t3) {
    return this.execute("DELETE", e2, void 0, t3);
  }
  resolveBaseUrl() {
    let t3 = this.baseUrl ?? o2().TWENTY_API_URL;
    if (!i2(t3) || t3.trim().length === 0) throw new a2(`Missing API url. Set the \`${aa}\` environment variable or pass \`baseUrl\` to \`RestApiClient\`.`);
    return t3.replace(/\/+$/, "");
  }
  resolveFunctionsBaseUrl() {
    let e2 = o2()[ca];
    if (!(!i2(e2) || e2.trim().length === 0)) return e2.trim().replace(/\/+$/, "");
  }
  resolveTarget(e2) {
    return i2(this.baseUrl) || !s2(e2) ? {
      baseUrl: this.resolveBaseUrl(),
      path: e2
    } : {
      baseUrl: this.resolveFunctionsBaseUrl() ?? `${this.resolveBaseUrl()}/s`,
      path: c2(e2)
    };
  }
  resolveToken() {
    let e2 = this.runAs === "application" ? sa : oa;
    if (!i2(this.authorizationToken)) {
      let t3 = o2();
      this.authorizationToken = this.token ?? t3[e2] ?? t3.TWENTY_API_KEY ?? null;
    }
    if (!i2(this.authorizationToken) || this.authorizationToken.length === 0) throw new a2(`Missing application access token. Set the \`${e2}\` environment variable or pass \`token\` to \`RestApiClient\`.`);
    return this.authorizationToken;
  }
  async requestRefreshedAccessToken() {
    let e2 = globalThis.frontComponentHostCommunicationApi?.requestAccessTokenRefresh;
    return typeof e2 == "function" ? (this.refreshAccessTokenPromise ||= e2().then((e3) => typeof e3 != "string" || e3.length === 0 ? null : (this.authorizationToken = e3, o2()[oa] = e3, e3)).catch((e3) => (console.error("Twenty REST client: token refresh failed", e3), null)).finally(() => {
      this.refreshAccessTokenPromise = null;
    }), this.refreshAccessTokenPromise) : null;
  }
  sendRequest(e2, t3, n3, r2, o3) {
    if (!i2(this.fetchImplementation)) throw new a2("Global `fetch` function is not available, pass a fetch implementation to `RestApiClient`.");
    let s3 = new Headers(this.defaultHeaders);
    i2(o3?.headers) && new Headers(o3.headers).forEach((e3, t4) => s3.set(t4, e3));
    let c3 = typeof FormData < "u" && n3 instanceof FormData, l4 = i2(n3) && !c3 && typeof n3 != "string";
    c3 ? s3.delete("Content-Type") : l4 && s3.set("Content-Type", "application/json"), s3.set("Authorization", `Bearer ${r2}`);
    let u4 = i2(n3) ? c3 || typeof n3 == "string" ? n3 : JSON.stringify(n3) : void 0;
    return this.fetchImplementation.call(globalThis, e2, {
      method: t3,
      headers: s3,
      body: u4,
      signal: o3?.signal
    });
  }
  async parseResponse(e2, t3) {
    let n3 = await e2.text(), r2;
    if (n3.trim().length > 0) try {
      r2 = JSON.parse(n3);
    } catch {
      r2 = n3;
    }
    if (!e2.ok) throw new a2(`Request to ${t3} failed with status ${e2.status} ${e2.statusText}`, {
      status: e2.status,
      statusText: e2.statusText,
      url: t3,
      body: r2
    });
    return r2;
  }
  async execute(e2, t3, n3, r2) {
    let a3 = this.resolveTarget(t3), o3 = l2(a3.baseUrl, a3.path, r2?.query), s3 = this.resolveToken(), c3 = await this.sendRequest(o3, e2, n3, s3, r2);
    if (c3.status === 401) {
      let t4 = await this.requestRefreshedAccessToken();
      i2(t4) && (c3 = await this.sendRequest(o3, e2, n3, t4, r2));
    }
    return this.parseResponse(c3, o3);
  }
};

// node_modules/twenty-sdk/dist/logic-function/index.mjs
var l3 = (e2) => {
  let n3 = { type: "unknown" };
  switch (e2.type) {
    case "string":
      n3.type = "string";
      break;
    case "number":
    case "integer":
      n3.type = "number";
      break;
    case "boolean":
      n3.type = "boolean";
      break;
    case "array":
      n3.type = "array", e2.items && (n3.items = l3(e2.items));
      break;
    case "object":
      n3.type = "object", e2.properties && (n3.properties = Object.fromEntries(Object.entries(e2.properties).map(([e3, t3]) => [e3, l3(t3)])));
      break;
    case "record":
      n3.type = "record";
      break;
    case "records":
      n3.type = "records";
      break;
    default:
      n3.type = "unknown";
  }
  return Array.isArray(e2.enum) && (n3.enum = e2.enum.filter((e3) => typeof e3 == "string")), e2.multiline === true && (n3.multiline = true), (0, import_guards.isNonEmptyString)(e2.label) && (n3.label = e2.label), (0, import_guards.isNonEmptyString)(e2.objectUniversalIdentifier) && (n3.objectUniversalIdentifier = e2.objectUniversalIdentifier), n3;
};
var u3 = (e2) => [l3(e2)];
u3({
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "number" }
  }
});
Object.freeze({ status: "aborted" });
function g2(e2, t3, n3) {
  function r2(n4, r3) {
    var i5;
    Object.defineProperty(n4, "_zod", {
      value: n4._zod ?? {},
      enumerable: false
    }), (i5 = n4._zod).traits ?? (i5.traits = /* @__PURE__ */ new Set()), n4._zod.traits.add(e2), t3(n4, r3);
    for (let e3 in o3.prototype) e3 in n4 || Object.defineProperty(n4, e3, { value: o3.prototype[e3].bind(n4) });
    n4._zod.constr = o3, n4._zod.def = r3;
  }
  let i4 = n3?.Parent ?? Object;
  class a3 extends i4 {
  }
  Object.defineProperty(a3, "name", { value: e2 });
  function o3(e3) {
    var t4;
    let i5 = n3?.Parent ? new a3() : this;
    r2(i5, e3), (t4 = i5._zod).deferred ?? (t4.deferred = []);
    for (let e4 of i5._zod.deferred) e4();
    return i5;
  }
  return Object.defineProperty(o3, "init", { value: r2 }), Object.defineProperty(o3, Symbol.hasInstance, { value: (t4) => n3?.Parent && t4 instanceof n3.Parent ? true : t4?._zod?.traits?.has(e2) }), Object.defineProperty(o3, "name", { value: e2 }), o3;
}
var _2 = class extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
};
var oe2 = class extends Error {
  constructor(e2) {
    super(`Encountered unidirectional transform during encode: ${e2}`), this.name = "ZodEncodeError";
  }
};
var se2 = {};
function v2(e2) {
  return e2 && Object.assign(se2, e2), se2;
}
function ce2(e2) {
  let t3 = Object.values(e2).filter((e3) => typeof e3 == "number");
  return Object.entries(e2).filter(([e3, n3]) => t3.indexOf(+e3) === -1).map(([e3, t4]) => t4);
}
function y2(e2, t3) {
  return typeof t3 == "bigint" ? t3.toString() : t3;
}
function le2(e2) {
  return { get value() {
    {
      let t3 = e2();
      return Object.defineProperty(this, "value", { value: t3 }), t3;
    }
    throw Error("cached value already set");
  } };
}
function ue2(e2) {
  return e2 == null;
}
function b2(e2) {
  let t3 = +!!e2.startsWith("^"), n3 = e2.endsWith("$") ? e2.length - 1 : e2.length;
  return e2.slice(t3, n3);
}
var de2 = /* @__PURE__ */ Symbol("evaluating");
function x2(e2, t3, n3) {
  let r2;
  Object.defineProperty(e2, t3, {
    get() {
      if (r2 !== de2) return r2 === void 0 && (r2 = de2, r2 = n3()), r2;
    },
    set(n4) {
      Object.defineProperty(e2, t3, { value: n4 });
    },
    configurable: true
  });
}
function S2(e2, t3, n3) {
  Object.defineProperty(e2, t3, {
    value: n3,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function C2(...e2) {
  let t3 = {};
  for (let n3 of e2) Object.assign(t3, Object.getOwnPropertyDescriptors(n3));
  return Object.defineProperties({}, t3);
}
function fe2(e2) {
  return JSON.stringify(e2);
}
var pe2 = "captureStackTrace" in Error ? Error.captureStackTrace : (...e2) => {
};
function w2(e2) {
  return typeof e2 == "object" && !!e2 && !Array.isArray(e2);
}
var me2 = le2(() => {
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare")) return false;
  try {
    return Function(""), true;
  } catch {
    return false;
  }
});
function T2(e2) {
  if (w2(e2) === false) return false;
  let t3 = e2.constructor;
  if (t3 === void 0) return true;
  let n3 = t3.prototype;
  return !(w2(n3) === false || Object.prototype.hasOwnProperty.call(n3, "isPrototypeOf") === false);
}
function he2(e2) {
  return T2(e2) ? { ...e2 } : Array.isArray(e2) ? [...e2] : e2;
}
var ge2 = /* @__PURE__ */ new Set([
  "string",
  "number",
  "symbol"
]);
function E2(e2) {
  return e2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function D2(e2, t3, n3) {
  let r2 = new e2._zod.constr(t3 ?? e2._zod.def);
  return (!t3 || n3?.parent) && (r2._zod.parent = e2), r2;
}
function O2(e2) {
  let t3 = e2;
  if (!t3) return {};
  if (typeof t3 == "string") return { error: () => t3 };
  if (t3?.message !== void 0) {
    if (t3?.error !== void 0) throw Error("Cannot specify both `message` and `error` params");
    t3.error = t3.message;
  }
  return delete t3.message, typeof t3.error == "string" ? {
    ...t3,
    error: () => t3.error
  } : t3;
}
function _e2(e2) {
  return Object.keys(e2).filter((t3) => e2[t3]._zod.optin === "optional" && e2[t3]._zod.optout === "optional");
}
-Number.MAX_VALUE, Number.MAX_VALUE;
function ve2(e2, t3) {
  let n3 = e2._zod.def;
  return D2(e2, C2(e2._zod.def, {
    get shape() {
      let e3 = {};
      for (let r2 in t3) {
        if (!(r2 in n3.shape)) throw Error(`Unrecognized key: "${r2}"`);
        t3[r2] && (e3[r2] = n3.shape[r2]);
      }
      return S2(this, "shape", e3), e3;
    },
    checks: []
  }));
}
function ye2(e2, t3) {
  let n3 = e2._zod.def;
  return D2(e2, C2(e2._zod.def, {
    get shape() {
      let r2 = { ...e2._zod.def.shape };
      for (let e3 in t3) {
        if (!(e3 in n3.shape)) throw Error(`Unrecognized key: "${e3}"`);
        t3[e3] && delete r2[e3];
      }
      return S2(this, "shape", r2), r2;
    },
    checks: []
  }));
}
function be2(e2, t3) {
  if (!T2(t3)) throw Error("Invalid input to extend: expected a plain object");
  let n3 = e2._zod.def.checks;
  if (n3 && n3.length > 0) throw Error("Object schemas containing refinements cannot be extended. Use `.safeExtend()` instead.");
  return D2(e2, C2(e2._zod.def, {
    get shape() {
      let n4 = {
        ...e2._zod.def.shape,
        ...t3
      };
      return S2(this, "shape", n4), n4;
    },
    checks: []
  }));
}
function xe2(e2, t3) {
  if (!T2(t3)) throw Error("Invalid input to safeExtend: expected a plain object");
  return D2(e2, {
    ...e2._zod.def,
    get shape() {
      let n3 = {
        ...e2._zod.def.shape,
        ...t3
      };
      return S2(this, "shape", n3), n3;
    },
    checks: e2._zod.def.checks
  });
}
function Se2(e2, t3) {
  return D2(e2, C2(e2._zod.def, {
    get shape() {
      let n3 = {
        ...e2._zod.def.shape,
        ...t3._zod.def.shape
      };
      return S2(this, "shape", n3), n3;
    },
    get catchall() {
      return t3._zod.def.catchall;
    },
    checks: []
  }));
}
function Ce2(e2, t3, n3) {
  return D2(t3, C2(t3._zod.def, {
    get shape() {
      let r2 = t3._zod.def.shape, i4 = { ...r2 };
      if (n3) for (let t4 in n3) {
        if (!(t4 in r2)) throw Error(`Unrecognized key: "${t4}"`);
        n3[t4] && (i4[t4] = e2 ? new e2({
          type: "optional",
          innerType: r2[t4]
        }) : r2[t4]);
      }
      else for (let t4 in r2) i4[t4] = e2 ? new e2({
        type: "optional",
        innerType: r2[t4]
      }) : r2[t4];
      return S2(this, "shape", i4), i4;
    },
    checks: []
  }));
}
function we2(e2, t3, n3) {
  return D2(t3, C2(t3._zod.def, {
    get shape() {
      let r2 = t3._zod.def.shape, i4 = { ...r2 };
      if (n3) for (let t4 in n3) {
        if (!(t4 in i4)) throw Error(`Unrecognized key: "${t4}"`);
        n3[t4] && (i4[t4] = new e2({
          type: "nonoptional",
          innerType: r2[t4]
        }));
      }
      else for (let t4 in r2) i4[t4] = new e2({
        type: "nonoptional",
        innerType: r2[t4]
      });
      return S2(this, "shape", i4), i4;
    },
    checks: []
  }));
}
function k2(e2, t3 = 0) {
  if (e2.aborted === true) return true;
  for (let n3 = t3; n3 < e2.issues.length; n3++) if (e2.issues[n3]?.continue !== true) return true;
  return false;
}
function Te2(e2, t3) {
  return t3.map((t4) => {
    var n3;
    return (n3 = t4).path ?? (n3.path = []), t4.path.unshift(e2), t4;
  });
}
function A2(e2) {
  return typeof e2 == "string" ? e2 : e2?.message;
}
function j2(e2, t3, n3) {
  let r2 = {
    ...e2,
    path: e2.path ?? []
  };
  return e2.message || (r2.message = A2(e2.inst?._zod.def?.error?.(e2)) ?? A2(t3?.error?.(e2)) ?? A2(n3.customError?.(e2)) ?? A2(n3.localeError?.(e2)) ?? "Invalid input"), delete r2.inst, delete r2.continue, t3?.reportInput || delete r2.input, r2;
}
function M2(e2) {
  return Array.isArray(e2) ? "array" : typeof e2 == "string" ? "string" : "unknown";
}
function N2(...e2) {
  let [t3, n3, r2] = e2;
  return typeof t3 == "string" ? {
    message: t3,
    code: "custom",
    input: n3,
    inst: r2
  } : { ...t3 };
}
var Ee2 = (e2, t3) => {
  e2.name = "$ZodError", Object.defineProperty(e2, "_zod", {
    value: e2._zod,
    enumerable: false
  }), Object.defineProperty(e2, "issues", {
    value: t3,
    enumerable: false
  }), e2.message = JSON.stringify(t3, y2, 2), Object.defineProperty(e2, "toString", {
    value: () => e2.message,
    enumerable: false
  });
};
var De2 = g2("$ZodError", Ee2);
var Oe2 = g2("$ZodError", Ee2, { Parent: Error });
function ke2(e2, t3 = (e3) => e3.message) {
  let n3 = {}, r2 = [];
  for (let i4 of e2.issues) i4.path.length > 0 ? (n3[i4.path[0]] = n3[i4.path[0]] || [], n3[i4.path[0]].push(t3(i4))) : r2.push(t3(i4));
  return {
    formErrors: r2,
    fieldErrors: n3
  };
}
function Ae2(e2, t3) {
  let n3 = t3 || function(e3) {
    return e3.message;
  }, r2 = { _errors: [] }, i4 = (e3) => {
    for (let t4 of e3.issues) if (t4.code === "invalid_union" && t4.errors.length) t4.errors.map((e4) => i4({ issues: e4 }));
    else if (t4.code === "invalid_key") i4({ issues: t4.issues });
    else if (t4.code === "invalid_element") i4({ issues: t4.issues });
    else if (t4.path.length === 0) r2._errors.push(n3(t4));
    else {
      let e4 = r2, i5 = 0;
      for (; i5 < t4.path.length; ) {
        let r3 = t4.path[i5];
        i5 === t4.path.length - 1 ? (e4[r3] = e4[r3] || { _errors: [] }, e4[r3]._errors.push(n3(t4))) : e4[r3] = e4[r3] || { _errors: [] }, e4 = e4[r3], i5++;
      }
    }
  };
  return i4(e2), r2;
}
var je2 = (e2) => (t3, n3, r2, i4) => {
  let a3 = r2 ? Object.assign(r2, { async: false }) : { async: false }, o3 = t3._zod.run({
    value: n3,
    issues: []
  }, a3);
  if (o3 instanceof Promise) throw new _2();
  if (o3.issues.length) {
    let t4 = new (i4?.Err ?? e2)(o3.issues.map((e3) => j2(e3, a3, v2())));
    throw pe2(t4, i4?.callee), t4;
  }
  return o3.value;
};
var Me2 = (e2) => async (t3, n3, r2, i4) => {
  let a3 = r2 ? Object.assign(r2, { async: true }) : { async: true }, o3 = t3._zod.run({
    value: n3,
    issues: []
  }, a3);
  if (o3 instanceof Promise && (o3 = await o3), o3.issues.length) {
    let t4 = new (i4?.Err ?? e2)(o3.issues.map((e3) => j2(e3, a3, v2())));
    throw pe2(t4, i4?.callee), t4;
  }
  return o3.value;
};
var P2 = (e2) => (t3, n3, r2) => {
  let i4 = r2 ? {
    ...r2,
    async: false
  } : { async: false }, a3 = t3._zod.run({
    value: n3,
    issues: []
  }, i4);
  if (a3 instanceof Promise) throw new _2();
  return a3.issues.length ? {
    success: false,
    error: new (e2 ?? De2)(a3.issues.map((e3) => j2(e3, i4, v2())))
  } : {
    success: true,
    data: a3.value
  };
};
var Ne2 = /* @__PURE__ */ P2(Oe2);
var F2 = (e2) => async (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { async: true }) : { async: true }, a3 = t3._zod.run({
    value: n3,
    issues: []
  }, i4);
  return a3 instanceof Promise && (a3 = await a3), a3.issues.length ? {
    success: false,
    error: new e2(a3.issues.map((e3) => j2(e3, i4, v2())))
  } : {
    success: true,
    data: a3.value
  };
};
var Pe2 = /* @__PURE__ */ F2(Oe2);
var Fe2 = (e2) => (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return je2(e2)(t3, n3, i4);
};
var Ie2 = (e2) => (t3, n3, r2) => je2(e2)(t3, n3, r2);
var Le2 = (e2) => async (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return Me2(e2)(t3, n3, i4);
};
var Re2 = (e2) => async (t3, n3, r2) => Me2(e2)(t3, n3, r2);
var ze2 = (e2) => (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return P2(e2)(t3, n3, i4);
};
var Be2 = (e2) => (t3, n3, r2) => P2(e2)(t3, n3, r2);
var Ve2 = (e2) => async (t3, n3, r2) => {
  let i4 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return F2(e2)(t3, n3, i4);
};
var He2 = (e2) => async (t3, n3, r2) => F2(e2)(t3, n3, r2);
var Ue2 = /^[cC][^\s-]{8,}$/;
var We2 = /^[0-9a-z]+$/;
var Ge2 = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
var Ke2 = /^[0-9a-vA-V]{20}$/;
var qe2 = /^[A-Za-z0-9]{27}$/;
var Je2 = /^[a-zA-Z0-9_-]{21}$/;
var Ye2 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var Xe2 = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var Ze2 = (e2) => e2 ? RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
var Qe2 = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var $e2 = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function et2() {
  return new RegExp($e2, "u");
}
var tt2 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var nt2 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var rt2 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var it2 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var at2 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var ot2 = /^[A-Za-z0-9_-]*$/;
var st2 = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
var ct2 = /^\+(?:[0-9]){6,14}[0-9]$/;
var lt2 = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
var ut2 = /* @__PURE__ */ RegExp(`^${lt2}$`);
function dt2(e2) {
  let t3 = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e2.precision == "number" ? e2.precision === -1 ? `${t3}` : e2.precision === 0 ? `${t3}:[0-5]\\d` : `${t3}:[0-5]\\d\\.\\d{${e2.precision}}` : `${t3}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function ft2(e2) {
  return RegExp(`^${dt2(e2)}$`);
}
function pt2(e2) {
  let t3 = dt2({ precision: e2.precision }), n3 = ["Z"];
  e2.local && n3.push(""), e2.offset && n3.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  let r2 = `${t3}(?:${n3.join("|")})`;
  return RegExp(`^${lt2}T(?:${r2})$`);
}
var mt2 = (e2) => {
  let t3 = e2 ? `[\\s\\S]{${e2?.minimum ?? 0},${e2?.maximum ?? ""}}` : "[\\s\\S]*";
  return RegExp(`^${t3}$`);
};
var ht2 = /^[^A-Z]*$/;
var gt2 = /^[^a-z]*$/;
var I2 = /* @__PURE__ */ g2("$ZodCheck", (e2, t3) => {
  var n3;
  e2._zod ??= {}, e2._zod.def = t3, (n3 = e2._zod).onattach ?? (n3.onattach = []);
});
var _t2 = /* @__PURE__ */ g2("$ZodCheckMaxLength", (e2, t3) => {
  var n3;
  I2.init(e2, t3), (n3 = e2._zod.def).when ?? (n3.when = (e3) => {
    let t4 = e3.value;
    return !ue2(t4) && t4.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag.maximum ?? Infinity;
    t3.maximum < n4 && (e3._zod.bag.maximum = t3.maximum);
  }), e2._zod.check = (n4) => {
    let r2 = n4.value;
    if (r2.length <= t3.maximum) return;
    let i4 = M2(r2);
    n4.issues.push({
      origin: i4,
      code: "too_big",
      maximum: t3.maximum,
      inclusive: true,
      input: r2,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var vt2 = /* @__PURE__ */ g2("$ZodCheckMinLength", (e2, t3) => {
  var n3;
  I2.init(e2, t3), (n3 = e2._zod.def).when ?? (n3.when = (e3) => {
    let t4 = e3.value;
    return !ue2(t4) && t4.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag.minimum ?? -Infinity;
    t3.minimum > n4 && (e3._zod.bag.minimum = t3.minimum);
  }), e2._zod.check = (n4) => {
    let r2 = n4.value;
    if (r2.length >= t3.minimum) return;
    let i4 = M2(r2);
    n4.issues.push({
      origin: i4,
      code: "too_small",
      minimum: t3.minimum,
      inclusive: true,
      input: r2,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var yt2 = /* @__PURE__ */ g2("$ZodCheckLengthEquals", (e2, t3) => {
  var n3;
  I2.init(e2, t3), (n3 = e2._zod.def).when ?? (n3.when = (e3) => {
    let t4 = e3.value;
    return !ue2(t4) && t4.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag;
    n4.minimum = t3.length, n4.maximum = t3.length, n4.length = t3.length;
  }), e2._zod.check = (n4) => {
    let r2 = n4.value, i4 = r2.length;
    if (i4 === t3.length) return;
    let a3 = M2(r2), o3 = i4 > t3.length;
    n4.issues.push({
      origin: a3,
      ...o3 ? {
        code: "too_big",
        maximum: t3.length
      } : {
        code: "too_small",
        minimum: t3.length
      },
      inclusive: true,
      exact: true,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var L2 = /* @__PURE__ */ g2("$ZodCheckStringFormat", (e2, t3) => {
  var n3, r2;
  I2.init(e2, t3), e2._zod.onattach.push((e3) => {
    let n4 = e3._zod.bag;
    n4.format = t3.format, t3.pattern && (n4.patterns ??= /* @__PURE__ */ new Set(), n4.patterns.add(t3.pattern));
  }), t3.pattern ? (n3 = e2._zod).check ?? (n3.check = (n4) => {
    t3.pattern.lastIndex = 0, !t3.pattern.test(n4.value) && n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t3.format,
      input: n4.value,
      ...t3.pattern ? { pattern: t3.pattern.toString() } : {},
      inst: e2,
      continue: !t3.abort
    });
  }) : (r2 = e2._zod).check ?? (r2.check = () => {
  });
});
var bt2 = /* @__PURE__ */ g2("$ZodCheckRegex", (e2, t3) => {
  L2.init(e2, t3), e2._zod.check = (n3) => {
    t3.pattern.lastIndex = 0, !t3.pattern.test(n3.value) && n3.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n3.value,
      pattern: t3.pattern.toString(),
      inst: e2,
      continue: !t3.abort
    });
  };
});
var xt2 = /* @__PURE__ */ g2("$ZodCheckLowerCase", (e2, t3) => {
  t3.pattern ??= ht2, L2.init(e2, t3);
});
var St2 = /* @__PURE__ */ g2("$ZodCheckUpperCase", (e2, t3) => {
  t3.pattern ??= gt2, L2.init(e2, t3);
});
var Ct2 = /* @__PURE__ */ g2("$ZodCheckIncludes", (e2, t3) => {
  I2.init(e2, t3);
  let n3 = E2(t3.includes), r2 = new RegExp(typeof t3.position == "number" ? `^.{${t3.position}}${n3}` : n3);
  t3.pattern = r2, e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.patterns ??= /* @__PURE__ */ new Set(), t4.patterns.add(r2);
  }), e2._zod.check = (n4) => {
    n4.value.includes(t3.includes, t3.position) || n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t3.includes,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var wt2 = /* @__PURE__ */ g2("$ZodCheckStartsWith", (e2, t3) => {
  I2.init(e2, t3);
  let n3 = RegExp(`^${E2(t3.prefix)}.*`);
  t3.pattern ??= n3, e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.patterns ??= /* @__PURE__ */ new Set(), t4.patterns.add(n3);
  }), e2._zod.check = (n4) => {
    n4.value.startsWith(t3.prefix) || n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: t3.prefix,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var Tt2 = /* @__PURE__ */ g2("$ZodCheckEndsWith", (e2, t3) => {
  I2.init(e2, t3);
  let n3 = RegExp(`.*${E2(t3.suffix)}$`);
  t3.pattern ??= n3, e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.patterns ??= /* @__PURE__ */ new Set(), t4.patterns.add(n3);
  }), e2._zod.check = (n4) => {
    n4.value.endsWith(t3.suffix) || n4.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: t3.suffix,
      input: n4.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var Et2 = /* @__PURE__ */ g2("$ZodCheckOverwrite", (e2, t3) => {
  I2.init(e2, t3), e2._zod.check = (e3) => {
    e3.value = t3.tx(e3.value);
  };
});
var Dt2 = class {
  constructor(e2 = []) {
    this.content = [], this.indent = 0, this && (this.args = e2);
  }
  indented(e2) {
    this.indent += 1, e2(this), --this.indent;
  }
  write(e2) {
    if (typeof e2 == "function") {
      e2(this, { execution: "sync" }), e2(this, { execution: "async" });
      return;
    }
    let t3 = e2.split("\n").filter((e3) => e3), n3 = Math.min(...t3.map((e3) => e3.length - e3.trimStart().length)), r2 = t3.map((e3) => e3.slice(n3)).map((e3) => " ".repeat(this.indent * 2) + e3);
    for (let e3 of r2) this.content.push(e3);
  }
  compile() {
    let e2 = Function, t3 = this?.args, n3 = [...(this?.content ?? [""]).map((e3) => `  ${e3}`)];
    return new e2(...t3, n3.join("\n"));
  }
};
var Ot2 = {
  major: 4,
  minor: 1,
  patch: 11
};
var R2 = /* @__PURE__ */ g2("$ZodType", (e2, t3) => {
  var n3;
  e2 ??= {}, e2._zod.def = t3, e2._zod.bag = e2._zod.bag || {}, e2._zod.version = Ot2;
  let r2 = [...e2._zod.def.checks ?? []];
  e2._zod.traits.has("$ZodCheck") && r2.unshift(e2);
  for (let t4 of r2) for (let n4 of t4._zod.onattach) n4(e2);
  if (r2.length === 0) (n3 = e2._zod).deferred ?? (n3.deferred = []), e2._zod.deferred?.push(() => {
    e2._zod.run = e2._zod.parse;
  });
  else {
    let t4 = (e3, t5, n5) => {
      let r3 = k2(e3), i4;
      for (let a3 of t5) {
        if (a3._zod.def.when) {
          if (!a3._zod.def.when(e3)) continue;
        } else if (r3) continue;
        let t6 = e3.issues.length, o3 = a3._zod.check(e3);
        if (o3 instanceof Promise && n5?.async === false) throw new _2();
        if (i4 || o3 instanceof Promise) i4 = (i4 ?? Promise.resolve()).then(async () => {
          await o3, e3.issues.length !== t6 && (r3 ||= k2(e3, t6));
        });
        else {
          if (e3.issues.length === t6) continue;
          r3 ||= k2(e3, t6);
        }
      }
      return i4 ? i4.then(() => e3) : e3;
    }, n4 = (n5, i4, a3) => {
      if (k2(n5)) return n5.aborted = true, n5;
      let o3 = t4(i4, r2, a3);
      if (o3 instanceof Promise) {
        if (a3.async === false) throw new _2();
        return o3.then((t5) => e2._zod.parse(t5, a3));
      }
      return e2._zod.parse(o3, a3);
    };
    e2._zod.run = (i4, a3) => {
      if (a3.skipChecks) return e2._zod.parse(i4, a3);
      if (a3.direction === "backward") {
        let t5 = e2._zod.parse({
          value: i4.value,
          issues: []
        }, {
          ...a3,
          skipChecks: true
        });
        return t5 instanceof Promise ? t5.then((e3) => n4(e3, i4, a3)) : n4(t5, i4, a3);
      }
      let o3 = e2._zod.parse(i4, a3);
      if (o3 instanceof Promise) {
        if (a3.async === false) throw new _2();
        return o3.then((e3) => t4(e3, r2, a3));
      }
      return t4(o3, r2, a3);
    };
  }
  e2["~standard"] = {
    validate: (t4) => {
      try {
        let n4 = Ne2(e2, t4);
        return n4.success ? { value: n4.data } : { issues: n4.error?.issues };
      } catch {
        return Pe2(e2, t4).then((e3) => e3.success ? { value: e3.data } : { issues: e3.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  };
});
var z2 = /* @__PURE__ */ g2("$ZodString", (e2, t3) => {
  R2.init(e2, t3), e2._zod.pattern = [...e2?._zod.bag?.patterns ?? []].pop() ?? mt2(e2._zod.bag), e2._zod.parse = (n3, r2) => {
    if (t3.coerce) try {
      n3.value = String(n3.value);
    } catch {
    }
    return typeof n3.value == "string" || n3.issues.push({
      expected: "string",
      code: "invalid_type",
      input: n3.value,
      inst: e2
    }), n3;
  };
});
var B2 = /* @__PURE__ */ g2("$ZodStringFormat", (e2, t3) => {
  L2.init(e2, t3), z2.init(e2, t3);
});
var kt2 = /* @__PURE__ */ g2("$ZodGUID", (e2, t3) => {
  t3.pattern ??= Xe2, B2.init(e2, t3);
});
var At2 = /* @__PURE__ */ g2("$ZodUUID", (e2, t3) => {
  if (t3.version) {
    let e3 = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[t3.version];
    if (e3 === void 0) throw Error(`Invalid UUID version: "${t3.version}"`);
    t3.pattern ??= Ze2(e3);
  } else t3.pattern ??= Ze2();
  B2.init(e2, t3);
});
var jt2 = /* @__PURE__ */ g2("$ZodEmail", (e2, t3) => {
  t3.pattern ??= Qe2, B2.init(e2, t3);
});
var Mt2 = /* @__PURE__ */ g2("$ZodURL", (e2, t3) => {
  B2.init(e2, t3), e2._zod.check = (n3) => {
    try {
      let r2 = n3.value.trim(), i4 = new URL(r2);
      t3.hostname && (t3.hostname.lastIndex = 0, t3.hostname.test(i4.hostname) || n3.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: st2.source,
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      })), t3.protocol && (t3.protocol.lastIndex = 0, t3.protocol.test(i4.protocol.endsWith(":") ? i4.protocol.slice(0, -1) : i4.protocol) || n3.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t3.protocol.source,
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      })), t3.normalize ? n3.value = i4.href : n3.value = r2;
      return;
    } catch {
      n3.issues.push({
        code: "invalid_format",
        format: "url",
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      });
    }
  };
});
var Nt2 = /* @__PURE__ */ g2("$ZodEmoji", (e2, t3) => {
  t3.pattern ??= et2(), B2.init(e2, t3);
});
var Pt2 = /* @__PURE__ */ g2("$ZodNanoID", (e2, t3) => {
  t3.pattern ??= Je2, B2.init(e2, t3);
});
var Ft2 = /* @__PURE__ */ g2("$ZodCUID", (e2, t3) => {
  t3.pattern ??= Ue2, B2.init(e2, t3);
});
var It2 = /* @__PURE__ */ g2("$ZodCUID2", (e2, t3) => {
  t3.pattern ??= We2, B2.init(e2, t3);
});
var Lt2 = /* @__PURE__ */ g2("$ZodULID", (e2, t3) => {
  t3.pattern ??= Ge2, B2.init(e2, t3);
});
var Rt2 = /* @__PURE__ */ g2("$ZodXID", (e2, t3) => {
  t3.pattern ??= Ke2, B2.init(e2, t3);
});
var zt2 = /* @__PURE__ */ g2("$ZodKSUID", (e2, t3) => {
  t3.pattern ??= qe2, B2.init(e2, t3);
});
var Bt2 = /* @__PURE__ */ g2("$ZodISODateTime", (e2, t3) => {
  t3.pattern ??= pt2(t3), B2.init(e2, t3);
});
var Vt2 = /* @__PURE__ */ g2("$ZodISODate", (e2, t3) => {
  t3.pattern ??= ut2, B2.init(e2, t3);
});
var Ht2 = /* @__PURE__ */ g2("$ZodISOTime", (e2, t3) => {
  t3.pattern ??= ft2(t3), B2.init(e2, t3);
});
var Ut2 = /* @__PURE__ */ g2("$ZodISODuration", (e2, t3) => {
  t3.pattern ??= Ye2, B2.init(e2, t3);
});
var Wt2 = /* @__PURE__ */ g2("$ZodIPv4", (e2, t3) => {
  t3.pattern ??= tt2, B2.init(e2, t3), e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.format = "ipv4";
  });
});
var Gt2 = /* @__PURE__ */ g2("$ZodIPv6", (e2, t3) => {
  t3.pattern ??= nt2, B2.init(e2, t3), e2._zod.onattach.push((e3) => {
    let t4 = e3._zod.bag;
    t4.format = "ipv6";
  }), e2._zod.check = (n3) => {
    try {
      new URL(`http://[${n3.value}]`);
    } catch {
      n3.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      });
    }
  };
});
var Kt2 = /* @__PURE__ */ g2("$ZodCIDRv4", (e2, t3) => {
  t3.pattern ??= rt2, B2.init(e2, t3);
});
var qt2 = /* @__PURE__ */ g2("$ZodCIDRv6", (e2, t3) => {
  t3.pattern ??= it2, B2.init(e2, t3), e2._zod.check = (n3) => {
    let r2 = n3.value.split("/");
    try {
      if (r2.length !== 2) throw Error();
      let [e3, t4] = r2;
      if (!t4) throw Error();
      let n4 = Number(t4);
      if (`${n4}` !== t4 || n4 < 0 || n4 > 128) throw Error();
      new URL(`http://[${e3}]`);
    } catch {
      n3.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n3.value,
        inst: e2,
        continue: !t3.abort
      });
    }
  };
});
function Jt2(e2) {
  if (e2 === "") return true;
  if (e2.length % 4 != 0) return false;
  try {
    return atob(e2), true;
  } catch {
    return false;
  }
}
var Yt2 = /* @__PURE__ */ g2("$ZodBase64", (e2, t3) => {
  t3.pattern ??= at2, B2.init(e2, t3), e2._zod.onattach.push((e3) => {
    e3._zod.bag.contentEncoding = "base64";
  }), e2._zod.check = (n3) => {
    Jt2(n3.value) || n3.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n3.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
function Xt2(e2) {
  if (!ot2.test(e2)) return false;
  let t3 = e2.replace(/[-_]/g, (e3) => e3 === "-" ? "+" : "/");
  return Jt2(t3.padEnd(Math.ceil(t3.length / 4) * 4, "="));
}
var Zt2 = /* @__PURE__ */ g2("$ZodBase64URL", (e2, t3) => {
  t3.pattern ??= ot2, B2.init(e2, t3), e2._zod.onattach.push((e3) => {
    e3._zod.bag.contentEncoding = "base64url";
  }), e2._zod.check = (n3) => {
    Xt2(n3.value) || n3.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n3.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var Qt2 = /* @__PURE__ */ g2("$ZodE164", (e2, t3) => {
  t3.pattern ??= ct2, B2.init(e2, t3);
});
function $t2(e2, t3 = null) {
  try {
    let n3 = e2.split(".");
    if (n3.length !== 3) return false;
    let [r2] = n3;
    if (!r2) return false;
    let i4 = JSON.parse(atob(r2));
    return !("typ" in i4 && i4?.typ !== "JWT" || !i4.alg || t3 && (!("alg" in i4) || i4.alg !== t3));
  } catch {
    return false;
  }
}
var en2 = /* @__PURE__ */ g2("$ZodJWT", (e2, t3) => {
  B2.init(e2, t3), e2._zod.check = (n3) => {
    $t2(n3.value, t3.alg) || n3.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n3.value,
      inst: e2,
      continue: !t3.abort
    });
  };
});
var tn2 = /* @__PURE__ */ g2("$ZodUnknown", (e2, t3) => {
  R2.init(e2, t3), e2._zod.parse = (e3) => e3;
});
var nn2 = /* @__PURE__ */ g2("$ZodNever", (e2, t3) => {
  R2.init(e2, t3), e2._zod.parse = (t4, n3) => (t4.issues.push({
    expected: "never",
    code: "invalid_type",
    input: t4.value,
    inst: e2
  }), t4);
});
function rn2(e2, t3, n3) {
  e2.issues.length && t3.issues.push(...Te2(n3, e2.issues)), t3.value[n3] = e2.value;
}
var an2 = /* @__PURE__ */ g2("$ZodArray", (e2, t3) => {
  R2.init(e2, t3), e2._zod.parse = (n3, r2) => {
    let i4 = n3.value;
    if (!Array.isArray(i4)) return n3.issues.push({
      expected: "array",
      code: "invalid_type",
      input: i4,
      inst: e2
    }), n3;
    n3.value = Array(i4.length);
    let a3 = [];
    for (let e3 = 0; e3 < i4.length; e3++) {
      let o3 = i4[e3], s3 = t3.element._zod.run({
        value: o3,
        issues: []
      }, r2);
      s3 instanceof Promise ? a3.push(s3.then((t4) => rn2(t4, n3, e3))) : rn2(s3, n3, e3);
    }
    return a3.length ? Promise.all(a3).then(() => n3) : n3;
  };
});
function V2(e2, t3, n3, r2) {
  e2.issues.length && t3.issues.push(...Te2(n3, e2.issues)), e2.value === void 0 ? n3 in r2 && (t3.value[n3] = void 0) : t3.value[n3] = e2.value;
}
function on2(e2) {
  let t3 = Object.keys(e2.shape);
  for (let n4 of t3) if (!e2.shape?.[n4]?._zod?.traits?.has("$ZodType")) throw Error(`Invalid element at key "${n4}": expected a Zod schema`);
  let n3 = _e2(e2.shape);
  return {
    ...e2,
    keys: t3,
    keySet: new Set(t3),
    numKeys: t3.length,
    optionalKeys: new Set(n3)
  };
}
function sn2(e2, t3, n3, r2, i4, a3) {
  let o3 = [], s3 = i4.keySet, c3 = i4.catchall._zod, l4 = c3.def.type;
  for (let i5 of Object.keys(t3)) {
    if (s3.has(i5)) continue;
    if (l4 === "never") {
      o3.push(i5);
      continue;
    }
    let a4 = c3.run({
      value: t3[i5],
      issues: []
    }, r2);
    a4 instanceof Promise ? e2.push(a4.then((e3) => V2(e3, n3, i5, t3))) : V2(a4, n3, i5, t3);
  }
  return o3.length && n3.issues.push({
    code: "unrecognized_keys",
    keys: o3,
    input: t3,
    inst: a3
  }), e2.length ? Promise.all(e2).then(() => n3) : n3;
}
var cn2 = /* @__PURE__ */ g2("$ZodObject", (e2, t3) => {
  if (R2.init(e2, t3), !Object.getOwnPropertyDescriptor(t3, "shape")?.get) {
    let e3 = t3.shape;
    Object.defineProperty(t3, "shape", { get: () => {
      let n4 = { ...e3 };
      return Object.defineProperty(t3, "shape", { value: n4 }), n4;
    } });
  }
  let n3 = le2(() => on2(t3));
  x2(e2._zod, "propValues", () => {
    let e3 = t3.shape, n4 = {};
    for (let t4 in e3) {
      let r3 = e3[t4]._zod;
      if (r3.values) {
        n4[t4] ?? (n4[t4] = /* @__PURE__ */ new Set());
        for (let e4 of r3.values) n4[t4].add(e4);
      }
    }
    return n4;
  });
  let r2 = w2, i4 = t3.catchall, a3;
  e2._zod.parse = (t4, o3) => {
    a3 ??= n3.value;
    let s3 = t4.value;
    if (!r2(s3)) return t4.issues.push({
      expected: "object",
      code: "invalid_type",
      input: s3,
      inst: e2
    }), t4;
    t4.value = {};
    let c3 = [], l4 = a3.shape;
    for (let e3 of a3.keys) {
      let n4 = l4[e3]._zod.run({
        value: s3[e3],
        issues: []
      }, o3);
      n4 instanceof Promise ? c3.push(n4.then((n5) => V2(n5, t4, e3, s3))) : V2(n4, t4, e3, s3);
    }
    return i4 ? sn2(c3, s3, t4, o3, n3.value, e2) : c3.length ? Promise.all(c3).then(() => t4) : t4;
  };
});
var ln2 = /* @__PURE__ */ g2("$ZodObjectJIT", (e2, t3) => {
  cn2.init(e2, t3);
  let n3 = e2._zod.parse, r2 = le2(() => on2(t3)), i4 = (e3) => {
    let t4 = new Dt2([
      "shape",
      "payload",
      "ctx"
    ]), n4 = r2.value, i5 = (e4) => {
      let t5 = fe2(e4);
      return `shape[${t5}]._zod.run({ value: input[${t5}], issues: [] }, ctx)`;
    };
    t4.write("const input = payload.value;");
    let a4 = /* @__PURE__ */ Object.create(null), o4 = 0;
    for (let e4 of n4.keys) a4[e4] = `key_${o4++}`;
    t4.write("const newResult = {};");
    for (let e4 of n4.keys) {
      let n5 = a4[e4], r3 = fe2(e4);
      t4.write(`const ${n5} = ${i5(e4)};`), t4.write(`
        if (${n5}.issues.length) {
          payload.issues = payload.issues.concat(${n5}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${r3}, ...iss.path] : [${r3}]
          })));
        }
        
        
        if (${n5}.value === undefined) {
          if (${r3} in input) {
            newResult[${r3}] = undefined;
          }
        } else {
          newResult[${r3}] = ${n5}.value;
        }
        
      `);
    }
    t4.write("payload.value = newResult;"), t4.write("return payload;");
    let s4 = t4.compile();
    return (t5, n5) => s4(e3, t5, n5);
  }, a3, o3 = w2, s3 = !se2.jitless, c3 = s3 && me2.value, l4 = t3.catchall, u4;
  e2._zod.parse = (d2, f2) => {
    u4 ??= r2.value;
    let p2 = d2.value;
    return o3(p2) ? s3 && c3 && f2?.async === false && f2.jitless !== true ? (a3 ||= i4(t3.shape), d2 = a3(d2, f2), l4 ? sn2([], p2, d2, f2, u4, e2) : d2) : n3(d2, f2) : (d2.issues.push({
      expected: "object",
      code: "invalid_type",
      input: p2,
      inst: e2
    }), d2);
  };
});
function un2(e2, t3, n3, r2) {
  for (let n4 of e2) if (n4.issues.length === 0) return t3.value = n4.value, t3;
  let i4 = e2.filter((e3) => !k2(e3));
  return i4.length === 1 ? (t3.value = i4[0].value, i4[0]) : (t3.issues.push({
    code: "invalid_union",
    input: t3.value,
    inst: n3,
    errors: e2.map((e3) => e3.issues.map((e4) => j2(e4, r2, v2())))
  }), t3);
}
var dn2 = /* @__PURE__ */ g2("$ZodUnion", (e2, t3) => {
  R2.init(e2, t3), x2(e2._zod, "optin", () => t3.options.some((e3) => e3._zod.optin === "optional") ? "optional" : void 0), x2(e2._zod, "optout", () => t3.options.some((e3) => e3._zod.optout === "optional") ? "optional" : void 0), x2(e2._zod, "values", () => {
    if (t3.options.every((e3) => e3._zod.values)) return new Set(t3.options.flatMap((e3) => Array.from(e3._zod.values)));
  }), x2(e2._zod, "pattern", () => {
    if (t3.options.every((e3) => e3._zod.pattern)) {
      let e3 = t3.options.map((e4) => e4._zod.pattern);
      return RegExp(`^(${e3.map((e4) => b2(e4.source)).join("|")})$`);
    }
  });
  let n3 = t3.options.length === 1, r2 = t3.options[0]._zod.run;
  e2._zod.parse = (i4, a3) => {
    if (n3) return r2(i4, a3);
    let o3 = false, s3 = [];
    for (let e3 of t3.options) {
      let t4 = e3._zod.run({
        value: i4.value,
        issues: []
      }, a3);
      if (t4 instanceof Promise) s3.push(t4), o3 = true;
      else {
        if (t4.issues.length === 0) return t4;
        s3.push(t4);
      }
    }
    return o3 ? Promise.all(s3).then((t4) => un2(t4, i4, e2, a3)) : un2(s3, i4, e2, a3);
  };
});
var fn2 = /* @__PURE__ */ g2("$ZodIntersection", (e2, t3) => {
  R2.init(e2, t3), e2._zod.parse = (e3, n3) => {
    let r2 = e3.value, i4 = t3.left._zod.run({
      value: r2,
      issues: []
    }, n3), a3 = t3.right._zod.run({
      value: r2,
      issues: []
    }, n3);
    return i4 instanceof Promise || a3 instanceof Promise ? Promise.all([i4, a3]).then(([t4, n4]) => mn2(e3, t4, n4)) : mn2(e3, i4, a3);
  };
});
function pn2(e2, t3) {
  if (e2 === t3 || e2 instanceof Date && t3 instanceof Date && +e2 == +t3) return {
    valid: true,
    data: e2
  };
  if (T2(e2) && T2(t3)) {
    let n3 = Object.keys(t3), r2 = Object.keys(e2).filter((e3) => n3.indexOf(e3) !== -1), i4 = {
      ...e2,
      ...t3
    };
    for (let n4 of r2) {
      let r3 = pn2(e2[n4], t3[n4]);
      if (!r3.valid) return {
        valid: false,
        mergeErrorPath: [n4, ...r3.mergeErrorPath]
      };
      i4[n4] = r3.data;
    }
    return {
      valid: true,
      data: i4
    };
  }
  if (Array.isArray(e2) && Array.isArray(t3)) {
    if (e2.length !== t3.length) return {
      valid: false,
      mergeErrorPath: []
    };
    let n3 = [];
    for (let r2 = 0; r2 < e2.length; r2++) {
      let i4 = e2[r2], a3 = t3[r2], o3 = pn2(i4, a3);
      if (!o3.valid) return {
        valid: false,
        mergeErrorPath: [r2, ...o3.mergeErrorPath]
      };
      n3.push(o3.data);
    }
    return {
      valid: true,
      data: n3
    };
  }
  return {
    valid: false,
    mergeErrorPath: []
  };
}
function mn2(e2, t3, n3) {
  if (t3.issues.length && e2.issues.push(...t3.issues), n3.issues.length && e2.issues.push(...n3.issues), k2(e2)) return e2;
  let r2 = pn2(t3.value, n3.value);
  if (!r2.valid) throw Error(`Unmergable intersection. Error path: ${JSON.stringify(r2.mergeErrorPath)}`);
  return e2.value = r2.data, e2;
}
var hn2 = /* @__PURE__ */ g2("$ZodEnum", (e2, t3) => {
  R2.init(e2, t3);
  let n3 = ce2(t3.entries), r2 = new Set(n3);
  e2._zod.values = r2, e2._zod.pattern = RegExp(`^(${n3.filter((e3) => ge2.has(typeof e3)).map((e3) => typeof e3 == "string" ? E2(e3) : e3.toString()).join("|")})$`), e2._zod.parse = (t4, i4) => {
    let a3 = t4.value;
    return r2.has(a3) || t4.issues.push({
      code: "invalid_value",
      values: n3,
      input: a3,
      inst: e2
    }), t4;
  };
});
var gn2 = /* @__PURE__ */ g2("$ZodTransform", (e2, t3) => {
  R2.init(e2, t3), e2._zod.parse = (n3, r2) => {
    if (r2.direction === "backward") throw new oe2(e2.constructor.name);
    let i4 = t3.transform(n3.value, n3);
    if (r2.async) return (i4 instanceof Promise ? i4 : Promise.resolve(i4)).then((e3) => (n3.value = e3, n3));
    if (i4 instanceof Promise) throw new _2();
    return n3.value = i4, n3;
  };
});
function _n2(e2, t3) {
  return e2.issues.length && t3 === void 0 ? {
    issues: [],
    value: void 0
  } : e2;
}
var vn2 = /* @__PURE__ */ g2("$ZodOptional", (e2, t3) => {
  R2.init(e2, t3), e2._zod.optin = "optional", e2._zod.optout = "optional", x2(e2._zod, "values", () => t3.innerType._zod.values ? /* @__PURE__ */ new Set([...t3.innerType._zod.values, void 0]) : void 0), x2(e2._zod, "pattern", () => {
    let e3 = t3.innerType._zod.pattern;
    return e3 ? RegExp(`^(${b2(e3.source)})?$`) : void 0;
  }), e2._zod.parse = (e3, n3) => {
    if (t3.innerType._zod.optin === "optional") {
      let r2 = t3.innerType._zod.run(e3, n3);
      return r2 instanceof Promise ? r2.then((t4) => _n2(t4, e3.value)) : _n2(r2, e3.value);
    }
    return e3.value === void 0 ? e3 : t3.innerType._zod.run(e3, n3);
  };
});
var yn2 = /* @__PURE__ */ g2("$ZodNullable", (e2, t3) => {
  R2.init(e2, t3), x2(e2._zod, "optin", () => t3.innerType._zod.optin), x2(e2._zod, "optout", () => t3.innerType._zod.optout), x2(e2._zod, "pattern", () => {
    let e3 = t3.innerType._zod.pattern;
    return e3 ? RegExp(`^(${b2(e3.source)}|null)$`) : void 0;
  }), x2(e2._zod, "values", () => t3.innerType._zod.values ? /* @__PURE__ */ new Set([...t3.innerType._zod.values, null]) : void 0), e2._zod.parse = (e3, n3) => e3.value === null ? e3 : t3.innerType._zod.run(e3, n3);
});
var bn2 = /* @__PURE__ */ g2("$ZodDefault", (e2, t3) => {
  R2.init(e2, t3), e2._zod.optin = "optional", x2(e2._zod, "values", () => t3.innerType._zod.values), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") return t3.innerType._zod.run(e3, n3);
    if (e3.value === void 0) return e3.value = t3.defaultValue, e3;
    let r2 = t3.innerType._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then((e4) => xn2(e4, t3)) : xn2(r2, t3);
  };
});
function xn2(e2, t3) {
  return e2.value === void 0 && (e2.value = t3.defaultValue), e2;
}
var Sn2 = /* @__PURE__ */ g2("$ZodPrefault", (e2, t3) => {
  R2.init(e2, t3), e2._zod.optin = "optional", x2(e2._zod, "values", () => t3.innerType._zod.values), e2._zod.parse = (e3, n3) => (n3.direction === "backward" || e3.value === void 0 && (e3.value = t3.defaultValue), t3.innerType._zod.run(e3, n3));
});
var Cn2 = /* @__PURE__ */ g2("$ZodNonOptional", (e2, t3) => {
  R2.init(e2, t3), x2(e2._zod, "values", () => {
    let e3 = t3.innerType._zod.values;
    return e3 ? new Set([...e3].filter((e4) => e4 !== void 0)) : void 0;
  }), e2._zod.parse = (n3, r2) => {
    let i4 = t3.innerType._zod.run(n3, r2);
    return i4 instanceof Promise ? i4.then((t4) => wn2(t4, e2)) : wn2(i4, e2);
  };
});
function wn2(e2, t3) {
  return !e2.issues.length && e2.value === void 0 && e2.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e2.value,
    inst: t3
  }), e2;
}
var Tn2 = /* @__PURE__ */ g2("$ZodCatch", (e2, t3) => {
  R2.init(e2, t3), x2(e2._zod, "optin", () => t3.innerType._zod.optin), x2(e2._zod, "optout", () => t3.innerType._zod.optout), x2(e2._zod, "values", () => t3.innerType._zod.values), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") return t3.innerType._zod.run(e3, n3);
    let r2 = t3.innerType._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then((r3) => (e3.value = r3.value, r3.issues.length && (e3.value = t3.catchValue({
      ...e3,
      error: { issues: r3.issues.map((e4) => j2(e4, n3, v2())) },
      input: e3.value
    }), e3.issues = []), e3)) : (e3.value = r2.value, r2.issues.length && (e3.value = t3.catchValue({
      ...e3,
      error: { issues: r2.issues.map((e4) => j2(e4, n3, v2())) },
      input: e3.value
    }), e3.issues = []), e3);
  };
});
var En2 = /* @__PURE__ */ g2("$ZodPipe", (e2, t3) => {
  R2.init(e2, t3), x2(e2._zod, "values", () => t3.in._zod.values), x2(e2._zod, "optin", () => t3.in._zod.optin), x2(e2._zod, "optout", () => t3.out._zod.optout), x2(e2._zod, "propValues", () => t3.in._zod.propValues), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") {
      let r3 = t3.out._zod.run(e3, n3);
      return r3 instanceof Promise ? r3.then((e4) => H2(e4, t3.in, n3)) : H2(r3, t3.in, n3);
    }
    let r2 = t3.in._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then((e4) => H2(e4, t3.out, n3)) : H2(r2, t3.out, n3);
  };
});
function H2(e2, t3, n3) {
  return e2.issues.length ? (e2.aborted = true, e2) : t3._zod.run({
    value: e2.value,
    issues: e2.issues
  }, n3);
}
var Dn2 = /* @__PURE__ */ g2("$ZodReadonly", (e2, t3) => {
  R2.init(e2, t3), x2(e2._zod, "propValues", () => t3.innerType._zod.propValues), x2(e2._zod, "values", () => t3.innerType._zod.values), x2(e2._zod, "optin", () => t3.innerType._zod.optin), x2(e2._zod, "optout", () => t3.innerType._zod.optout), e2._zod.parse = (e3, n3) => {
    if (n3.direction === "backward") return t3.innerType._zod.run(e3, n3);
    let r2 = t3.innerType._zod.run(e3, n3);
    return r2 instanceof Promise ? r2.then(On2) : On2(r2);
  };
});
function On2(e2) {
  return e2.value = Object.freeze(e2.value), e2;
}
var kn2 = /* @__PURE__ */ g2("$ZodCustom", (e2, t3) => {
  I2.init(e2, t3), R2.init(e2, t3), e2._zod.parse = (e3, t4) => e3, e2._zod.check = (n3) => {
    let r2 = n3.value, i4 = t3.fn(r2);
    if (i4 instanceof Promise) return i4.then((t4) => An2(t4, n3, r2, e2));
    An2(i4, n3, r2, e2);
  };
});
function An2(e2, t3, n3, r2) {
  if (!e2) {
    let e3 = {
      code: "custom",
      input: n3,
      inst: r2,
      path: [...r2._zod.def.path ?? []],
      continue: !r2._zod.def.abort
    };
    r2._zod.def.params && (e3.params = r2._zod.def.params), t3.issues.push(N2(e3));
  }
}
var jn2 = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(e2, ...t3) {
    let n3 = t3[0];
    if (this._map.set(e2, n3), n3 && typeof n3 == "object" && "id" in n3) {
      if (this._idmap.has(n3.id)) throw Error(`ID ${n3.id} already exists in the registry`);
      this._idmap.set(n3.id, e2);
    }
    return this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(e2) {
    let t3 = this._map.get(e2);
    return t3 && typeof t3 == "object" && "id" in t3 && this._idmap.delete(t3.id), this._map.delete(e2), this;
  }
  get(e2) {
    let t3 = e2._zod.parent;
    if (t3) {
      let n3 = { ...this.get(t3) ?? {} };
      delete n3.id;
      let r2 = {
        ...n3,
        ...this._map.get(e2)
      };
      return Object.keys(r2).length ? r2 : void 0;
    }
    return this._map.get(e2);
  }
  has(e2) {
    return this._map.has(e2);
  }
};
function Mn2() {
  return new jn2();
}
var U2 = /* @__PURE__ */ Mn2();
function Nn2(e2, t3) {
  return new e2({
    type: "string",
    ...O2(t3)
  });
}
function Pn2(e2, t3) {
  return new e2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Fn2(e2, t3) {
  return new e2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function In2(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Ln2(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...O2(t3)
  });
}
function Rn2(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...O2(t3)
  });
}
function zn2(e2, t3) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...O2(t3)
  });
}
function Bn2(e2, t3) {
  return new e2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Vn2(e2, t3) {
  return new e2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Hn2(e2, t3) {
  return new e2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Un2(e2, t3) {
  return new e2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Wn2(e2, t3) {
  return new e2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Gn2(e2, t3) {
  return new e2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Kn2(e2, t3) {
  return new e2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function qn2(e2, t3) {
  return new e2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Jn2(e2, t3) {
  return new e2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Yn2(e2, t3) {
  return new e2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Xn2(e2, t3) {
  return new e2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Zn2(e2, t3) {
  return new e2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function Qn2(e2, t3) {
  return new e2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function $n2(e2, t3) {
  return new e2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function er2(e2, t3) {
  return new e2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function tr2(e2, t3) {
  return new e2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...O2(t3)
  });
}
function nr2(e2, t3) {
  return new e2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...O2(t3)
  });
}
function rr2(e2, t3) {
  return new e2({
    type: "string",
    format: "date",
    check: "string_format",
    ...O2(t3)
  });
}
function ir2(e2, t3) {
  return new e2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...O2(t3)
  });
}
function ar2(e2, t3) {
  return new e2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...O2(t3)
  });
}
function or2(e2) {
  return new e2({ type: "unknown" });
}
function sr2(e2, t3) {
  return new e2({
    type: "never",
    ...O2(t3)
  });
}
function cr2(e2, t3) {
  return new _t2({
    check: "max_length",
    ...O2(t3),
    maximum: e2
  });
}
function W2(e2, t3) {
  return new vt2({
    check: "min_length",
    ...O2(t3),
    minimum: e2
  });
}
function lr2(e2, t3) {
  return new yt2({
    check: "length_equals",
    ...O2(t3),
    length: e2
  });
}
function ur2(e2, t3) {
  return new bt2({
    check: "string_format",
    format: "regex",
    ...O2(t3),
    pattern: e2
  });
}
function dr2(e2) {
  return new xt2({
    check: "string_format",
    format: "lowercase",
    ...O2(e2)
  });
}
function fr2(e2) {
  return new St2({
    check: "string_format",
    format: "uppercase",
    ...O2(e2)
  });
}
function pr2(e2, t3) {
  return new Ct2({
    check: "string_format",
    format: "includes",
    ...O2(t3),
    includes: e2
  });
}
function mr2(e2, t3) {
  return new wt2({
    check: "string_format",
    format: "starts_with",
    ...O2(t3),
    prefix: e2
  });
}
function hr2(e2, t3) {
  return new Tt2({
    check: "string_format",
    format: "ends_with",
    ...O2(t3),
    suffix: e2
  });
}
function G2(e2) {
  return new Et2({
    check: "overwrite",
    tx: e2
  });
}
function gr2(e2) {
  return G2((t3) => t3.normalize(e2));
}
function _r2() {
  return G2((e2) => e2.trim());
}
function vr2() {
  return G2((e2) => e2.toLowerCase());
}
function yr2() {
  return G2((e2) => e2.toUpperCase());
}
function br2(e2, t3, n3) {
  return new e2({
    type: "array",
    element: t3,
    ...O2(n3)
  });
}
function xr2(e2, t3, n3) {
  return new e2({
    type: "custom",
    check: "custom",
    fn: t3,
    ...O2(n3)
  });
}
function Sr2(e2) {
  let t3 = Cr2((n3) => (n3.addIssue = (e3) => {
    if (typeof e3 == "string") n3.issues.push(N2(e3, n3.value, t3._zod.def));
    else {
      let r2 = e3;
      r2.fatal && (r2.continue = false), r2.code ??= "custom", r2.input ??= n3.value, r2.inst ??= t3, r2.continue ??= !t3._zod.def.abort, n3.issues.push(N2(r2));
    }
  }, e2(n3.value, n3)));
  return t3;
}
function Cr2(e2, t3) {
  let n3 = new I2({
    check: "custom",
    ...O2(t3)
  });
  return n3._zod.check = e2, n3;
}
var wr2 = /* @__PURE__ */ g2("ZodISODateTime", (e2, t3) => {
  Bt2.init(e2, t3), J2.init(e2, t3);
});
function Tr2(e2) {
  return nr2(wr2, e2);
}
var Er2 = /* @__PURE__ */ g2("ZodISODate", (e2, t3) => {
  Vt2.init(e2, t3), J2.init(e2, t3);
});
function Dr2(e2) {
  return rr2(Er2, e2);
}
var Or2 = /* @__PURE__ */ g2("ZodISOTime", (e2, t3) => {
  Ht2.init(e2, t3), J2.init(e2, t3);
});
function kr2(e2) {
  return ir2(Or2, e2);
}
var Ar2 = /* @__PURE__ */ g2("ZodISODuration", (e2, t3) => {
  Ut2.init(e2, t3), J2.init(e2, t3);
});
function jr2(e2) {
  return ar2(Ar2, e2);
}
var Mr2 = (e2, t3) => {
  De2.init(e2, t3), e2.name = "ZodError", Object.defineProperties(e2, {
    format: { value: (t4) => Ae2(e2, t4) },
    flatten: { value: (t4) => ke2(e2, t4) },
    addIssue: { value: (t4) => {
      e2.issues.push(t4), e2.message = JSON.stringify(e2.issues, y2, 2);
    } },
    addIssues: { value: (t4) => {
      e2.issues.push(...t4), e2.message = JSON.stringify(e2.issues, y2, 2);
    } },
    isEmpty: { get() {
      return e2.issues.length === 0;
    } }
  });
};
g2("ZodError", Mr2);
var K2 = g2("ZodError", Mr2, { Parent: Error });
var Nr2 = /* @__PURE__ */ je2(K2);
var Pr2 = /* @__PURE__ */ Me2(K2);
var Fr2 = /* @__PURE__ */ P2(K2);
var Ir2 = /* @__PURE__ */ F2(K2);
var Lr2 = /* @__PURE__ */ Fe2(K2);
var Rr2 = /* @__PURE__ */ Ie2(K2);
var zr2 = /* @__PURE__ */ Le2(K2);
var Br2 = /* @__PURE__ */ Re2(K2);
var Vr2 = /* @__PURE__ */ ze2(K2);
var Hr2 = /* @__PURE__ */ Be2(K2);
var Ur2 = /* @__PURE__ */ Ve2(K2);
var Wr2 = /* @__PURE__ */ He2(K2);
var q2 = /* @__PURE__ */ g2("ZodType", (e2, t3) => (R2.init(e2, t3), e2.def = t3, e2.type = t3.type, Object.defineProperty(e2, "_def", { value: t3 }), e2.check = (...n3) => e2.clone(C2(t3, { checks: [...t3.checks ?? [], ...n3.map((e3) => typeof e3 == "function" ? { _zod: {
  check: e3,
  def: { check: "custom" },
  onattach: []
} } : e3)] })), e2.clone = (t4, n3) => D2(e2, t4, n3), e2.brand = () => e2, e2.register = ((t4, n3) => (t4.add(e2, n3), e2)), e2.parse = (t4, n3) => Nr2(e2, t4, n3, { callee: e2.parse }), e2.safeParse = (t4, n3) => Fr2(e2, t4, n3), e2.parseAsync = async (t4, n3) => Pr2(e2, t4, n3, { callee: e2.parseAsync }), e2.safeParseAsync = async (t4, n3) => Ir2(e2, t4, n3), e2.spa = e2.safeParseAsync, e2.encode = (t4, n3) => Lr2(e2, t4, n3), e2.decode = (t4, n3) => Rr2(e2, t4, n3), e2.encodeAsync = async (t4, n3) => zr2(e2, t4, n3), e2.decodeAsync = async (t4, n3) => Br2(e2, t4, n3), e2.safeEncode = (t4, n3) => Vr2(e2, t4, n3), e2.safeDecode = (t4, n3) => Hr2(e2, t4, n3), e2.safeEncodeAsync = async (t4, n3) => Ur2(e2, t4, n3), e2.safeDecodeAsync = async (t4, n3) => Wr2(e2, t4, n3), e2.refine = (t4, n3) => e2.check(Gi2(t4, n3)), e2.superRefine = (t4) => e2.check(Ki2(t4)), e2.overwrite = (t4) => e2.check(G2(t4)), e2.optional = () => ki2(e2), e2.nullable = () => ji2(e2), e2.nullish = () => ki2(ji2(e2)), e2.nonoptional = (t4) => Li2(e2, t4), e2.array = () => _i2(e2), e2.or = (t4) => xi2([e2, t4]), e2.and = (t4) => Ci2(e2, t4), e2.transform = (t4) => Vi2(e2, Di2(t4)), e2.default = (t4) => Ni2(e2, t4), e2.prefault = (t4) => Fi2(e2, t4), e2.catch = (t4) => zi2(e2, t4), e2.pipe = (t4) => Vi2(e2, t4), e2.readonly = () => Ui2(e2), e2.describe = (t4) => {
  let n3 = e2.clone();
  return U2.add(n3, { description: t4 }), n3;
}, Object.defineProperty(e2, "description", {
  get() {
    return U2.get(e2)?.description;
  },
  configurable: true
}), e2.meta = (...t4) => {
  if (t4.length === 0) return U2.get(e2);
  let n3 = e2.clone();
  return U2.add(n3, t4[0]), n3;
}, e2.isOptional = () => e2.safeParse(void 0).success, e2.isNullable = () => e2.safeParse(null).success, e2));
var Gr2 = /* @__PURE__ */ g2("_ZodString", (e2, t3) => {
  z2.init(e2, t3), q2.init(e2, t3);
  let n3 = e2._zod.bag;
  e2.format = n3.format ?? null, e2.minLength = n3.minimum ?? null, e2.maxLength = n3.maximum ?? null, e2.regex = (...t4) => e2.check(ur2(...t4)), e2.includes = (...t4) => e2.check(pr2(...t4)), e2.startsWith = (...t4) => e2.check(mr2(...t4)), e2.endsWith = (...t4) => e2.check(hr2(...t4)), e2.min = (...t4) => e2.check(W2(...t4)), e2.max = (...t4) => e2.check(cr2(...t4)), e2.length = (...t4) => e2.check(lr2(...t4)), e2.nonempty = (...t4) => e2.check(W2(1, ...t4)), e2.lowercase = (t4) => e2.check(dr2(t4)), e2.uppercase = (t4) => e2.check(fr2(t4)), e2.trim = () => e2.check(_r2()), e2.normalize = (...t4) => e2.check(gr2(...t4)), e2.toLowerCase = () => e2.check(vr2()), e2.toUpperCase = () => e2.check(yr2());
});
var Kr2 = /* @__PURE__ */ g2("ZodString", (e2, t3) => {
  z2.init(e2, t3), Gr2.init(e2, t3), e2.email = (t4) => e2.check(Pn2(Jr2, t4)), e2.url = (t4) => e2.check(Bn2(Xr2, t4)), e2.jwt = (t4) => e2.check(tr2(di2, t4)), e2.emoji = (t4) => e2.check(Vn2(Zr2, t4)), e2.guid = (t4) => e2.check(Fn2(Yr2, t4)), e2.uuid = (t4) => e2.check(In2(Y2, t4)), e2.uuidv4 = (t4) => e2.check(Ln2(Y2, t4)), e2.uuidv6 = (t4) => e2.check(Rn2(Y2, t4)), e2.uuidv7 = (t4) => e2.check(zn2(Y2, t4)), e2.nanoid = (t4) => e2.check(Hn2(Qr2, t4)), e2.guid = (t4) => e2.check(Fn2(Yr2, t4)), e2.cuid = (t4) => e2.check(Un2($r2, t4)), e2.cuid2 = (t4) => e2.check(Wn2(ei2, t4)), e2.ulid = (t4) => e2.check(Gn2(ti2, t4)), e2.base64 = (t4) => e2.check(Qn2(ci2, t4)), e2.base64url = (t4) => e2.check($n2(li2, t4)), e2.xid = (t4) => e2.check(Kn2(ni2, t4)), e2.ksuid = (t4) => e2.check(qn2(ri2, t4)), e2.ipv4 = (t4) => e2.check(Jn2(ii2, t4)), e2.ipv6 = (t4) => e2.check(Yn2(ai2, t4)), e2.cidrv4 = (t4) => e2.check(Xn2(oi2, t4)), e2.cidrv6 = (t4) => e2.check(Zn2(si2, t4)), e2.e164 = (t4) => e2.check(er2(ui2, t4)), e2.datetime = (t4) => e2.check(Tr2(t4)), e2.date = (t4) => e2.check(Dr2(t4)), e2.time = (t4) => e2.check(kr2(t4)), e2.duration = (t4) => e2.check(jr2(t4));
});
function qr2(e2) {
  return Nn2(Kr2, e2);
}
var J2 = /* @__PURE__ */ g2("ZodStringFormat", (e2, t3) => {
  B2.init(e2, t3), Gr2.init(e2, t3);
});
var Jr2 = /* @__PURE__ */ g2("ZodEmail", (e2, t3) => {
  jt2.init(e2, t3), J2.init(e2, t3);
});
var Yr2 = /* @__PURE__ */ g2("ZodGUID", (e2, t3) => {
  kt2.init(e2, t3), J2.init(e2, t3);
});
var Y2 = /* @__PURE__ */ g2("ZodUUID", (e2, t3) => {
  At2.init(e2, t3), J2.init(e2, t3);
});
var Xr2 = /* @__PURE__ */ g2("ZodURL", (e2, t3) => {
  Mt2.init(e2, t3), J2.init(e2, t3);
});
var Zr2 = /* @__PURE__ */ g2("ZodEmoji", (e2, t3) => {
  Nt2.init(e2, t3), J2.init(e2, t3);
});
var Qr2 = /* @__PURE__ */ g2("ZodNanoID", (e2, t3) => {
  Pt2.init(e2, t3), J2.init(e2, t3);
});
var $r2 = /* @__PURE__ */ g2("ZodCUID", (e2, t3) => {
  Ft2.init(e2, t3), J2.init(e2, t3);
});
var ei2 = /* @__PURE__ */ g2("ZodCUID2", (e2, t3) => {
  It2.init(e2, t3), J2.init(e2, t3);
});
var ti2 = /* @__PURE__ */ g2("ZodULID", (e2, t3) => {
  Lt2.init(e2, t3), J2.init(e2, t3);
});
var ni2 = /* @__PURE__ */ g2("ZodXID", (e2, t3) => {
  Rt2.init(e2, t3), J2.init(e2, t3);
});
var ri2 = /* @__PURE__ */ g2("ZodKSUID", (e2, t3) => {
  zt2.init(e2, t3), J2.init(e2, t3);
});
var ii2 = /* @__PURE__ */ g2("ZodIPv4", (e2, t3) => {
  Wt2.init(e2, t3), J2.init(e2, t3);
});
var ai2 = /* @__PURE__ */ g2("ZodIPv6", (e2, t3) => {
  Gt2.init(e2, t3), J2.init(e2, t3);
});
var oi2 = /* @__PURE__ */ g2("ZodCIDRv4", (e2, t3) => {
  Kt2.init(e2, t3), J2.init(e2, t3);
});
var si2 = /* @__PURE__ */ g2("ZodCIDRv6", (e2, t3) => {
  qt2.init(e2, t3), J2.init(e2, t3);
});
var ci2 = /* @__PURE__ */ g2("ZodBase64", (e2, t3) => {
  Yt2.init(e2, t3), J2.init(e2, t3);
});
var li2 = /* @__PURE__ */ g2("ZodBase64URL", (e2, t3) => {
  Zt2.init(e2, t3), J2.init(e2, t3);
});
var ui2 = /* @__PURE__ */ g2("ZodE164", (e2, t3) => {
  Qt2.init(e2, t3), J2.init(e2, t3);
});
var di2 = /* @__PURE__ */ g2("ZodJWT", (e2, t3) => {
  en2.init(e2, t3), J2.init(e2, t3);
});
var fi2 = /* @__PURE__ */ g2("ZodUnknown", (e2, t3) => {
  tn2.init(e2, t3), q2.init(e2, t3);
});
function pi2() {
  return or2(fi2);
}
var mi2 = /* @__PURE__ */ g2("ZodNever", (e2, t3) => {
  nn2.init(e2, t3), q2.init(e2, t3);
});
function hi2(e2) {
  return sr2(mi2, e2);
}
var gi2 = /* @__PURE__ */ g2("ZodArray", (e2, t3) => {
  an2.init(e2, t3), q2.init(e2, t3), e2.element = t3.element, e2.min = (t4, n3) => e2.check(W2(t4, n3)), e2.nonempty = (t4) => e2.check(W2(1, t4)), e2.max = (t4, n3) => e2.check(cr2(t4, n3)), e2.length = (t4, n3) => e2.check(lr2(t4, n3)), e2.unwrap = () => e2.element;
});
function _i2(e2, t3) {
  return br2(gi2, e2, t3);
}
var vi2 = /* @__PURE__ */ g2("ZodObject", (e2, t3) => {
  ln2.init(e2, t3), q2.init(e2, t3), x2(e2, "shape", () => t3.shape), e2.keyof = () => Ti2(Object.keys(e2._zod.def.shape)), e2.catchall = (t4) => e2.clone({
    ...e2._zod.def,
    catchall: t4
  }), e2.passthrough = () => e2.clone({
    ...e2._zod.def,
    catchall: pi2()
  }), e2.loose = () => e2.clone({
    ...e2._zod.def,
    catchall: pi2()
  }), e2.strict = () => e2.clone({
    ...e2._zod.def,
    catchall: hi2()
  }), e2.strip = () => e2.clone({
    ...e2._zod.def,
    catchall: void 0
  }), e2.extend = (t4) => be2(e2, t4), e2.safeExtend = (t4) => xe2(e2, t4), e2.merge = (t4) => Se2(e2, t4), e2.pick = (t4) => ve2(e2, t4), e2.omit = (t4) => ye2(e2, t4), e2.partial = (...t4) => Ce2(Oi2, e2, t4[0]), e2.required = (...t4) => we2(Ii2, e2, t4[0]);
});
function yi2(e2, t3) {
  return new vi2({
    type: "object",
    shape: e2 ?? {},
    ...O2(t3)
  });
}
var bi2 = /* @__PURE__ */ g2("ZodUnion", (e2, t3) => {
  dn2.init(e2, t3), q2.init(e2, t3), e2.options = t3.options;
});
function xi2(e2, t3) {
  return new bi2({
    type: "union",
    options: e2,
    ...O2(t3)
  });
}
var Si2 = /* @__PURE__ */ g2("ZodIntersection", (e2, t3) => {
  fn2.init(e2, t3), q2.init(e2, t3);
});
function Ci2(e2, t3) {
  return new Si2({
    type: "intersection",
    left: e2,
    right: t3
  });
}
var wi2 = /* @__PURE__ */ g2("ZodEnum", (e2, t3) => {
  hn2.init(e2, t3), q2.init(e2, t3), e2.enum = t3.entries, e2.options = Object.values(t3.entries);
  let n3 = new Set(Object.keys(t3.entries));
  e2.extract = (e3, r2) => {
    let i4 = {};
    for (let r3 of e3) if (n3.has(r3)) i4[r3] = t3.entries[r3];
    else throw Error(`Key ${r3} not found in enum`);
    return new wi2({
      ...t3,
      checks: [],
      ...O2(r2),
      entries: i4
    });
  }, e2.exclude = (e3, r2) => {
    let i4 = { ...t3.entries };
    for (let t4 of e3) if (n3.has(t4)) delete i4[t4];
    else throw Error(`Key ${t4} not found in enum`);
    return new wi2({
      ...t3,
      checks: [],
      ...O2(r2),
      entries: i4
    });
  };
});
function Ti2(e2, t3) {
  return new wi2({
    type: "enum",
    entries: Array.isArray(e2) ? Object.fromEntries(e2.map((e3) => [e3, e3])) : e2,
    ...O2(t3)
  });
}
var Ei2 = /* @__PURE__ */ g2("ZodTransform", (e2, t3) => {
  gn2.init(e2, t3), q2.init(e2, t3), e2._zod.parse = (n3, r2) => {
    if (r2.direction === "backward") throw new oe2(e2.constructor.name);
    n3.addIssue = (r3) => {
      if (typeof r3 == "string") n3.issues.push(N2(r3, n3.value, t3));
      else {
        let t4 = r3;
        t4.fatal && (t4.continue = false), t4.code ??= "custom", t4.input ??= n3.value, t4.inst ??= e2, n3.issues.push(N2(t4));
      }
    };
    let i4 = t3.transform(n3.value, n3);
    return i4 instanceof Promise ? i4.then((e3) => (n3.value = e3, n3)) : (n3.value = i4, n3);
  };
});
function Di2(e2) {
  return new Ei2({
    type: "transform",
    transform: e2
  });
}
var Oi2 = /* @__PURE__ */ g2("ZodOptional", (e2, t3) => {
  vn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function ki2(e2) {
  return new Oi2({
    type: "optional",
    innerType: e2
  });
}
var Ai2 = /* @__PURE__ */ g2("ZodNullable", (e2, t3) => {
  yn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function ji2(e2) {
  return new Ai2({
    type: "nullable",
    innerType: e2
  });
}
var Mi2 = /* @__PURE__ */ g2("ZodDefault", (e2, t3) => {
  bn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType, e2.removeDefault = e2.unwrap;
});
function Ni2(e2, t3) {
  return new Mi2({
    type: "default",
    innerType: e2,
    get defaultValue() {
      return typeof t3 == "function" ? t3() : he2(t3);
    }
  });
}
var Pi2 = /* @__PURE__ */ g2("ZodPrefault", (e2, t3) => {
  Sn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function Fi2(e2, t3) {
  return new Pi2({
    type: "prefault",
    innerType: e2,
    get defaultValue() {
      return typeof t3 == "function" ? t3() : he2(t3);
    }
  });
}
var Ii2 = /* @__PURE__ */ g2("ZodNonOptional", (e2, t3) => {
  Cn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function Li2(e2, t3) {
  return new Ii2({
    type: "nonoptional",
    innerType: e2,
    ...O2(t3)
  });
}
var Ri2 = /* @__PURE__ */ g2("ZodCatch", (e2, t3) => {
  Tn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType, e2.removeCatch = e2.unwrap;
});
function zi2(e2, t3) {
  return new Ri2({
    type: "catch",
    innerType: e2,
    catchValue: typeof t3 == "function" ? t3 : () => t3
  });
}
var Bi2 = /* @__PURE__ */ g2("ZodPipe", (e2, t3) => {
  En2.init(e2, t3), q2.init(e2, t3), e2.in = t3.in, e2.out = t3.out;
});
function Vi2(e2, t3) {
  return new Bi2({
    type: "pipe",
    in: e2,
    out: t3
  });
}
var Hi2 = /* @__PURE__ */ g2("ZodReadonly", (e2, t3) => {
  Dn2.init(e2, t3), q2.init(e2, t3), e2.unwrap = () => e2._zod.def.innerType;
});
function Ui2(e2) {
  return new Hi2({
    type: "readonly",
    innerType: e2
  });
}
var Wi2 = /* @__PURE__ */ g2("ZodCustom", (e2, t3) => {
  kn2.init(e2, t3), q2.init(e2, t3);
});
function Gi2(e2, t3 = {}) {
  return xr2(Wi2, e2, t3);
}
function Ki2(e2) {
  return Sr2(e2);
}
var qi2 = /* @__PURE__ */ (function() {
  function e2(e3) {
    this.groups = [], this.each = false, this.context = void 0, this.type = e3.type, this.name = e3.name, this.target = e3.target, this.propertyName = e3.propertyName, this.constraints = e3?.constraints, this.constraintCls = e3.constraintCls, this.validationTypeOptions = e3.validationTypeOptions, e3.validationOptions && (this.message = e3.validationOptions.message, this.groups = e3.validationOptions.groups, this.always = e3.validationOptions.always, this.each = e3.validationOptions.each, this.context = e3.validationOptions.context);
  }
  return e2;
})();
var Ji2 = (function() {
  function e2() {
  }
  return e2.prototype.transform = function(e3) {
    var t3 = [];
    return Object.keys(e3.properties).forEach(function(n3) {
      e3.properties[n3].forEach(function(r2) {
        var i4 = {
          message: r2.message,
          groups: r2.groups,
          always: r2.always,
          each: r2.each
        }, a3 = {
          type: r2.type,
          name: r2.name,
          target: e3.name,
          propertyName: n3,
          constraints: r2.constraints,
          validationTypeOptions: r2.options,
          validationOptions: i4
        };
        t3.push(new qi2(a3));
      });
    }), t3;
  }, e2;
})();
var Yi2 = function(e2) {
  var t3 = typeof Symbol == "function" && Symbol.iterator, n3 = t3 && e2[t3], r2 = 0;
  if (n3) return n3.call(e2);
  if (e2 && typeof e2.length == "number") return { next: function() {
    return e2 && r2 >= e2.length && (e2 = void 0), {
      value: e2 && e2[r2++],
      done: !e2
    };
  } };
  throw TypeError(t3 ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var Xi2 = function(e2, t3) {
  var n3 = typeof Symbol == "function" && e2[Symbol.iterator];
  if (!n3) return e2;
  var r2 = n3.call(e2), i4, a3 = [], o3;
  try {
    for (; (t3 === void 0 || t3-- > 0) && !(i4 = r2.next()).done; ) a3.push(i4.value);
  } catch (e3) {
    o3 = { error: e3 };
  } finally {
    try {
      i4 && !i4.done && (n3 = r2.return) && n3.call(r2);
    } finally {
      if (o3) throw o3.error;
    }
  }
  return a3;
};
var Zi2 = function(e2, t3, n3) {
  if (n3 || arguments.length === 2) for (var r2 = 0, i4 = t3.length, a3; r2 < i4; r2++) (a3 || !(r2 in t3)) && (a3 ||= Array.prototype.slice.call(t3, 0, r2), a3[r2] = t3[r2]);
  return e2.concat(a3 || Array.prototype.slice.call(t3));
};
(function() {
  function e2() {
    this.validationMetadatas = /* @__PURE__ */ new Map(), this.constraintMetadatas = /* @__PURE__ */ new Map();
  }
  return Object.defineProperty(e2.prototype, "hasValidationMetaData", {
    get: function() {
      return !!this.validationMetadatas.size;
    },
    enumerable: false,
    configurable: true
  }), e2.prototype.addValidationSchema = function(e3) {
    var t3 = this;
    new Ji2().transform(e3).forEach(function(e4) {
      return t3.addValidationMetadata(e4);
    });
  }, e2.prototype.addValidationMetadata = function(e3) {
    var t3 = this.validationMetadatas.get(e3.target);
    t3 ? t3.push(e3) : this.validationMetadatas.set(e3.target, [e3]);
  }, e2.prototype.addConstraintMetadata = function(e3) {
    var t3 = this.constraintMetadatas.get(e3.target);
    t3 ? t3.push(e3) : this.constraintMetadatas.set(e3.target, [e3]);
  }, e2.prototype.groupByPropertyName = function(e3) {
    var t3 = {};
    return e3.forEach(function(e4) {
      t3[e4.propertyName] || (t3[e4.propertyName] = []), t3[e4.propertyName].push(e4);
    }), t3;
  }, e2.prototype.getTargetValidationMetadatas = function(e3, t3, n3, r2, i4) {
    var a3, o3, s3 = function(e4) {
      return e4.always === void 0 ? e4.groups && e4.groups.length ? false : n3 : e4.always;
    }, c3 = function(e4) {
      return !!(r2 && (!i4 || !i4.length) && e4.groups && e4.groups.length);
    }, l4 = (this.validationMetadatas.get(e3) || []).filter(function(n4) {
      return n4.target !== e3 && n4.target !== t3 ? false : s3(n4) ? true : c3(n4) ? false : i4 && i4.length > 0 ? n4.groups && !!n4.groups.find(function(e4) {
        return i4.indexOf(e4) !== -1;
      }) : true;
    }), u4 = [];
    try {
      for (var d2 = Yi2(this.validationMetadatas.entries()), f2 = d2.next(); !f2.done; f2 = d2.next()) {
        var p2 = Xi2(f2.value, 2), m2 = p2[0], h2 = p2[1];
        e3.prototype instanceof m2 && u4.push.apply(u4, Zi2([], Xi2(h2), false));
      }
    } catch (e4) {
      a3 = { error: e4 };
    } finally {
      try {
        f2 && !f2.done && (o3 = d2.return) && o3.call(d2);
      } finally {
        if (a3) throw a3.error;
      }
    }
    var ee2 = u4.filter(function(t4) {
      return typeof t4.target == "string" || t4.target === e3 || t4.target instanceof Function && !(e3.prototype instanceof t4.target) ? false : s3(t4) ? true : c3(t4) ? false : i4 && i4.length > 0 ? t4.groups && !!t4.groups.find(function(e4) {
        return i4.indexOf(e4) !== -1;
      }) : true;
    }).filter(function(e4) {
      return !l4.find(function(t4) {
        return t4.propertyName === e4.propertyName && t4.type === e4.type;
      });
    });
    return l4.concat(ee2);
  }, e2.prototype.getTargetValidatorConstraints = function(e3) {
    return this.constraintMetadatas.get(e3) || [];
  }, e2;
})(), (function() {
  function e2() {
  }
  return e2.isValid = function(e3) {
    var t3 = this;
    return e3 !== "isValid" && e3 !== "getMessage" && Object.keys(this).map(function(e4) {
      return t3[e4];
    }).indexOf(e3) !== -1;
  }, e2.CUSTOM_VALIDATION = "customValidation", e2.NESTED_VALIDATION = "nestedValidation", e2.PROMISE_VALIDATION = "promiseValidation", e2.CONDITIONAL_VALIDATION = "conditionalValidation", e2.WHITELIST = "whitelistValidation", e2.IS_DEFINED = "isDefined", e2;
})();
var Qi2 = new ((function() {
  function e2() {
    this.instances = [];
  }
  return e2.prototype.get = function(e3) {
    var t3 = this.instances.find(function(t4) {
      return t4.type === e3;
    });
    return t3 || (t3 = {
      type: e3,
      object: new e3()
    }, this.instances.push(t3)), t3.object;
  }, e2;
})())();
var $i2;
var X2;
function ea2(e2) {
  if ($i2) try {
    var t3 = $i2.get(e2);
    if (t3 || !X2 || !X2.fallback) return t3;
  } catch (e3) {
    if (!X2 || !X2.fallbackOnErrors) throw e3;
  }
  return Qi2.get(e2);
}
(function() {
  function e2(e3, t3, n3) {
    n3 === void 0 && (n3 = false), this.target = e3, this.name = t3, this.async = n3;
  }
  return Object.defineProperty(e2.prototype, "instance", {
    get: function() {
      return ea2(this.target);
    },
    enumerable: false,
    configurable: true
  }), e2;
})();
var Z2 = /* @__PURE__ */ (function(e2) {
  return e2.ACTOR = "ACTOR", e2.ADDRESS = "ADDRESS", e2.ARRAY = "ARRAY", e2.BOOLEAN = "BOOLEAN", e2.CURRENCY = "CURRENCY", e2.DATE = "DATE", e2.DATE_TIME = "DATE_TIME", e2.EMAILS = "EMAILS", e2.FILES = "FILES", e2.FULL_NAME = "FULL_NAME", e2.LINKS = "LINKS", e2.MORPH_RELATION = "MORPH_RELATION", e2.MULTI_SELECT = "MULTI_SELECT", e2.NUMBER = "NUMBER", e2.NUMERIC = "NUMERIC", e2.PHONES = "PHONES", e2.POSITION = "POSITION", e2.RATING = "RATING", e2.RAW_JSON = "RAW_JSON", e2.RELATION = "RELATION", e2.RICH_TEXT = "RICH_TEXT", e2.SELECT = "SELECT", e2.TEXT = "TEXT", e2.TS_VECTOR = "TS_VECTOR", e2.UUID = "UUID", e2;
})({});
var ta2 = /* @__PURE__ */ (function(e2) {
  return e2.EMAIL = "EMAIL", e2.CALENDAR = "CALENDAR", e2.WORKFLOW = "WORKFLOW", e2.AGENT = "AGENT", e2.API = "API", e2.IMPORT = "IMPORT", e2.MANUAL = "MANUAL", e2.SYSTEM = "SYSTEM", e2.WEBHOOK = "WEBHOOK", e2.APPLICATION = "APPLICATION", e2;
})({});
var na2 = {
  type: Z2.ACTOR,
  properties: [
    {
      name: "source",
      type: Z2.SELECT,
      hidden: false,
      isRequired: true,
      options: Object.keys(ta2).map((e2, t3) => ({
        id: v4_default(),
        label: `${ta2[e2].toLowerCase()}`,
        value: e2,
        position: t3
      }))
    },
    {
      name: "workspaceMemberId",
      type: Z2.UUID,
      hidden: "input",
      isRequired: false
    },
    {
      name: "name",
      type: Z2.TEXT,
      hidden: "input",
      isRequired: true
    },
    {
      name: "context",
      type: Z2.RAW_JSON,
      hidden: false,
      isRequired: false
    }
  ]
};
var ra2 = {
  type: Z2.ADDRESS,
  properties: [
    {
      name: "addressStreet1",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressStreet2",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressCity",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressPostcode",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressState",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressCountry",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressLat",
      type: Z2.NUMERIC,
      hidden: false,
      isRequired: false
    },
    {
      name: "addressLng",
      type: Z2.NUMERIC,
      hidden: false,
      isRequired: false
    }
  ]
};
var ia = {
  type: Z2.CURRENCY,
  properties: [{
    name: "amountMicros",
    type: Z2.NUMERIC,
    hidden: false,
    isRequired: false
  }, {
    name: "currencyCode",
    type: Z2.TEXT,
    hidden: false,
    isRequired: false
  }]
};
var aa2 = {
  type: Z2.EMAILS,
  properties: [{
    name: "primaryEmail",
    type: Z2.TEXT,
    hidden: false,
    isRequired: false,
    isIncludedInUniqueConstraint: true
  }, {
    name: "additionalEmails",
    type: Z2.RAW_JSON,
    hidden: false,
    isRequired: false
  }]
};
var oa2 = {
  type: Z2.FULL_NAME,
  properties: [{
    name: "firstName",
    type: Z2.TEXT,
    hidden: false,
    isRequired: false,
    isIncludedInUniqueConstraint: false
  }, {
    name: "lastName",
    type: Z2.TEXT,
    hidden: false,
    isRequired: false,
    isIncludedInUniqueConstraint: false
  }]
};
var sa2 = {
  type: Z2.LINKS,
  properties: [
    {
      name: "primaryLinkLabel",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false
    },
    {
      name: "primaryLinkUrl",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "secondaryLinks",
      type: Z2.RAW_JSON,
      hidden: false,
      isRequired: false
    }
  ]
};
var ca2 = {
  type: Z2.PHONES,
  properties: [
    {
      name: "primaryPhoneNumber",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "primaryPhoneCountryCode",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "primaryPhoneCallingCode",
      type: Z2.TEXT,
      hidden: false,
      isRequired: false,
      isIncludedInUniqueConstraint: true
    },
    {
      name: "additionalPhones",
      type: Z2.RAW_JSON,
      hidden: false,
      isRequired: false
    }
  ]
};
var la = {
  type: Z2.RICH_TEXT,
  properties: [{
    name: "blocknote",
    type: Z2.TEXT,
    hidden: false,
    isRequired: false
  }, {
    name: "markdown",
    type: Z2.TEXT,
    hidden: false,
    isRequired: false
  }]
};
yi2({
  blocknote: qr2().nullable().optional(),
  markdown: qr2().nullable()
}), /* @__PURE__ */ new Map([
  [Z2.LINKS, sa2],
  [Z2.CURRENCY, ia],
  [Z2.FULL_NAME, oa2],
  [Z2.ADDRESS, ra2],
  [Z2.ACTOR, na2],
  [Z2.EMAILS, aa2],
  [Z2.PHONES, ca2],
  [Z2.RICH_TEXT, la]
]), Z2.RELATION, Z2.MORPH_RELATION, Z2.FILES, Z2.TS_VECTOR, Z2.TEXT, Z2.ARRAY, Z2.BOOLEAN, Z2.DATE, Z2.DATE_TIME, Z2.NUMBER, Z2.NUMERIC, Z2.RAW_JSON, Z2.RICH_TEXT, Z2.SELECT, Z2.MULTI_SELECT;
var ua = "TWENTY_API_URL";
var da = "TWENTY_APP_APPLICATION_ACCESS_TOKEN";
var fa = () => process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? process.env.TWENTY_APP_ACCESS_TOKEN;
var Q2 = async ({ query: e2, variables: t3, caller: n3 }) => {
  let r2 = process.env[ua], i4 = fa();
  if (!r2 || !i4) throw Error(`${n3}() requires the app runtime env vars ${ua} and ${da}.`);
  let a3 = await fetch(`${r2}/metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${i4}`
    },
    body: JSON.stringify({
      query: e2,
      variables: t3
    })
  });
  if (!a3.ok) throw Error(`${n3}() failed: HTTP ${a3.status} ${a3.statusText}`);
  let o3 = await a3.json();
  if (o3.errors && o3.errors.length > 0) throw Error(`${n3}() failed: ${o3.errors.map((e3) => e3.message).join(", ")}`);
  if (!o3.data) throw Error(`${n3}() failed: response contained no data.`);
  return o3.data;
};
var Ta = "\n  query GetAppKeyValue($key: String!, $scope: AppKeyValueScope) {\n    appKeyValue(key: $key, scope: $scope) {\n      key\n      value\n      scope\n    }\n  }\n";
var Ea = "\n  mutation SetAppKeyValue($input: SetAppKeyValueInput!) {\n    setAppKeyValue(input: $input) {\n      key\n      value\n      scope\n    }\n  }\n";
var Da = "\n  mutation DeleteAppKeyValue($key: String!, $scope: AppKeyValueScope) {\n    deleteAppKeyValue(key: $key, scope: $scope)\n  }\n";
var $2 = "WORKSPACE";
var Oa = {
  async get(e2, t3) {
    let { appKeyValue: n3 } = await Q2({
      query: Ta,
      variables: {
        key: e2,
        scope: t3?.scope ?? $2
      },
      caller: "kv.get"
    });
    return n3?.value ?? null;
  },
  async set(e2, t3, n3) {
    await Q2({
      query: Ea,
      variables: { input: {
        key: e2,
        value: t3,
        scope: n3?.scope ?? $2
      } },
      caller: "kv.set"
    });
  },
  async delete(e2, t3) {
    let { deleteAppKeyValue: n3 } = await Q2({
      query: Da,
      variables: {
        key: e2,
        scope: t3?.scope ?? $2
      },
      caller: "kv.delete"
    });
    return n3;
  }
};
var ka = class {
  constructor(e2, t3) {
    this.__twentyHttpResponse = true, this.body = e2, this.status = t3?.status, this.headers = t3?.headers;
  }
};

// src/constants/universal-identifiers.ts
var INBOUND_ROUTE_PATH = "/sms-inbound";

// src/shared/crm.ts
var client = new u2({ runAs: "application" });
var unwrap = (body) => body?.data ?? {};
var rowsOf = (body, key) => {
  const value = unwrap(body)[key];
  return Array.isArray(value) ? value : [];
};
var pickCreated = (body) => {
  for (const candidate of Object.values(unwrap(body))) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const record = candidate;
      if (record.id) return record;
    }
  }
  return void 0;
};
var describeError = (error) => {
  const details = error;
  const body = details?.body === void 0 ? "" : ` | ${JSON.stringify(details.body).slice(0, 300)}`;
  return `${details?.message ?? String(error)}${body}`;
};
var findGateway = async (deviceId) => {
  const response = await client.get("/rest/smsGateways", {
    query: { filter: `deviceId[eq]:"${deviceId}"`, limit: 1 }
  });
  const row = rowsOf(response, "smsGateways")[0];
  if (!row?.id) return null;
  const nomer = row.nomer ?? null;
  const sotrudnikId = String(row.sotrudnikId ?? "");
  return {
    id: row.id,
    name: String(row.name ?? "SMS-\u0448\u043B\u044E\u0437"),
    memberId: sotrudnikId,
    number: String(nomer?.primaryPhoneNumber ?? "")
  };
};
var findByPhone = async (params) => {
  const { path, key, field, phone } = params;
  const byPrimary = rowsOf(
    await client.get(path, {
      query: { filter: `${field}.primaryPhoneNumber[eq]:"${phone}"`, limit: 3 }
    }),
    key
  );
  if (byPrimary.length > 0) return byPrimary;
  return rowsOf(
    await client.get(path, {
      query: { filter: `${field}.additionalPhones[like]:"%${phone}%"`, limit: 3 }
    }),
    key
  );
};
var personName = (row) => {
  const name = row.name;
  return [name?.lastName, name?.firstName].map((p2) => String(p2 ?? "").trim()).filter(Boolean).join(" ");
};
var findClient = async (phone) => {
  const result = { personId: "", personName: "", companyId: "", companyName: "" };
  if (!phone) return result;
  const people = await findByPhone({ path: "/rest/people", key: "people", field: "phones", phone });
  if (people.length === 1 && people[0].id) {
    result.personId = people[0].id;
    result.personName = personName(people[0]);
    return result;
  }
  const companies = await findByPhone({
    path: "/rest/companies",
    key: "companies",
    field: "telefony",
    phone
  });
  if (companies.length === 1 && companies[0].id) {
    result.companyId = companies[0].id;
    result.companyName = String(companies[0].name ?? "");
  }
  return result;
};
var ensureChat = async (params) => {
  const { externalId, title, gatewayId, client: ref } = params;
  const existing = rowsOf(
    await client.get("/rest/chats", {
      query: { filter: `vneshniyId[eq]:"${externalId}"`, limit: 1 }
    }),
    "chats"
  )[0];
  if (existing?.id) return { id: existing.id, created: false };
  const payload = {
    name: title,
    nazvanie: title,
    kanal: "SMS",
    tip: "KLIENT",
    status: "OTKRYT",
    vneshniyId: externalId,
    shlyuzId: gatewayId
  };
  if (ref.personId) payload.kontaktId = ref.personId;
  if (ref.companyId) payload.kompaniyaId = ref.companyId;
  const created = pickCreated(await client.post("/rest/chats", payload));
  if (!created?.id) throw new Error("\u0434\u0438\u0430\u043B\u043E\u0433 \u0441\u043E\u0437\u0434\u0430\u043D, \u043D\u043E \u0432 \u043E\u0442\u0432\u0435\u0442\u0435 \u043D\u0435\u0442 id");
  return { id: created.id, created: true };
};
var ensureParticipant = async (chatId, memberId) => {
  if (!memberId) return;
  const existing = rowsOf(
    await client.get("/rest/chatParticipants", {
      query: { filter: `chatId[eq]:"${chatId}"`, limit: 30 }
    }),
    "chatParticipants"
  ).find((row) => String(row.polzovatelId ?? "") === memberId);
  if (existing?.id) return;
  await client.post("/rest/chatParticipants", {
    name: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u0434\u0438\u0430\u043B\u043E\u0433\u0430",
    chatId,
    polzovatelId: memberId,
    rol: "VEDUSHCHIY",
    neprochitano: 0
  });
};
var saveIncoming = async (params) => {
  const { chatId, externalId, text, receivedAt } = params;
  const existing = rowsOf(
    await client.get("/rest/soobshcheniya", {
      query: { filter: `vneshniyId[eq]:"${externalId}"`, limit: 1 }
    }),
    "soobshcheniya"
  )[0];
  if (existing?.id) return { created: false, id: existing.id };
  const created = pickCreated(
    await client.post("/rest/soobshcheniya", {
      name: text.slice(0, 80) || "SMS",
      chatId,
      tekst: text,
      napravlenie: "VHODYASHCHIE",
      statusDostavki: "DOSTAVLENO",
      vneshniyId: externalId
    })
  );
  if (!created?.id) throw new Error("\u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u043E, \u043D\u043E \u0432 \u043E\u0442\u0432\u0435\u0442\u0435 \u043D\u0435\u0442 id");
  void receivedAt;
  return { created: true, id: created.id };
};
var touchChat = async (params) => {
  const { chatId, text, receivedAt, unreadBefore } = params;
  await client.patch(`/rest/chats/${chatId}`, {
    posledneeSoobshchenie: text.slice(0, 200),
    vremyaPoslednego: receivedAt,
    neprochitano: unreadBefore + 1
  });
};
var readChatUnread = async (chatId) => {
  const row = rowsOf(
    await client.get("/rest/chats", {
      query: { filter: `id[eq]:"${chatId}"`, limit: 1 }
    }),
    "chats"
  )[0];
  return Number(row?.neprochitano ?? 0);
};
var bumpParticipantUnread = async (chatId, memberId) => {
  const participant = rowsOf(
    await client.get("/rest/chatParticipants", {
      query: { filter: `chatId[eq]:"${chatId}"`, limit: 30 }
    }),
    "chatParticipants"
  ).find((row) => String(row.polzovatelId ?? "") === memberId);
  if (!participant?.id) return;
  await client.patch(`/rest/chatParticipants/${participant.id}`, {
    neprochitano: Number(participant.neprochitano ?? 0) + 1
  });
};
var touchGateway = async (gatewayId, at3) => {
  await client.patch(`/rest/smsGateways/${gatewayId}`, {
    posledniyKontakt: at3,
    status: "NA_SVYAZI"
  });
};

// src/shared/sms.ts
var phone10 = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
};
var formatPhone = (value) => {
  const digits = phone10(value);
  if (digits.length !== 10) return digits;
  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};
var parseIncoming = (body, headers) => {
  const root = body ?? {};
  const payload = root.payload ?? {};
  const externalId = String(payload.messageId ?? root.id ?? "");
  return {
    gatewayDeviceId: String(root.deviceId ?? ""),
    externalId,
    text: String(payload.message ?? "").trim(),
    phone: phone10(payload.phoneNumber ?? payload.sender),
    recipient: phone10(payload.recipient),
    simNumber: Number(payload.simNumber ?? 0),
    receivedAt: String(payload.receivedAt ?? (/* @__PURE__ */ new Date()).toISOString()),
    signature: String(headers["x-signature"] ?? headers["X-Signature"] ?? ""),
    eventName: String(root.event ?? "")
  };
};

// src/logic-functions/sms-inbound.logic-function.ts
var handler = async (event) => {
  const incoming = parseIncoming(event.body, event.headers ?? {});
  const errors = [];
  if (!incoming.gatewayDeviceId) {
    return new ka(JSON.stringify({ ok: false, error: "\u043D\u0435\u0442 deviceId" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
  const gateway = await findGateway(incoming.gatewayDeviceId).catch((error) => {
    errors.push(`\u0448\u043B\u044E\u0437: ${describeError(error)}`);
    return null;
  });
  if (!gateway) {
    await Oa.set("sms:last", { incoming, errors, result: "\u0448\u043B\u044E\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
    return new ka(JSON.stringify({ ok: true, ignored: "\u0448\u043B\u044E\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
  const client2 = await findClient(incoming.phone).catch((error) => {
    errors.push(`\u043A\u043B\u0438\u0435\u043D\u0442: ${describeError(error)}`);
    return { personId: "", personName: "", companyId: "", companyName: "" };
  });
  const title = client2.personName || client2.companyName ? `${formatPhone(incoming.phone)} \u2014 ${client2.personName || client2.companyName}` : formatPhone(incoming.phone);
  let chatId = "";
  let chatCreated = false;
  let messageCreated = false;
  let messageId = "";
  try {
    const chat = await ensureChat({
      externalId: `sms:${incoming.gatewayDeviceId}:${incoming.phone}`,
      title,
      gatewayId: gateway.id,
      client: client2
    });
    chatId = chat.id;
    chatCreated = chat.created;
    await ensureParticipant(chatId, gateway.memberId);
    const saved = await saveIncoming({
      chatId,
      externalId: incoming.externalId,
      text: incoming.text,
      receivedAt: incoming.receivedAt
    });
    messageCreated = saved.created;
    messageId = saved.id;
    if (saved.created) {
      const unreadBefore = await readChatUnread(chatId);
      await touchChat({
        chatId,
        text: incoming.text,
        receivedAt: incoming.receivedAt,
        unreadBefore
      });
      await bumpParticipantUnread(chatId, gateway.memberId);
    }
  } catch (error) {
    errors.push(`\u0434\u0438\u0430\u043B\u043E\u0433: ${describeError(error)}`);
  }
  try {
    await touchGateway(gateway.id, incoming.receivedAt);
  } catch (error) {
    errors.push(`\u0448\u043B\u044E\u0437: ${describeError(error)}`);
  }
  const answer = {
    ok: errors.length === 0,
    source: "sms-channel",
    gateway: gateway.name,
    member: gateway.memberId ? "\u043D\u0430\u0439\u0434\u0435\u043D" : "\u043D\u0435\u0442 \u0443\u0447\u0451\u0442\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438",
    client: client2.personName || client2.companyName || "\u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D",
    chatId,
    chatCreated,
    messageId,
    duplicate: Boolean(chatId) && !messageCreated,
    signature: incoming.signature ? "\u0435\u0441\u0442\u044C" : "\u043D\u0435\u0442",
    errors
  };
  await Oa.set("sms:last", { incoming, gateway, client: client2, answer });
  return new ka(JSON.stringify(answer), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};
var sms_inbound_logic_function_default = defineLogicFunction({
  universalIdentifier: "a4272584-eca6-44c1-9291-458dc480cec3",
  name: "sms-inbound",
  description: "\u0412\u0445\u043E\u0434\u044F\u0449\u0438\u0435 SMS \u0441 Android-\u0448\u043B\u044E\u0437\u0430 \u2192 \u0434\u0438\u0430\u043B\u043E\u0433 \xAB\u0426\u0435\u043D\u0442\u0440\u0430 \u043A\u043E\u043C\u043C\u0443\u043D\u0438\u043A\u0430\u0446\u0438\u0438\xBB",
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: INBOUND_ROUTE_PATH,
    httpMethod: "POST",
    isAuthRequired: false,
    forwardedRequestHeaders: ["content-type"]
  }
});
export {
  sms_inbound_logic_function_default as default
};
//# sourceMappingURL=sms-inbound.logic-function.mjs.map
