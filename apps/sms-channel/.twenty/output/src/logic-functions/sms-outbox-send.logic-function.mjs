import { createRequire as __createRequire } from 'module';
const require = __createRequire(import.meta.url);

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

// src/constants/universal-identifiers.ts
var SMS_OUTBOX_SEND_FUNCTION_UNIVERSAL_IDENTIFIER = "2e556c99-6c4c-4865-b4ca-53c8fe004dde";

// node_modules/twenty-client-sdk/dist/application-yzkKx8Nd.mjs
var e = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
function t(t2) {
  return typeof t2 == "string" && e.test(t2);
}
function n(e2) {
  if (!t(e2)) throw TypeError("Invalid UUID");
  let n2;
  return Uint8Array.of((n2 = parseInt(e2.slice(0, 8), 16)) >>> 24, n2 >>> 16 & 255, n2 >>> 8 & 255, n2 & 255, (n2 = parseInt(e2.slice(9, 13), 16)) >>> 8, n2 & 255, (n2 = parseInt(e2.slice(14, 18), 16)) >>> 8, n2 & 255, (n2 = parseInt(e2.slice(19, 23), 16)) >>> 8, n2 & 255, (n2 = parseInt(e2.slice(24, 36), 16)) / 1099511627776 & 255, n2 / 4294967296 & 255, n2 >>> 24 & 255, n2 >>> 16 & 255, n2 >>> 8 & 255, n2 & 255);
}
var r = [];
for (let e2 = 0; e2 < 256; ++e2) r.push((e2 + 256).toString(16).slice(1));
function i(e2, t2 = 0) {
  return (r[e2[t2 + 0]] + r[e2[t2 + 1]] + r[e2[t2 + 2]] + r[e2[t2 + 3]] + "-" + r[e2[t2 + 4]] + r[e2[t2 + 5]] + "-" + r[e2[t2 + 6]] + r[e2[t2 + 7]] + "-" + r[e2[t2 + 8]] + r[e2[t2 + 9]] + "-" + r[e2[t2 + 10]] + r[e2[t2 + 11]] + r[e2[t2 + 12]] + r[e2[t2 + 13]] + r[e2[t2 + 14]] + r[e2[t2 + 15]]).toLowerCase();
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
  let t2 = new Uint8Array(e2.length);
  for (let n2 = 0; n2 < e2.length; ++n2) t2[n2] = e2.charCodeAt(n2);
  return t2;
}
var l = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
var u = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function d(e2, t2, r2, a3, o3, s3) {
  let l3 = typeof r2 == "string" ? c(r2) : r2, u3 = typeof a3 == "string" ? n(a3) : a3;
  if (typeof a3 == "string" && (a3 = n(a3)), a3?.length !== 16) throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
  let d2 = new Uint8Array(16 + l3.length);
  if (d2.set(u3), d2.set(l3, u3.length), d2 = t2(d2), d2[6] = d2[6] & 15 | e2, d2[8] = d2[8] & 63 | 128, o3) {
    if (s3 ||= 0, s3 < 0 || s3 + 16 > o3.length) throw RangeError(`UUID byte range ${s3}:${s3 + 15} is out of buffer bounds`);
    for (let e3 = 0; e3 < 16; ++e3) o3[s3 + e3] = d2[e3];
    return o3;
  }
  return i(d2);
}
var f = { randomUUID: typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto) };
function p(e2, t2, n2) {
  if (f.randomUUID && !t2 && !e2) return f.randomUUID();
  e2 ||= {};
  let r2 = e2.random ?? e2.rng?.() ?? s();
  if (r2.length < 16) throw Error("Random bytes length must be >= 16");
  if (r2[6] = r2[6] & 15 | 64, r2[8] = r2[8] & 63 | 128, t2) {
    if (n2 ||= 0, n2 < 0 || n2 + 16 > t2.length) throw RangeError(`UUID byte range ${n2}:${n2 + 15} is out of buffer bounds`);
    for (let e3 = 0; e3 < 16; ++e3) t2[n2 + e3] = r2[e3];
    return t2;
  }
  return i(r2);
}
function ee(e2, t2, n2, r2) {
  switch (e2) {
    case 0:
      return t2 & n2 ^ ~t2 & r2;
    case 1:
      return t2 ^ n2 ^ r2;
    case 2:
      return t2 & n2 ^ t2 & r2 ^ n2 & r2;
    case 3:
      return t2 ^ n2 ^ r2;
  }
}
function m(e2, t2) {
  return e2 << t2 | e2 >>> 32 - t2;
}
function te(e2) {
  let t2 = [
    1518500249,
    1859775393,
    2400959708,
    3395469782
  ], n2 = [
    1732584193,
    4023233417,
    2562383102,
    271733878,
    3285377520
  ], r2 = new Uint8Array(e2.length + 1);
  r2.set(e2), r2[e2.length] = 128, e2 = r2;
  let i3 = e2.length / 4 + 2, a3 = Math.ceil(i3 / 16), o3 = Array(a3);
  for (let t3 = 0; t3 < a3; ++t3) {
    let n3 = new Uint32Array(16);
    for (let r3 = 0; r3 < 16; ++r3) n3[r3] = e2[t3 * 64 + r3 * 4] << 24 | e2[t3 * 64 + r3 * 4 + 1] << 16 | e2[t3 * 64 + r3 * 4 + 2] << 8 | e2[t3 * 64 + r3 * 4 + 3];
    o3[t3] = n3;
  }
  o3[a3 - 1][14] = (e2.length - 1) * 8 / 2 ** 32, o3[a3 - 1][14] = Math.floor(o3[a3 - 1][14]), o3[a3 - 1][15] = (e2.length - 1) * 8 & 4294967295;
  for (let e3 = 0; e3 < a3; ++e3) {
    let r3 = new Uint32Array(80);
    for (let t3 = 0; t3 < 16; ++t3) r3[t3] = o3[e3][t3];
    for (let e4 = 16; e4 < 80; ++e4) r3[e4] = m(r3[e4 - 3] ^ r3[e4 - 8] ^ r3[e4 - 14] ^ r3[e4 - 16], 1);
    let i4 = n2[0], a4 = n2[1], s3 = n2[2], c3 = n2[3], l3 = n2[4];
    for (let e4 = 0; e4 < 80; ++e4) {
      let n3 = Math.floor(e4 / 20), o4 = m(i4, 5) + ee(n3, a4, s3, c3) + l3 + t2[n3] + r3[e4] >>> 0;
      l3 = c3, c3 = s3, s3 = m(a4, 30) >>> 0, a4 = i4, i4 = o4;
    }
    n2[0] = n2[0] + i4 >>> 0, n2[1] = n2[1] + a4 >>> 0, n2[2] = n2[2] + s3 >>> 0, n2[3] = n2[3] + c3 >>> 0, n2[4] = n2[4] + l3 >>> 0;
  }
  return Uint8Array.of(n2[0] >> 24, n2[0] >> 16, n2[0] >> 8, n2[0], n2[1] >> 24, n2[1] >> 16, n2[1] >> 8, n2[1], n2[2] >> 24, n2[2] >> 16, n2[2] >> 8, n2[2], n2[3] >> 24, n2[3] >> 16, n2[3] >> 8, n2[3], n2[4] >> 24, n2[4] >> 16, n2[4] >> 8, n2[4]);
}
function ne(e2, t2, n2, r2) {
  return d(80, te, e2, t2, n2, r2);
}
ne.DNS = l, ne.URL = u, Object.freeze({ status: "aborted" });
function h(e2, t2, n2) {
  function r2(n3, r3) {
    var i4;
    Object.defineProperty(n3, "_zod", {
      value: n3._zod ?? {},
      enumerable: false
    }), (i4 = n3._zod).traits ?? (i4.traits = /* @__PURE__ */ new Set()), n3._zod.traits.add(e2), t2(n3, r3);
    for (let e3 in o3.prototype) e3 in n3 || Object.defineProperty(n3, e3, { value: o3.prototype[e3].bind(n3) });
    n3._zod.constr = o3, n3._zod.def = r3;
  }
  let i3 = n2?.Parent ?? Object;
  class a3 extends i3 {
  }
  Object.defineProperty(a3, "name", { value: e2 });
  function o3(e3) {
    var t3;
    let i4 = n2?.Parent ? new a3() : this;
    r2(i4, e3), (t3 = i4._zod).deferred ?? (t3.deferred = []);
    for (let e4 of i4._zod.deferred) e4();
    return i4;
  }
  return Object.defineProperty(o3, "init", { value: r2 }), Object.defineProperty(o3, Symbol.hasInstance, { value: (t3) => n2?.Parent && t3 instanceof n2.Parent ? true : t3?._zod?.traits?.has(e2) }), Object.defineProperty(o3, "name", { value: e2 }), o3;
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
  let t2 = Object.values(e2).filter((e3) => typeof e3 == "number");
  return Object.entries(e2).filter(([e3, n2]) => t2.indexOf(+e3) === -1).map(([e3, t3]) => t3);
}
function y(e2, t2) {
  return typeof t2 == "bigint" ? t2.toString() : t2;
}
function b(e2) {
  return { get value() {
    {
      let t2 = e2();
      return Object.defineProperty(this, "value", { value: t2 }), t2;
    }
    throw Error("cached value already set");
  } };
}
function ae(e2) {
  return e2 == null;
}
function oe(e2) {
  let t2 = +!!e2.startsWith("^"), n2 = e2.endsWith("$") ? e2.length - 1 : e2.length;
  return e2.slice(t2, n2);
}
var se = /* @__PURE__ */ Symbol("evaluating");
function x(e2, t2, n2) {
  let r2;
  Object.defineProperty(e2, t2, {
    get() {
      if (r2 !== se) return r2 === void 0 && (r2 = se, r2 = n2()), r2;
    },
    set(n3) {
      Object.defineProperty(e2, t2, { value: n3 });
    },
    configurable: true
  });
}
function S(e2, t2, n2) {
  Object.defineProperty(e2, t2, {
    value: n2,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function C(...e2) {
  let t2 = {};
  for (let n2 of e2) Object.assign(t2, Object.getOwnPropertyDescriptors(n2));
  return Object.defineProperties({}, t2);
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
  let t2 = e2.constructor;
  if (t2 === void 0) return true;
  let n2 = t2.prototype;
  return !(w(n2) === false || Object.prototype.hasOwnProperty.call(n2, "isPrototypeOf") === false);
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
function D(e2, t2, n2) {
  let r2 = new e2._zod.constr(t2 ?? e2._zod.def);
  return (!t2 || n2?.parent) && (r2._zod.parent = e2), r2;
}
function O(e2) {
  let t2 = e2;
  if (!t2) return {};
  if (typeof t2 == "string") return { error: () => t2 };
  if (t2?.message !== void 0) {
    if (t2?.error !== void 0) throw Error("Cannot specify both `message` and `error` params");
    t2.error = t2.message;
  }
  return delete t2.message, typeof t2.error == "string" ? {
    ...t2,
    error: () => t2.error
  } : t2;
}
function pe(e2) {
  return Object.keys(e2).filter((t2) => e2[t2]._zod.optin === "optional" && e2[t2]._zod.optout === "optional");
}
-Number.MAX_VALUE, Number.MAX_VALUE;
function me(e2, t2) {
  let n2 = e2._zod.def;
  return D(e2, C(e2._zod.def, {
    get shape() {
      let e3 = {};
      for (let r2 in t2) {
        if (!(r2 in n2.shape)) throw Error(`Unrecognized key: "${r2}"`);
        t2[r2] && (e3[r2] = n2.shape[r2]);
      }
      return S(this, "shape", e3), e3;
    },
    checks: []
  }));
}
function he(e2, t2) {
  let n2 = e2._zod.def;
  return D(e2, C(e2._zod.def, {
    get shape() {
      let r2 = { ...e2._zod.def.shape };
      for (let e3 in t2) {
        if (!(e3 in n2.shape)) throw Error(`Unrecognized key: "${e3}"`);
        t2[e3] && delete r2[e3];
      }
      return S(this, "shape", r2), r2;
    },
    checks: []
  }));
}
function ge(e2, t2) {
  if (!T(t2)) throw Error("Invalid input to extend: expected a plain object");
  let n2 = e2._zod.def.checks;
  if (n2 && n2.length > 0) throw Error("Object schemas containing refinements cannot be extended. Use `.safeExtend()` instead.");
  return D(e2, C(e2._zod.def, {
    get shape() {
      let n3 = {
        ...e2._zod.def.shape,
        ...t2
      };
      return S(this, "shape", n3), n3;
    },
    checks: []
  }));
}
function _e(e2, t2) {
  if (!T(t2)) throw Error("Invalid input to safeExtend: expected a plain object");
  return D(e2, {
    ...e2._zod.def,
    get shape() {
      let n2 = {
        ...e2._zod.def.shape,
        ...t2
      };
      return S(this, "shape", n2), n2;
    },
    checks: e2._zod.def.checks
  });
}
function ve(e2, t2) {
  return D(e2, C(e2._zod.def, {
    get shape() {
      let n2 = {
        ...e2._zod.def.shape,
        ...t2._zod.def.shape
      };
      return S(this, "shape", n2), n2;
    },
    get catchall() {
      return t2._zod.def.catchall;
    },
    checks: []
  }));
}
function ye(e2, t2, n2) {
  return D(t2, C(t2._zod.def, {
    get shape() {
      let r2 = t2._zod.def.shape, i3 = { ...r2 };
      if (n2) for (let t3 in n2) {
        if (!(t3 in r2)) throw Error(`Unrecognized key: "${t3}"`);
        n2[t3] && (i3[t3] = e2 ? new e2({
          type: "optional",
          innerType: r2[t3]
        }) : r2[t3]);
      }
      else for (let t3 in r2) i3[t3] = e2 ? new e2({
        type: "optional",
        innerType: r2[t3]
      }) : r2[t3];
      return S(this, "shape", i3), i3;
    },
    checks: []
  }));
}
function be(e2, t2, n2) {
  return D(t2, C(t2._zod.def, {
    get shape() {
      let r2 = t2._zod.def.shape, i3 = { ...r2 };
      if (n2) for (let t3 in n2) {
        if (!(t3 in i3)) throw Error(`Unrecognized key: "${t3}"`);
        n2[t3] && (i3[t3] = new e2({
          type: "nonoptional",
          innerType: r2[t3]
        }));
      }
      else for (let t3 in r2) i3[t3] = new e2({
        type: "nonoptional",
        innerType: r2[t3]
      });
      return S(this, "shape", i3), i3;
    },
    checks: []
  }));
}
function k(e2, t2 = 0) {
  if (e2.aborted === true) return true;
  for (let n2 = t2; n2 < e2.issues.length; n2++) if (e2.issues[n2]?.continue !== true) return true;
  return false;
}
function xe(e2, t2) {
  return t2.map((t3) => {
    var n2;
    return (n2 = t3).path ?? (n2.path = []), t3.path.unshift(e2), t3;
  });
}
function A(e2) {
  return typeof e2 == "string" ? e2 : e2?.message;
}
function j(e2, t2, n2) {
  let r2 = {
    ...e2,
    path: e2.path ?? []
  };
  return e2.message || (r2.message = A(e2.inst?._zod.def?.error?.(e2)) ?? A(t2?.error?.(e2)) ?? A(n2.customError?.(e2)) ?? A(n2.localeError?.(e2)) ?? "Invalid input"), delete r2.inst, delete r2.continue, t2?.reportInput || delete r2.input, r2;
}
function Se(e2) {
  return Array.isArray(e2) ? "array" : typeof e2 == "string" ? "string" : "unknown";
}
function M(...e2) {
  let [t2, n2, r2] = e2;
  return typeof t2 == "string" ? {
    message: t2,
    code: "custom",
    input: n2,
    inst: r2
  } : { ...t2 };
}
var Ce = (e2, t2) => {
  e2.name = "$ZodError", Object.defineProperty(e2, "_zod", {
    value: e2._zod,
    enumerable: false
  }), Object.defineProperty(e2, "issues", {
    value: t2,
    enumerable: false
  }), e2.message = JSON.stringify(t2, y, 2), Object.defineProperty(e2, "toString", {
    value: () => e2.message,
    enumerable: false
  });
};
var we = h("$ZodError", Ce);
var Te = h("$ZodError", Ce, { Parent: Error });
function Ee(e2, t2 = (e3) => e3.message) {
  let n2 = {}, r2 = [];
  for (let i3 of e2.issues) i3.path.length > 0 ? (n2[i3.path[0]] = n2[i3.path[0]] || [], n2[i3.path[0]].push(t2(i3))) : r2.push(t2(i3));
  return {
    formErrors: r2,
    fieldErrors: n2
  };
}
function De(e2, t2) {
  let n2 = t2 || function(e3) {
    return e3.message;
  }, r2 = { _errors: [] }, i3 = (e3) => {
    for (let t3 of e3.issues) if (t3.code === "invalid_union" && t3.errors.length) t3.errors.map((e4) => i3({ issues: e4 }));
    else if (t3.code === "invalid_key") i3({ issues: t3.issues });
    else if (t3.code === "invalid_element") i3({ issues: t3.issues });
    else if (t3.path.length === 0) r2._errors.push(n2(t3));
    else {
      let e4 = r2, i4 = 0;
      for (; i4 < t3.path.length; ) {
        let r3 = t3.path[i4];
        i4 === t3.path.length - 1 ? (e4[r3] = e4[r3] || { _errors: [] }, e4[r3]._errors.push(n2(t3))) : e4[r3] = e4[r3] || { _errors: [] }, e4 = e4[r3], i4++;
      }
    }
  };
  return i3(e2), r2;
}
var N = (e2) => (t2, n2, r2, i3) => {
  let a3 = r2 ? Object.assign(r2, { async: false }) : { async: false }, o3 = t2._zod.run({
    value: n2,
    issues: []
  }, a3);
  if (o3 instanceof Promise) throw new g();
  if (o3.issues.length) {
    let t3 = new (i3?.Err ?? e2)(o3.issues.map((e3) => j(e3, a3, v())));
    throw le(t3, i3?.callee), t3;
  }
  return o3.value;
};
var P = (e2) => async (t2, n2, r2, i3) => {
  let a3 = r2 ? Object.assign(r2, { async: true }) : { async: true }, o3 = t2._zod.run({
    value: n2,
    issues: []
  }, a3);
  if (o3 instanceof Promise && (o3 = await o3), o3.issues.length) {
    let t3 = new (i3?.Err ?? e2)(o3.issues.map((e3) => j(e3, a3, v())));
    throw le(t3, i3?.callee), t3;
  }
  return o3.value;
};
var F = (e2) => (t2, n2, r2) => {
  let i3 = r2 ? {
    ...r2,
    async: false
  } : { async: false }, a3 = t2._zod.run({
    value: n2,
    issues: []
  }, i3);
  if (a3 instanceof Promise) throw new g();
  return a3.issues.length ? {
    success: false,
    error: new (e2 ?? we)(a3.issues.map((e3) => j(e3, i3, v())))
  } : {
    success: true,
    data: a3.value
  };
};
var Oe = /* @__PURE__ */ F(Te);
var I = (e2) => async (t2, n2, r2) => {
  let i3 = r2 ? Object.assign(r2, { async: true }) : { async: true }, a3 = t2._zod.run({
    value: n2,
    issues: []
  }, i3);
  return a3 instanceof Promise && (a3 = await a3), a3.issues.length ? {
    success: false,
    error: new e2(a3.issues.map((e3) => j(e3, i3, v())))
  } : {
    success: true,
    data: a3.value
  };
};
var ke = /* @__PURE__ */ I(Te);
var Ae = (e2) => (t2, n2, r2) => {
  let i3 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return N(e2)(t2, n2, i3);
};
var je = (e2) => (t2, n2, r2) => N(e2)(t2, n2, r2);
var Me = (e2) => async (t2, n2, r2) => {
  let i3 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return P(e2)(t2, n2, i3);
};
var Ne = (e2) => async (t2, n2, r2) => P(e2)(t2, n2, r2);
var Pe = (e2) => (t2, n2, r2) => {
  let i3 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return F(e2)(t2, n2, i3);
};
var Fe = (e2) => (t2, n2, r2) => F(e2)(t2, n2, r2);
var Ie = (e2) => async (t2, n2, r2) => {
  let i3 = r2 ? Object.assign(r2, { direction: "backward" }) : { direction: "backward" };
  return I(e2)(t2, n2, i3);
};
var Le = (e2) => async (t2, n2, r2) => I(e2)(t2, n2, r2);
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
  let t2 = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  return typeof e2.precision == "number" ? e2.precision === -1 ? `${t2}` : e2.precision === 0 ? `${t2}:[0-5]\\d` : `${t2}:[0-5]\\d\\.\\d{${e2.precision}}` : `${t2}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function st(e2) {
  return RegExp(`^${ot(e2)}$`);
}
function ct(e2) {
  let t2 = ot({ precision: e2.precision }), n2 = ["Z"];
  e2.local && n2.push(""), e2.offset && n2.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  let r2 = `${t2}(?:${n2.join("|")})`;
  return RegExp(`^${it}T(?:${r2})$`);
}
var lt = (e2) => {
  let t2 = e2 ? `[\\s\\S]{${e2?.minimum ?? 0},${e2?.maximum ?? ""}}` : "[\\s\\S]*";
  return RegExp(`^${t2}$`);
};
var ut = /^[^A-Z]*$/;
var dt = /^[^a-z]*$/;
var L = /* @__PURE__ */ h("$ZodCheck", (e2, t2) => {
  var n2;
  e2._zod ??= {}, e2._zod.def = t2, (n2 = e2._zod).onattach ?? (n2.onattach = []);
});
var ft = /* @__PURE__ */ h("$ZodCheckMaxLength", (e2, t2) => {
  var n2;
  L.init(e2, t2), (n2 = e2._zod.def).when ?? (n2.when = (e3) => {
    let t3 = e3.value;
    return !ae(t3) && t3.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n3 = e3._zod.bag.maximum ?? Infinity;
    t2.maximum < n3 && (e3._zod.bag.maximum = t2.maximum);
  }), e2._zod.check = (n3) => {
    let r2 = n3.value;
    if (r2.length <= t2.maximum) return;
    let i3 = Se(r2);
    n3.issues.push({
      origin: i3,
      code: "too_big",
      maximum: t2.maximum,
      inclusive: true,
      input: r2,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var pt = /* @__PURE__ */ h("$ZodCheckMinLength", (e2, t2) => {
  var n2;
  L.init(e2, t2), (n2 = e2._zod.def).when ?? (n2.when = (e3) => {
    let t3 = e3.value;
    return !ae(t3) && t3.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n3 = e3._zod.bag.minimum ?? -Infinity;
    t2.minimum > n3 && (e3._zod.bag.minimum = t2.minimum);
  }), e2._zod.check = (n3) => {
    let r2 = n3.value;
    if (r2.length >= t2.minimum) return;
    let i3 = Se(r2);
    n3.issues.push({
      origin: i3,
      code: "too_small",
      minimum: t2.minimum,
      inclusive: true,
      input: r2,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var mt = /* @__PURE__ */ h("$ZodCheckLengthEquals", (e2, t2) => {
  var n2;
  L.init(e2, t2), (n2 = e2._zod.def).when ?? (n2.when = (e3) => {
    let t3 = e3.value;
    return !ae(t3) && t3.length !== void 0;
  }), e2._zod.onattach.push((e3) => {
    let n3 = e3._zod.bag;
    n3.minimum = t2.length, n3.maximum = t2.length, n3.length = t2.length;
  }), e2._zod.check = (n3) => {
    let r2 = n3.value, i3 = r2.length;
    if (i3 === t2.length) return;
    let a3 = Se(r2), o3 = i3 > t2.length;
    n3.issues.push({
      origin: a3,
      ...o3 ? {
        code: "too_big",
        maximum: t2.length
      } : {
        code: "too_small",
        minimum: t2.length
      },
      inclusive: true,
      exact: true,
      input: n3.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var R = /* @__PURE__ */ h("$ZodCheckStringFormat", (e2, t2) => {
  var n2, r2;
  L.init(e2, t2), e2._zod.onattach.push((e3) => {
    let n3 = e3._zod.bag;
    n3.format = t2.format, t2.pattern && (n3.patterns ??= /* @__PURE__ */ new Set(), n3.patterns.add(t2.pattern));
  }), t2.pattern ? (n2 = e2._zod).check ?? (n2.check = (n3) => {
    t2.pattern.lastIndex = 0, !t2.pattern.test(n3.value) && n3.issues.push({
      origin: "string",
      code: "invalid_format",
      format: t2.format,
      input: n3.value,
      ...t2.pattern ? { pattern: t2.pattern.toString() } : {},
      inst: e2,
      continue: !t2.abort
    });
  }) : (r2 = e2._zod).check ?? (r2.check = () => {
  });
});
var ht = /* @__PURE__ */ h("$ZodCheckRegex", (e2, t2) => {
  R.init(e2, t2), e2._zod.check = (n2) => {
    t2.pattern.lastIndex = 0, !t2.pattern.test(n2.value) && n2.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: n2.value,
      pattern: t2.pattern.toString(),
      inst: e2,
      continue: !t2.abort
    });
  };
});
var gt = /* @__PURE__ */ h("$ZodCheckLowerCase", (e2, t2) => {
  t2.pattern ??= ut, R.init(e2, t2);
});
var _t = /* @__PURE__ */ h("$ZodCheckUpperCase", (e2, t2) => {
  t2.pattern ??= dt, R.init(e2, t2);
});
var vt = /* @__PURE__ */ h("$ZodCheckIncludes", (e2, t2) => {
  L.init(e2, t2);
  let n2 = E(t2.includes), r2 = new RegExp(typeof t2.position == "number" ? `^.{${t2.position}}${n2}` : n2);
  t2.pattern = r2, e2._zod.onattach.push((e3) => {
    let t3 = e3._zod.bag;
    t3.patterns ??= /* @__PURE__ */ new Set(), t3.patterns.add(r2);
  }), e2._zod.check = (n3) => {
    n3.value.includes(t2.includes, t2.position) || n3.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: t2.includes,
      input: n3.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var yt = /* @__PURE__ */ h("$ZodCheckStartsWith", (e2, t2) => {
  L.init(e2, t2);
  let n2 = RegExp(`^${E(t2.prefix)}.*`);
  t2.pattern ??= n2, e2._zod.onattach.push((e3) => {
    let t3 = e3._zod.bag;
    t3.patterns ??= /* @__PURE__ */ new Set(), t3.patterns.add(n2);
  }), e2._zod.check = (n3) => {
    n3.value.startsWith(t2.prefix) || n3.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: t2.prefix,
      input: n3.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var bt = /* @__PURE__ */ h("$ZodCheckEndsWith", (e2, t2) => {
  L.init(e2, t2);
  let n2 = RegExp(`.*${E(t2.suffix)}$`);
  t2.pattern ??= n2, e2._zod.onattach.push((e3) => {
    let t3 = e3._zod.bag;
    t3.patterns ??= /* @__PURE__ */ new Set(), t3.patterns.add(n2);
  }), e2._zod.check = (n3) => {
    n3.value.endsWith(t2.suffix) || n3.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: t2.suffix,
      input: n3.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var xt = /* @__PURE__ */ h("$ZodCheckOverwrite", (e2, t2) => {
  L.init(e2, t2), e2._zod.check = (e3) => {
    e3.value = t2.tx(e3.value);
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
    let t2 = e2.split("\n").filter((e3) => e3), n2 = Math.min(...t2.map((e3) => e3.length - e3.trimStart().length)), r2 = t2.map((e3) => e3.slice(n2)).map((e3) => " ".repeat(this.indent * 2) + e3);
    for (let e3 of r2) this.content.push(e3);
  }
  compile() {
    let e2 = Function, t2 = this?.args, n2 = [...(this?.content ?? [""]).map((e3) => `  ${e3}`)];
    return new e2(...t2, n2.join("\n"));
  }
};
var Ct = {
  major: 4,
  minor: 1,
  patch: 11
};
var z = /* @__PURE__ */ h("$ZodType", (e2, t2) => {
  var n2;
  e2 ??= {}, e2._zod.def = t2, e2._zod.bag = e2._zod.bag || {}, e2._zod.version = Ct;
  let r2 = [...e2._zod.def.checks ?? []];
  e2._zod.traits.has("$ZodCheck") && r2.unshift(e2);
  for (let t3 of r2) for (let n3 of t3._zod.onattach) n3(e2);
  if (r2.length === 0) (n2 = e2._zod).deferred ?? (n2.deferred = []), e2._zod.deferred?.push(() => {
    e2._zod.run = e2._zod.parse;
  });
  else {
    let t3 = (e3, t4, n4) => {
      let r3 = k(e3), i3;
      for (let a3 of t4) {
        if (a3._zod.def.when) {
          if (!a3._zod.def.when(e3)) continue;
        } else if (r3) continue;
        let t5 = e3.issues.length, o3 = a3._zod.check(e3);
        if (o3 instanceof Promise && n4?.async === false) throw new g();
        if (i3 || o3 instanceof Promise) i3 = (i3 ?? Promise.resolve()).then(async () => {
          await o3, e3.issues.length !== t5 && (r3 ||= k(e3, t5));
        });
        else {
          if (e3.issues.length === t5) continue;
          r3 ||= k(e3, t5);
        }
      }
      return i3 ? i3.then(() => e3) : e3;
    }, n3 = (n4, i3, a3) => {
      if (k(n4)) return n4.aborted = true, n4;
      let o3 = t3(i3, r2, a3);
      if (o3 instanceof Promise) {
        if (a3.async === false) throw new g();
        return o3.then((t4) => e2._zod.parse(t4, a3));
      }
      return e2._zod.parse(o3, a3);
    };
    e2._zod.run = (i3, a3) => {
      if (a3.skipChecks) return e2._zod.parse(i3, a3);
      if (a3.direction === "backward") {
        let t4 = e2._zod.parse({
          value: i3.value,
          issues: []
        }, {
          ...a3,
          skipChecks: true
        });
        return t4 instanceof Promise ? t4.then((e3) => n3(e3, i3, a3)) : n3(t4, i3, a3);
      }
      let o3 = e2._zod.parse(i3, a3);
      if (o3 instanceof Promise) {
        if (a3.async === false) throw new g();
        return o3.then((e3) => t3(e3, r2, a3));
      }
      return t3(o3, r2, a3);
    };
  }
  e2["~standard"] = {
    validate: (t3) => {
      try {
        let n3 = Oe(e2, t3);
        return n3.success ? { value: n3.data } : { issues: n3.error?.issues };
      } catch {
        return ke(e2, t3).then((e3) => e3.success ? { value: e3.data } : { issues: e3.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  };
});
var B = /* @__PURE__ */ h("$ZodString", (e2, t2) => {
  z.init(e2, t2), e2._zod.pattern = [...e2?._zod.bag?.patterns ?? []].pop() ?? lt(e2._zod.bag), e2._zod.parse = (n2, r2) => {
    if (t2.coerce) try {
      n2.value = String(n2.value);
    } catch {
    }
    return typeof n2.value == "string" || n2.issues.push({
      expected: "string",
      code: "invalid_type",
      input: n2.value,
      inst: e2
    }), n2;
  };
});
var V = /* @__PURE__ */ h("$ZodStringFormat", (e2, t2) => {
  R.init(e2, t2), B.init(e2, t2);
});
var wt = /* @__PURE__ */ h("$ZodGUID", (e2, t2) => {
  t2.pattern ??= Ge, V.init(e2, t2);
});
var Tt = /* @__PURE__ */ h("$ZodUUID", (e2, t2) => {
  if (t2.version) {
    let e3 = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    }[t2.version];
    if (e3 === void 0) throw Error(`Invalid UUID version: "${t2.version}"`);
    t2.pattern ??= Ke(e3);
  } else t2.pattern ??= Ke();
  V.init(e2, t2);
});
var Et = /* @__PURE__ */ h("$ZodEmail", (e2, t2) => {
  t2.pattern ??= qe, V.init(e2, t2);
});
var Dt = /* @__PURE__ */ h("$ZodURL", (e2, t2) => {
  V.init(e2, t2), e2._zod.check = (n2) => {
    try {
      let r2 = n2.value.trim(), i3 = new URL(r2);
      t2.hostname && (t2.hostname.lastIndex = 0, t2.hostname.test(i3.hostname) || n2.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid hostname",
        pattern: nt.source,
        input: n2.value,
        inst: e2,
        continue: !t2.abort
      })), t2.protocol && (t2.protocol.lastIndex = 0, t2.protocol.test(i3.protocol.endsWith(":") ? i3.protocol.slice(0, -1) : i3.protocol) || n2.issues.push({
        code: "invalid_format",
        format: "url",
        note: "Invalid protocol",
        pattern: t2.protocol.source,
        input: n2.value,
        inst: e2,
        continue: !t2.abort
      })), t2.normalize ? n2.value = i3.href : n2.value = r2;
      return;
    } catch {
      n2.issues.push({
        code: "invalid_format",
        format: "url",
        input: n2.value,
        inst: e2,
        continue: !t2.abort
      });
    }
  };
});
var Ot = /* @__PURE__ */ h("$ZodEmoji", (e2, t2) => {
  t2.pattern ??= Ye(), V.init(e2, t2);
});
var kt = /* @__PURE__ */ h("$ZodNanoID", (e2, t2) => {
  t2.pattern ??= Ue, V.init(e2, t2);
});
var At = /* @__PURE__ */ h("$ZodCUID", (e2, t2) => {
  t2.pattern ??= Re, V.init(e2, t2);
});
var jt = /* @__PURE__ */ h("$ZodCUID2", (e2, t2) => {
  t2.pattern ??= ze, V.init(e2, t2);
});
var Mt = /* @__PURE__ */ h("$ZodULID", (e2, t2) => {
  t2.pattern ??= Be, V.init(e2, t2);
});
var Nt = /* @__PURE__ */ h("$ZodXID", (e2, t2) => {
  t2.pattern ??= Ve, V.init(e2, t2);
});
var Pt = /* @__PURE__ */ h("$ZodKSUID", (e2, t2) => {
  t2.pattern ??= He, V.init(e2, t2);
});
var Ft = /* @__PURE__ */ h("$ZodISODateTime", (e2, t2) => {
  t2.pattern ??= ct(t2), V.init(e2, t2);
});
var It = /* @__PURE__ */ h("$ZodISODate", (e2, t2) => {
  t2.pattern ??= at, V.init(e2, t2);
});
var Lt = /* @__PURE__ */ h("$ZodISOTime", (e2, t2) => {
  t2.pattern ??= st(t2), V.init(e2, t2);
});
var Rt = /* @__PURE__ */ h("$ZodISODuration", (e2, t2) => {
  t2.pattern ??= We, V.init(e2, t2);
});
var zt = /* @__PURE__ */ h("$ZodIPv4", (e2, t2) => {
  t2.pattern ??= Xe, V.init(e2, t2), e2._zod.onattach.push((e3) => {
    let t3 = e3._zod.bag;
    t3.format = "ipv4";
  });
});
var Bt = /* @__PURE__ */ h("$ZodIPv6", (e2, t2) => {
  t2.pattern ??= Ze, V.init(e2, t2), e2._zod.onattach.push((e3) => {
    let t3 = e3._zod.bag;
    t3.format = "ipv6";
  }), e2._zod.check = (n2) => {
    try {
      new URL(`http://[${n2.value}]`);
    } catch {
      n2.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: n2.value,
        inst: e2,
        continue: !t2.abort
      });
    }
  };
});
var Vt = /* @__PURE__ */ h("$ZodCIDRv4", (e2, t2) => {
  t2.pattern ??= Qe, V.init(e2, t2);
});
var Ht = /* @__PURE__ */ h("$ZodCIDRv6", (e2, t2) => {
  t2.pattern ??= $e, V.init(e2, t2), e2._zod.check = (n2) => {
    let r2 = n2.value.split("/");
    try {
      if (r2.length !== 2) throw Error();
      let [e3, t3] = r2;
      if (!t3) throw Error();
      let n3 = Number(t3);
      if (`${n3}` !== t3 || n3 < 0 || n3 > 128) throw Error();
      new URL(`http://[${e3}]`);
    } catch {
      n2.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: n2.value,
        inst: e2,
        continue: !t2.abort
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
var Wt = /* @__PURE__ */ h("$ZodBase64", (e2, t2) => {
  t2.pattern ??= et, V.init(e2, t2), e2._zod.onattach.push((e3) => {
    e3._zod.bag.contentEncoding = "base64";
  }), e2._zod.check = (n2) => {
    Ut(n2.value) || n2.issues.push({
      code: "invalid_format",
      format: "base64",
      input: n2.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
function Gt(e2) {
  if (!tt.test(e2)) return false;
  let t2 = e2.replace(/[-_]/g, (e3) => e3 === "-" ? "+" : "/");
  return Ut(t2.padEnd(Math.ceil(t2.length / 4) * 4, "="));
}
var Kt = /* @__PURE__ */ h("$ZodBase64URL", (e2, t2) => {
  t2.pattern ??= tt, V.init(e2, t2), e2._zod.onattach.push((e3) => {
    e3._zod.bag.contentEncoding = "base64url";
  }), e2._zod.check = (n2) => {
    Gt(n2.value) || n2.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: n2.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var qt = /* @__PURE__ */ h("$ZodE164", (e2, t2) => {
  t2.pattern ??= rt, V.init(e2, t2);
});
function Jt(e2, t2 = null) {
  try {
    let n2 = e2.split(".");
    if (n2.length !== 3) return false;
    let [r2] = n2;
    if (!r2) return false;
    let i3 = JSON.parse(atob(r2));
    return !("typ" in i3 && i3?.typ !== "JWT" || !i3.alg || t2 && (!("alg" in i3) || i3.alg !== t2));
  } catch {
    return false;
  }
}
var Yt = /* @__PURE__ */ h("$ZodJWT", (e2, t2) => {
  V.init(e2, t2), e2._zod.check = (n2) => {
    Jt(n2.value, t2.alg) || n2.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: n2.value,
      inst: e2,
      continue: !t2.abort
    });
  };
});
var Xt = /* @__PURE__ */ h("$ZodUnknown", (e2, t2) => {
  z.init(e2, t2), e2._zod.parse = (e3) => e3;
});
var Zt = /* @__PURE__ */ h("$ZodNever", (e2, t2) => {
  z.init(e2, t2), e2._zod.parse = (t3, n2) => (t3.issues.push({
    expected: "never",
    code: "invalid_type",
    input: t3.value,
    inst: e2
  }), t3);
});
function Qt(e2, t2, n2) {
  e2.issues.length && t2.issues.push(...xe(n2, e2.issues)), t2.value[n2] = e2.value;
}
var $t = /* @__PURE__ */ h("$ZodArray", (e2, t2) => {
  z.init(e2, t2), e2._zod.parse = (n2, r2) => {
    let i3 = n2.value;
    if (!Array.isArray(i3)) return n2.issues.push({
      expected: "array",
      code: "invalid_type",
      input: i3,
      inst: e2
    }), n2;
    n2.value = Array(i3.length);
    let a3 = [];
    for (let e3 = 0; e3 < i3.length; e3++) {
      let o3 = i3[e3], s3 = t2.element._zod.run({
        value: o3,
        issues: []
      }, r2);
      s3 instanceof Promise ? a3.push(s3.then((t3) => Qt(t3, n2, e3))) : Qt(s3, n2, e3);
    }
    return a3.length ? Promise.all(a3).then(() => n2) : n2;
  };
});
function H(e2, t2, n2, r2) {
  e2.issues.length && t2.issues.push(...xe(n2, e2.issues)), e2.value === void 0 ? n2 in r2 && (t2.value[n2] = void 0) : t2.value[n2] = e2.value;
}
function en(e2) {
  let t2 = Object.keys(e2.shape);
  for (let n3 of t2) if (!e2.shape?.[n3]?._zod?.traits?.has("$ZodType")) throw Error(`Invalid element at key "${n3}": expected a Zod schema`);
  let n2 = pe(e2.shape);
  return {
    ...e2,
    keys: t2,
    keySet: new Set(t2),
    numKeys: t2.length,
    optionalKeys: new Set(n2)
  };
}
function tn(e2, t2, n2, r2, i3, a3) {
  let o3 = [], s3 = i3.keySet, c3 = i3.catchall._zod, l3 = c3.def.type;
  for (let i4 of Object.keys(t2)) {
    if (s3.has(i4)) continue;
    if (l3 === "never") {
      o3.push(i4);
      continue;
    }
    let a4 = c3.run({
      value: t2[i4],
      issues: []
    }, r2);
    a4 instanceof Promise ? e2.push(a4.then((e3) => H(e3, n2, i4, t2))) : H(a4, n2, i4, t2);
  }
  return o3.length && n2.issues.push({
    code: "unrecognized_keys",
    keys: o3,
    input: t2,
    inst: a3
  }), e2.length ? Promise.all(e2).then(() => n2) : n2;
}
var nn = /* @__PURE__ */ h("$ZodObject", (e2, t2) => {
  if (z.init(e2, t2), !Object.getOwnPropertyDescriptor(t2, "shape")?.get) {
    let e3 = t2.shape;
    Object.defineProperty(t2, "shape", { get: () => {
      let n3 = { ...e3 };
      return Object.defineProperty(t2, "shape", { value: n3 }), n3;
    } });
  }
  let n2 = b(() => en(t2));
  x(e2._zod, "propValues", () => {
    let e3 = t2.shape, n3 = {};
    for (let t3 in e3) {
      let r3 = e3[t3]._zod;
      if (r3.values) {
        n3[t3] ?? (n3[t3] = /* @__PURE__ */ new Set());
        for (let e4 of r3.values) n3[t3].add(e4);
      }
    }
    return n3;
  });
  let r2 = w, i3 = t2.catchall, a3;
  e2._zod.parse = (t3, o3) => {
    a3 ??= n2.value;
    let s3 = t3.value;
    if (!r2(s3)) return t3.issues.push({
      expected: "object",
      code: "invalid_type",
      input: s3,
      inst: e2
    }), t3;
    t3.value = {};
    let c3 = [], l3 = a3.shape;
    for (let e3 of a3.keys) {
      let n3 = l3[e3]._zod.run({
        value: s3[e3],
        issues: []
      }, o3);
      n3 instanceof Promise ? c3.push(n3.then((n4) => H(n4, t3, e3, s3))) : H(n3, t3, e3, s3);
    }
    return i3 ? tn(c3, s3, t3, o3, n2.value, e2) : c3.length ? Promise.all(c3).then(() => t3) : t3;
  };
});
var rn = /* @__PURE__ */ h("$ZodObjectJIT", (e2, t2) => {
  nn.init(e2, t2);
  let n2 = e2._zod.parse, r2 = b(() => en(t2)), i3 = (e3) => {
    let t3 = new St([
      "shape",
      "payload",
      "ctx"
    ]), n3 = r2.value, i4 = (e4) => {
      let t4 = ce(e4);
      return `shape[${t4}]._zod.run({ value: input[${t4}], issues: [] }, ctx)`;
    };
    t3.write("const input = payload.value;");
    let a4 = /* @__PURE__ */ Object.create(null), o4 = 0;
    for (let e4 of n3.keys) a4[e4] = `key_${o4++}`;
    t3.write("const newResult = {};");
    for (let e4 of n3.keys) {
      let n4 = a4[e4], r3 = ce(e4);
      t3.write(`const ${n4} = ${i4(e4)};`), t3.write(`
        if (${n4}.issues.length) {
          payload.issues = payload.issues.concat(${n4}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${r3}, ...iss.path] : [${r3}]
          })));
        }
        
        
        if (${n4}.value === undefined) {
          if (${r3} in input) {
            newResult[${r3}] = undefined;
          }
        } else {
          newResult[${r3}] = ${n4}.value;
        }
        
      `);
    }
    t3.write("payload.value = newResult;"), t3.write("return payload;");
    let s4 = t3.compile();
    return (t4, n4) => s4(e3, t4, n4);
  }, a3, o3 = w, s3 = !_.jitless, c3 = s3 && ue.value, l3 = t2.catchall, u3;
  e2._zod.parse = (d2, f2) => {
    u3 ??= r2.value;
    let p2 = d2.value;
    return o3(p2) ? s3 && c3 && f2?.async === false && f2.jitless !== true ? (a3 ||= i3(t2.shape), d2 = a3(d2, f2), l3 ? tn([], p2, d2, f2, u3, e2) : d2) : n2(d2, f2) : (d2.issues.push({
      expected: "object",
      code: "invalid_type",
      input: p2,
      inst: e2
    }), d2);
  };
});
function an(e2, t2, n2, r2) {
  for (let n3 of e2) if (n3.issues.length === 0) return t2.value = n3.value, t2;
  let i3 = e2.filter((e3) => !k(e3));
  return i3.length === 1 ? (t2.value = i3[0].value, i3[0]) : (t2.issues.push({
    code: "invalid_union",
    input: t2.value,
    inst: n2,
    errors: e2.map((e3) => e3.issues.map((e4) => j(e4, r2, v())))
  }), t2);
}
var on = /* @__PURE__ */ h("$ZodUnion", (e2, t2) => {
  z.init(e2, t2), x(e2._zod, "optin", () => t2.options.some((e3) => e3._zod.optin === "optional") ? "optional" : void 0), x(e2._zod, "optout", () => t2.options.some((e3) => e3._zod.optout === "optional") ? "optional" : void 0), x(e2._zod, "values", () => {
    if (t2.options.every((e3) => e3._zod.values)) return new Set(t2.options.flatMap((e3) => Array.from(e3._zod.values)));
  }), x(e2._zod, "pattern", () => {
    if (t2.options.every((e3) => e3._zod.pattern)) {
      let e3 = t2.options.map((e4) => e4._zod.pattern);
      return RegExp(`^(${e3.map((e4) => oe(e4.source)).join("|")})$`);
    }
  });
  let n2 = t2.options.length === 1, r2 = t2.options[0]._zod.run;
  e2._zod.parse = (i3, a3) => {
    if (n2) return r2(i3, a3);
    let o3 = false, s3 = [];
    for (let e3 of t2.options) {
      let t3 = e3._zod.run({
        value: i3.value,
        issues: []
      }, a3);
      if (t3 instanceof Promise) s3.push(t3), o3 = true;
      else {
        if (t3.issues.length === 0) return t3;
        s3.push(t3);
      }
    }
    return o3 ? Promise.all(s3).then((t3) => an(t3, i3, e2, a3)) : an(s3, i3, e2, a3);
  };
});
var sn = /* @__PURE__ */ h("$ZodIntersection", (e2, t2) => {
  z.init(e2, t2), e2._zod.parse = (e3, n2) => {
    let r2 = e3.value, i3 = t2.left._zod.run({
      value: r2,
      issues: []
    }, n2), a3 = t2.right._zod.run({
      value: r2,
      issues: []
    }, n2);
    return i3 instanceof Promise || a3 instanceof Promise ? Promise.all([i3, a3]).then(([t3, n3]) => cn(e3, t3, n3)) : cn(e3, i3, a3);
  };
});
function U(e2, t2) {
  if (e2 === t2 || e2 instanceof Date && t2 instanceof Date && +e2 == +t2) return {
    valid: true,
    data: e2
  };
  if (T(e2) && T(t2)) {
    let n2 = Object.keys(t2), r2 = Object.keys(e2).filter((e3) => n2.indexOf(e3) !== -1), i3 = {
      ...e2,
      ...t2
    };
    for (let n3 of r2) {
      let r3 = U(e2[n3], t2[n3]);
      if (!r3.valid) return {
        valid: false,
        mergeErrorPath: [n3, ...r3.mergeErrorPath]
      };
      i3[n3] = r3.data;
    }
    return {
      valid: true,
      data: i3
    };
  }
  if (Array.isArray(e2) && Array.isArray(t2)) {
    if (e2.length !== t2.length) return {
      valid: false,
      mergeErrorPath: []
    };
    let n2 = [];
    for (let r2 = 0; r2 < e2.length; r2++) {
      let i3 = e2[r2], a3 = t2[r2], o3 = U(i3, a3);
      if (!o3.valid) return {
        valid: false,
        mergeErrorPath: [r2, ...o3.mergeErrorPath]
      };
      n2.push(o3.data);
    }
    return {
      valid: true,
      data: n2
    };
  }
  return {
    valid: false,
    mergeErrorPath: []
  };
}
function cn(e2, t2, n2) {
  if (t2.issues.length && e2.issues.push(...t2.issues), n2.issues.length && e2.issues.push(...n2.issues), k(e2)) return e2;
  let r2 = U(t2.value, n2.value);
  if (!r2.valid) throw Error(`Unmergable intersection. Error path: ${JSON.stringify(r2.mergeErrorPath)}`);
  return e2.value = r2.data, e2;
}
var ln = /* @__PURE__ */ h("$ZodEnum", (e2, t2) => {
  z.init(e2, t2);
  let n2 = ie(t2.entries), r2 = new Set(n2);
  e2._zod.values = r2, e2._zod.pattern = RegExp(`^(${n2.filter((e3) => fe.has(typeof e3)).map((e3) => typeof e3 == "string" ? E(e3) : e3.toString()).join("|")})$`), e2._zod.parse = (t3, i3) => {
    let a3 = t3.value;
    return r2.has(a3) || t3.issues.push({
      code: "invalid_value",
      values: n2,
      input: a3,
      inst: e2
    }), t3;
  };
});
var un = /* @__PURE__ */ h("$ZodTransform", (e2, t2) => {
  z.init(e2, t2), e2._zod.parse = (n2, r2) => {
    if (r2.direction === "backward") throw new re(e2.constructor.name);
    let i3 = t2.transform(n2.value, n2);
    if (r2.async) return (i3 instanceof Promise ? i3 : Promise.resolve(i3)).then((e3) => (n2.value = e3, n2));
    if (i3 instanceof Promise) throw new g();
    return n2.value = i3, n2;
  };
});
function dn(e2, t2) {
  return e2.issues.length && t2 === void 0 ? {
    issues: [],
    value: void 0
  } : e2;
}
var fn = /* @__PURE__ */ h("$ZodOptional", (e2, t2) => {
  z.init(e2, t2), e2._zod.optin = "optional", e2._zod.optout = "optional", x(e2._zod, "values", () => t2.innerType._zod.values ? /* @__PURE__ */ new Set([...t2.innerType._zod.values, void 0]) : void 0), x(e2._zod, "pattern", () => {
    let e3 = t2.innerType._zod.pattern;
    return e3 ? RegExp(`^(${oe(e3.source)})?$`) : void 0;
  }), e2._zod.parse = (e3, n2) => {
    if (t2.innerType._zod.optin === "optional") {
      let r2 = t2.innerType._zod.run(e3, n2);
      return r2 instanceof Promise ? r2.then((t3) => dn(t3, e3.value)) : dn(r2, e3.value);
    }
    return e3.value === void 0 ? e3 : t2.innerType._zod.run(e3, n2);
  };
});
var pn = /* @__PURE__ */ h("$ZodNullable", (e2, t2) => {
  z.init(e2, t2), x(e2._zod, "optin", () => t2.innerType._zod.optin), x(e2._zod, "optout", () => t2.innerType._zod.optout), x(e2._zod, "pattern", () => {
    let e3 = t2.innerType._zod.pattern;
    return e3 ? RegExp(`^(${oe(e3.source)}|null)$`) : void 0;
  }), x(e2._zod, "values", () => t2.innerType._zod.values ? /* @__PURE__ */ new Set([...t2.innerType._zod.values, null]) : void 0), e2._zod.parse = (e3, n2) => e3.value === null ? e3 : t2.innerType._zod.run(e3, n2);
});
var mn = /* @__PURE__ */ h("$ZodDefault", (e2, t2) => {
  z.init(e2, t2), e2._zod.optin = "optional", x(e2._zod, "values", () => t2.innerType._zod.values), e2._zod.parse = (e3, n2) => {
    if (n2.direction === "backward") return t2.innerType._zod.run(e3, n2);
    if (e3.value === void 0) return e3.value = t2.defaultValue, e3;
    let r2 = t2.innerType._zod.run(e3, n2);
    return r2 instanceof Promise ? r2.then((e4) => hn(e4, t2)) : hn(r2, t2);
  };
});
function hn(e2, t2) {
  return e2.value === void 0 && (e2.value = t2.defaultValue), e2;
}
var gn = /* @__PURE__ */ h("$ZodPrefault", (e2, t2) => {
  z.init(e2, t2), e2._zod.optin = "optional", x(e2._zod, "values", () => t2.innerType._zod.values), e2._zod.parse = (e3, n2) => (n2.direction === "backward" || e3.value === void 0 && (e3.value = t2.defaultValue), t2.innerType._zod.run(e3, n2));
});
var _n = /* @__PURE__ */ h("$ZodNonOptional", (e2, t2) => {
  z.init(e2, t2), x(e2._zod, "values", () => {
    let e3 = t2.innerType._zod.values;
    return e3 ? new Set([...e3].filter((e4) => e4 !== void 0)) : void 0;
  }), e2._zod.parse = (n2, r2) => {
    let i3 = t2.innerType._zod.run(n2, r2);
    return i3 instanceof Promise ? i3.then((t3) => vn(t3, e2)) : vn(i3, e2);
  };
});
function vn(e2, t2) {
  return !e2.issues.length && e2.value === void 0 && e2.issues.push({
    code: "invalid_type",
    expected: "nonoptional",
    input: e2.value,
    inst: t2
  }), e2;
}
var yn = /* @__PURE__ */ h("$ZodCatch", (e2, t2) => {
  z.init(e2, t2), x(e2._zod, "optin", () => t2.innerType._zod.optin), x(e2._zod, "optout", () => t2.innerType._zod.optout), x(e2._zod, "values", () => t2.innerType._zod.values), e2._zod.parse = (e3, n2) => {
    if (n2.direction === "backward") return t2.innerType._zod.run(e3, n2);
    let r2 = t2.innerType._zod.run(e3, n2);
    return r2 instanceof Promise ? r2.then((r3) => (e3.value = r3.value, r3.issues.length && (e3.value = t2.catchValue({
      ...e3,
      error: { issues: r3.issues.map((e4) => j(e4, n2, v())) },
      input: e3.value
    }), e3.issues = []), e3)) : (e3.value = r2.value, r2.issues.length && (e3.value = t2.catchValue({
      ...e3,
      error: { issues: r2.issues.map((e4) => j(e4, n2, v())) },
      input: e3.value
    }), e3.issues = []), e3);
  };
});
var bn = /* @__PURE__ */ h("$ZodPipe", (e2, t2) => {
  z.init(e2, t2), x(e2._zod, "values", () => t2.in._zod.values), x(e2._zod, "optin", () => t2.in._zod.optin), x(e2._zod, "optout", () => t2.out._zod.optout), x(e2._zod, "propValues", () => t2.in._zod.propValues), e2._zod.parse = (e3, n2) => {
    if (n2.direction === "backward") {
      let r3 = t2.out._zod.run(e3, n2);
      return r3 instanceof Promise ? r3.then((e4) => W(e4, t2.in, n2)) : W(r3, t2.in, n2);
    }
    let r2 = t2.in._zod.run(e3, n2);
    return r2 instanceof Promise ? r2.then((e4) => W(e4, t2.out, n2)) : W(r2, t2.out, n2);
  };
});
function W(e2, t2, n2) {
  return e2.issues.length ? (e2.aborted = true, e2) : t2._zod.run({
    value: e2.value,
    issues: e2.issues
  }, n2);
}
var xn = /* @__PURE__ */ h("$ZodReadonly", (e2, t2) => {
  z.init(e2, t2), x(e2._zod, "propValues", () => t2.innerType._zod.propValues), x(e2._zod, "values", () => t2.innerType._zod.values), x(e2._zod, "optin", () => t2.innerType._zod.optin), x(e2._zod, "optout", () => t2.innerType._zod.optout), e2._zod.parse = (e3, n2) => {
    if (n2.direction === "backward") return t2.innerType._zod.run(e3, n2);
    let r2 = t2.innerType._zod.run(e3, n2);
    return r2 instanceof Promise ? r2.then(Sn) : Sn(r2);
  };
});
function Sn(e2) {
  return e2.value = Object.freeze(e2.value), e2;
}
var Cn = /* @__PURE__ */ h("$ZodCustom", (e2, t2) => {
  L.init(e2, t2), z.init(e2, t2), e2._zod.parse = (e3, t3) => e3, e2._zod.check = (n2) => {
    let r2 = n2.value, i3 = t2.fn(r2);
    if (i3 instanceof Promise) return i3.then((t3) => wn(t3, n2, r2, e2));
    wn(i3, n2, r2, e2);
  };
});
function wn(e2, t2, n2, r2) {
  if (!e2) {
    let e3 = {
      code: "custom",
      input: n2,
      inst: r2,
      path: [...r2._zod.def.path ?? []],
      continue: !r2._zod.def.abort
    };
    r2._zod.def.params && (e3.params = r2._zod.def.params), t2.issues.push(M(e3));
  }
}
var Tn = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
  }
  add(e2, ...t2) {
    let n2 = t2[0];
    if (this._map.set(e2, n2), n2 && typeof n2 == "object" && "id" in n2) {
      if (this._idmap.has(n2.id)) throw Error(`ID ${n2.id} already exists in the registry`);
      this._idmap.set(n2.id, e2);
    }
    return this;
  }
  clear() {
    return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
  }
  remove(e2) {
    let t2 = this._map.get(e2);
    return t2 && typeof t2 == "object" && "id" in t2 && this._idmap.delete(t2.id), this._map.delete(e2), this;
  }
  get(e2) {
    let t2 = e2._zod.parent;
    if (t2) {
      let n2 = { ...this.get(t2) ?? {} };
      delete n2.id;
      let r2 = {
        ...n2,
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
function Dn(e2, t2) {
  return new e2({
    type: "string",
    ...O(t2)
  });
}
function On(e2, t2) {
  return new e2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function kn(e2, t2) {
  return new e2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function An(e2, t2) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function jn(e2, t2) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...O(t2)
  });
}
function Mn(e2, t2) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...O(t2)
  });
}
function Nn(e2, t2) {
  return new e2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...O(t2)
  });
}
function Pn(e2, t2) {
  return new e2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Fn(e2, t2) {
  return new e2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function In(e2, t2) {
  return new e2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Ln(e2, t2) {
  return new e2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Rn(e2, t2) {
  return new e2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function zn(e2, t2) {
  return new e2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Bn(e2, t2) {
  return new e2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Vn(e2, t2) {
  return new e2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Hn(e2, t2) {
  return new e2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Un(e2, t2) {
  return new e2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Wn(e2, t2) {
  return new e2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Gn(e2, t2) {
  return new e2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Kn(e2, t2) {
  return new e2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function qn(e2, t2) {
  return new e2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Jn(e2, t2) {
  return new e2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Yn(e2, t2) {
  return new e2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...O(t2)
  });
}
function Xn(e2, t2) {
  return new e2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...O(t2)
  });
}
function Zn(e2, t2) {
  return new e2({
    type: "string",
    format: "date",
    check: "string_format",
    ...O(t2)
  });
}
function Qn(e2, t2) {
  return new e2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...O(t2)
  });
}
function $n(e2, t2) {
  return new e2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...O(t2)
  });
}
function er(e2) {
  return new e2({ type: "unknown" });
}
function tr(e2, t2) {
  return new e2({
    type: "never",
    ...O(t2)
  });
}
function nr(e2, t2) {
  return new ft({
    check: "max_length",
    ...O(t2),
    maximum: e2
  });
}
function K(e2, t2) {
  return new pt({
    check: "min_length",
    ...O(t2),
    minimum: e2
  });
}
function rr(e2, t2) {
  return new mt({
    check: "length_equals",
    ...O(t2),
    length: e2
  });
}
function ir(e2, t2) {
  return new ht({
    check: "string_format",
    format: "regex",
    ...O(t2),
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
function sr(e2, t2) {
  return new vt({
    check: "string_format",
    format: "includes",
    ...O(t2),
    includes: e2
  });
}
function cr(e2, t2) {
  return new yt({
    check: "string_format",
    format: "starts_with",
    ...O(t2),
    prefix: e2
  });
}
function lr(e2, t2) {
  return new bt({
    check: "string_format",
    format: "ends_with",
    ...O(t2),
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
  return q((t2) => t2.normalize(e2));
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
function mr(e2, t2, n2) {
  return new e2({
    type: "array",
    element: t2,
    ...O(n2)
  });
}
function hr(e2, t2, n2) {
  return new e2({
    type: "custom",
    check: "custom",
    fn: t2,
    ...O(n2)
  });
}
function gr(e2) {
  let t2 = _r((n2) => (n2.addIssue = (e3) => {
    if (typeof e3 == "string") n2.issues.push(M(e3, n2.value, t2._zod.def));
    else {
      let r2 = e3;
      r2.fatal && (r2.continue = false), r2.code ??= "custom", r2.input ??= n2.value, r2.inst ??= t2, r2.continue ??= !t2._zod.def.abort, n2.issues.push(M(r2));
    }
  }, e2(n2.value, n2)));
  return t2;
}
function _r(e2, t2) {
  let n2 = new L({
    check: "custom",
    ...O(t2)
  });
  return n2._zod.check = e2, n2;
}
var vr = /* @__PURE__ */ h("ZodISODateTime", (e2, t2) => {
  Ft.init(e2, t2), X.init(e2, t2);
});
function yr(e2) {
  return Xn(vr, e2);
}
var br = /* @__PURE__ */ h("ZodISODate", (e2, t2) => {
  It.init(e2, t2), X.init(e2, t2);
});
function xr(e2) {
  return Zn(br, e2);
}
var Sr = /* @__PURE__ */ h("ZodISOTime", (e2, t2) => {
  Lt.init(e2, t2), X.init(e2, t2);
});
function Cr(e2) {
  return Qn(Sr, e2);
}
var wr = /* @__PURE__ */ h("ZodISODuration", (e2, t2) => {
  Rt.init(e2, t2), X.init(e2, t2);
});
function Tr(e2) {
  return $n(wr, e2);
}
var Er = (e2, t2) => {
  we.init(e2, t2), e2.name = "ZodError", Object.defineProperties(e2, {
    format: { value: (t3) => De(e2, t3) },
    flatten: { value: (t3) => Ee(e2, t3) },
    addIssue: { value: (t3) => {
      e2.issues.push(t3), e2.message = JSON.stringify(e2.issues, y, 2);
    } },
    addIssues: { value: (t3) => {
      e2.issues.push(...t3), e2.message = JSON.stringify(e2.issues, y, 2);
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
var Y = /* @__PURE__ */ h("ZodType", (e2, t2) => (z.init(e2, t2), e2.def = t2, e2.type = t2.type, Object.defineProperty(e2, "_def", { value: t2 }), e2.check = (...n2) => e2.clone(C(t2, { checks: [...t2.checks ?? [], ...n2.map((e3) => typeof e3 == "function" ? { _zod: {
  check: e3,
  def: { check: "custom" },
  onattach: []
} } : e3)] })), e2.clone = (t3, n2) => D(e2, t3, n2), e2.brand = () => e2, e2.register = ((t3, n2) => (t3.add(e2, n2), e2)), e2.parse = (t3, n2) => Dr(e2, t3, n2, { callee: e2.parse }), e2.safeParse = (t3, n2) => kr(e2, t3, n2), e2.parseAsync = async (t3, n2) => Or(e2, t3, n2, { callee: e2.parseAsync }), e2.safeParseAsync = async (t3, n2) => Ar(e2, t3, n2), e2.spa = e2.safeParseAsync, e2.encode = (t3, n2) => jr(e2, t3, n2), e2.decode = (t3, n2) => Mr(e2, t3, n2), e2.encodeAsync = async (t3, n2) => Nr(e2, t3, n2), e2.decodeAsync = async (t3, n2) => Pr(e2, t3, n2), e2.safeEncode = (t3, n2) => Fr(e2, t3, n2), e2.safeDecode = (t3, n2) => Ir(e2, t3, n2), e2.safeEncodeAsync = async (t3, n2) => Lr(e2, t3, n2), e2.safeDecodeAsync = async (t3, n2) => Rr(e2, t3, n2), e2.refine = (t3, n2) => e2.check(zi(t3, n2)), e2.superRefine = (t3) => e2.check(Bi(t3)), e2.overwrite = (t3) => e2.check(q(t3)), e2.optional = () => Ci(e2), e2.nullable = () => Ti(e2), e2.nullish = () => Ci(Ti(e2)), e2.nonoptional = (t3) => ji(e2, t3), e2.array = () => di(e2), e2.or = (t3) => hi([e2, t3]), e2.and = (t3) => _i(e2, t3), e2.transform = (t3) => Fi(e2, xi(t3)), e2.default = (t3) => Di(e2, t3), e2.prefault = (t3) => ki(e2, t3), e2.catch = (t3) => Ni(e2, t3), e2.pipe = (t3) => Fi(e2, t3), e2.readonly = () => Li(e2), e2.describe = (t3) => {
  let n2 = e2.clone();
  return G.add(n2, { description: t3 }), n2;
}, Object.defineProperty(e2, "description", {
  get() {
    return G.get(e2)?.description;
  },
  configurable: true
}), e2.meta = (...t3) => {
  if (t3.length === 0) return G.get(e2);
  let n2 = e2.clone();
  return G.add(n2, t3[0]), n2;
}, e2.isOptional = () => e2.safeParse(void 0).success, e2.isNullable = () => e2.safeParse(null).success, e2));
var zr = /* @__PURE__ */ h("_ZodString", (e2, t2) => {
  B.init(e2, t2), Y.init(e2, t2);
  let n2 = e2._zod.bag;
  e2.format = n2.format ?? null, e2.minLength = n2.minimum ?? null, e2.maxLength = n2.maximum ?? null, e2.regex = (...t3) => e2.check(ir(...t3)), e2.includes = (...t3) => e2.check(sr(...t3)), e2.startsWith = (...t3) => e2.check(cr(...t3)), e2.endsWith = (...t3) => e2.check(lr(...t3)), e2.min = (...t3) => e2.check(K(...t3)), e2.max = (...t3) => e2.check(nr(...t3)), e2.length = (...t3) => e2.check(rr(...t3)), e2.nonempty = (...t3) => e2.check(K(1, ...t3)), e2.lowercase = (t3) => e2.check(ar(t3)), e2.uppercase = (t3) => e2.check(or(t3)), e2.trim = () => e2.check(dr()), e2.normalize = (...t3) => e2.check(ur(...t3)), e2.toLowerCase = () => e2.check(fr()), e2.toUpperCase = () => e2.check(pr());
});
var Br = /* @__PURE__ */ h("ZodString", (e2, t2) => {
  B.init(e2, t2), zr.init(e2, t2), e2.email = (t3) => e2.check(On(Hr, t3)), e2.url = (t3) => e2.check(Pn(Wr, t3)), e2.jwt = (t3) => e2.check(Yn(ai, t3)), e2.emoji = (t3) => e2.check(Fn(Gr, t3)), e2.guid = (t3) => e2.check(kn(Ur, t3)), e2.uuid = (t3) => e2.check(An(Z, t3)), e2.uuidv4 = (t3) => e2.check(jn(Z, t3)), e2.uuidv6 = (t3) => e2.check(Mn(Z, t3)), e2.uuidv7 = (t3) => e2.check(Nn(Z, t3)), e2.nanoid = (t3) => e2.check(In(Kr, t3)), e2.guid = (t3) => e2.check(kn(Ur, t3)), e2.cuid = (t3) => e2.check(Ln(qr, t3)), e2.cuid2 = (t3) => e2.check(Rn(Jr, t3)), e2.ulid = (t3) => e2.check(zn(Yr, t3)), e2.base64 = (t3) => e2.check(Kn(ni, t3)), e2.base64url = (t3) => e2.check(qn(ri, t3)), e2.xid = (t3) => e2.check(Bn(Xr, t3)), e2.ksuid = (t3) => e2.check(Vn(Zr, t3)), e2.ipv4 = (t3) => e2.check(Hn(Qr, t3)), e2.ipv6 = (t3) => e2.check(Un($r, t3)), e2.cidrv4 = (t3) => e2.check(Wn(ei, t3)), e2.cidrv6 = (t3) => e2.check(Gn(ti, t3)), e2.e164 = (t3) => e2.check(Jn(ii, t3)), e2.datetime = (t3) => e2.check(yr(t3)), e2.date = (t3) => e2.check(xr(t3)), e2.time = (t3) => e2.check(Cr(t3)), e2.duration = (t3) => e2.check(Tr(t3));
});
function Vr(e2) {
  return Dn(Br, e2);
}
var X = /* @__PURE__ */ h("ZodStringFormat", (e2, t2) => {
  V.init(e2, t2), zr.init(e2, t2);
});
var Hr = /* @__PURE__ */ h("ZodEmail", (e2, t2) => {
  Et.init(e2, t2), X.init(e2, t2);
});
var Ur = /* @__PURE__ */ h("ZodGUID", (e2, t2) => {
  wt.init(e2, t2), X.init(e2, t2);
});
var Z = /* @__PURE__ */ h("ZodUUID", (e2, t2) => {
  Tt.init(e2, t2), X.init(e2, t2);
});
var Wr = /* @__PURE__ */ h("ZodURL", (e2, t2) => {
  Dt.init(e2, t2), X.init(e2, t2);
});
var Gr = /* @__PURE__ */ h("ZodEmoji", (e2, t2) => {
  Ot.init(e2, t2), X.init(e2, t2);
});
var Kr = /* @__PURE__ */ h("ZodNanoID", (e2, t2) => {
  kt.init(e2, t2), X.init(e2, t2);
});
var qr = /* @__PURE__ */ h("ZodCUID", (e2, t2) => {
  At.init(e2, t2), X.init(e2, t2);
});
var Jr = /* @__PURE__ */ h("ZodCUID2", (e2, t2) => {
  jt.init(e2, t2), X.init(e2, t2);
});
var Yr = /* @__PURE__ */ h("ZodULID", (e2, t2) => {
  Mt.init(e2, t2), X.init(e2, t2);
});
var Xr = /* @__PURE__ */ h("ZodXID", (e2, t2) => {
  Nt.init(e2, t2), X.init(e2, t2);
});
var Zr = /* @__PURE__ */ h("ZodKSUID", (e2, t2) => {
  Pt.init(e2, t2), X.init(e2, t2);
});
var Qr = /* @__PURE__ */ h("ZodIPv4", (e2, t2) => {
  zt.init(e2, t2), X.init(e2, t2);
});
var $r = /* @__PURE__ */ h("ZodIPv6", (e2, t2) => {
  Bt.init(e2, t2), X.init(e2, t2);
});
var ei = /* @__PURE__ */ h("ZodCIDRv4", (e2, t2) => {
  Vt.init(e2, t2), X.init(e2, t2);
});
var ti = /* @__PURE__ */ h("ZodCIDRv6", (e2, t2) => {
  Ht.init(e2, t2), X.init(e2, t2);
});
var ni = /* @__PURE__ */ h("ZodBase64", (e2, t2) => {
  Wt.init(e2, t2), X.init(e2, t2);
});
var ri = /* @__PURE__ */ h("ZodBase64URL", (e2, t2) => {
  Kt.init(e2, t2), X.init(e2, t2);
});
var ii = /* @__PURE__ */ h("ZodE164", (e2, t2) => {
  qt.init(e2, t2), X.init(e2, t2);
});
var ai = /* @__PURE__ */ h("ZodJWT", (e2, t2) => {
  Yt.init(e2, t2), X.init(e2, t2);
});
var oi = /* @__PURE__ */ h("ZodUnknown", (e2, t2) => {
  Xt.init(e2, t2), Y.init(e2, t2);
});
function si() {
  return er(oi);
}
var ci = /* @__PURE__ */ h("ZodNever", (e2, t2) => {
  Zt.init(e2, t2), Y.init(e2, t2);
});
function li(e2) {
  return tr(ci, e2);
}
var ui = /* @__PURE__ */ h("ZodArray", (e2, t2) => {
  $t.init(e2, t2), Y.init(e2, t2), e2.element = t2.element, e2.min = (t3, n2) => e2.check(K(t3, n2)), e2.nonempty = (t3) => e2.check(K(1, t3)), e2.max = (t3, n2) => e2.check(nr(t3, n2)), e2.length = (t3, n2) => e2.check(rr(t3, n2)), e2.unwrap = () => e2.element;
});
function di(e2, t2) {
  return mr(ui, e2, t2);
}
var fi = /* @__PURE__ */ h("ZodObject", (e2, t2) => {
  rn.init(e2, t2), Y.init(e2, t2), x(e2, "shape", () => t2.shape), e2.keyof = () => yi(Object.keys(e2._zod.def.shape)), e2.catchall = (t3) => e2.clone({
    ...e2._zod.def,
    catchall: t3
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
  }), e2.extend = (t3) => ge(e2, t3), e2.safeExtend = (t3) => _e(e2, t3), e2.merge = (t3) => ve(e2, t3), e2.pick = (t3) => me(e2, t3), e2.omit = (t3) => he(e2, t3), e2.partial = (...t3) => ye(Si, e2, t3[0]), e2.required = (...t3) => be(Ai, e2, t3[0]);
});
function pi(e2, t2) {
  return new fi({
    type: "object",
    shape: e2 ?? {},
    ...O(t2)
  });
}
var mi = /* @__PURE__ */ h("ZodUnion", (e2, t2) => {
  on.init(e2, t2), Y.init(e2, t2), e2.options = t2.options;
});
function hi(e2, t2) {
  return new mi({
    type: "union",
    options: e2,
    ...O(t2)
  });
}
var gi = /* @__PURE__ */ h("ZodIntersection", (e2, t2) => {
  sn.init(e2, t2), Y.init(e2, t2);
});
function _i(e2, t2) {
  return new gi({
    type: "intersection",
    left: e2,
    right: t2
  });
}
var vi = /* @__PURE__ */ h("ZodEnum", (e2, t2) => {
  ln.init(e2, t2), Y.init(e2, t2), e2.enum = t2.entries, e2.options = Object.values(t2.entries);
  let n2 = new Set(Object.keys(t2.entries));
  e2.extract = (e3, r2) => {
    let i3 = {};
    for (let r3 of e3) if (n2.has(r3)) i3[r3] = t2.entries[r3];
    else throw Error(`Key ${r3} not found in enum`);
    return new vi({
      ...t2,
      checks: [],
      ...O(r2),
      entries: i3
    });
  }, e2.exclude = (e3, r2) => {
    let i3 = { ...t2.entries };
    for (let t3 of e3) if (n2.has(t3)) delete i3[t3];
    else throw Error(`Key ${t3} not found in enum`);
    return new vi({
      ...t2,
      checks: [],
      ...O(r2),
      entries: i3
    });
  };
});
function yi(e2, t2) {
  return new vi({
    type: "enum",
    entries: Array.isArray(e2) ? Object.fromEntries(e2.map((e3) => [e3, e3])) : e2,
    ...O(t2)
  });
}
var bi = /* @__PURE__ */ h("ZodTransform", (e2, t2) => {
  un.init(e2, t2), Y.init(e2, t2), e2._zod.parse = (n2, r2) => {
    if (r2.direction === "backward") throw new re(e2.constructor.name);
    n2.addIssue = (r3) => {
      if (typeof r3 == "string") n2.issues.push(M(r3, n2.value, t2));
      else {
        let t3 = r3;
        t3.fatal && (t3.continue = false), t3.code ??= "custom", t3.input ??= n2.value, t3.inst ??= e2, n2.issues.push(M(t3));
      }
    };
    let i3 = t2.transform(n2.value, n2);
    return i3 instanceof Promise ? i3.then((e3) => (n2.value = e3, n2)) : (n2.value = i3, n2);
  };
});
function xi(e2) {
  return new bi({
    type: "transform",
    transform: e2
  });
}
var Si = /* @__PURE__ */ h("ZodOptional", (e2, t2) => {
  fn.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType;
});
function Ci(e2) {
  return new Si({
    type: "optional",
    innerType: e2
  });
}
var wi = /* @__PURE__ */ h("ZodNullable", (e2, t2) => {
  pn.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType;
});
function Ti(e2) {
  return new wi({
    type: "nullable",
    innerType: e2
  });
}
var Ei = /* @__PURE__ */ h("ZodDefault", (e2, t2) => {
  mn.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType, e2.removeDefault = e2.unwrap;
});
function Di(e2, t2) {
  return new Ei({
    type: "default",
    innerType: e2,
    get defaultValue() {
      return typeof t2 == "function" ? t2() : de(t2);
    }
  });
}
var Oi = /* @__PURE__ */ h("ZodPrefault", (e2, t2) => {
  gn.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType;
});
function ki(e2, t2) {
  return new Oi({
    type: "prefault",
    innerType: e2,
    get defaultValue() {
      return typeof t2 == "function" ? t2() : de(t2);
    }
  });
}
var Ai = /* @__PURE__ */ h("ZodNonOptional", (e2, t2) => {
  _n.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType;
});
function ji(e2, t2) {
  return new Ai({
    type: "nonoptional",
    innerType: e2,
    ...O(t2)
  });
}
var Mi = /* @__PURE__ */ h("ZodCatch", (e2, t2) => {
  yn.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType, e2.removeCatch = e2.unwrap;
});
function Ni(e2, t2) {
  return new Mi({
    type: "catch",
    innerType: e2,
    catchValue: typeof t2 == "function" ? t2 : () => t2
  });
}
var Pi = /* @__PURE__ */ h("ZodPipe", (e2, t2) => {
  bn.init(e2, t2), Y.init(e2, t2), e2.in = t2.in, e2.out = t2.out;
});
function Fi(e2, t2) {
  return new Pi({
    type: "pipe",
    in: e2,
    out: t2
  });
}
var Ii = /* @__PURE__ */ h("ZodReadonly", (e2, t2) => {
  xn.init(e2, t2), Y.init(e2, t2), e2.unwrap = () => e2._zod.def.innerType;
});
function Li(e2) {
  return new Ii({
    type: "readonly",
    innerType: e2
  });
}
var Ri = /* @__PURE__ */ h("ZodCustom", (e2, t2) => {
  Cn.init(e2, t2), Y.init(e2, t2);
});
function zi(e2, t2 = {}) {
  return hr(Ri, e2, t2);
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
    var t2 = [];
    return Object.keys(e3.properties).forEach(function(n2) {
      e3.properties[n2].forEach(function(r2) {
        var i3 = {
          message: r2.message,
          groups: r2.groups,
          always: r2.always,
          each: r2.each
        }, a3 = {
          type: r2.type,
          name: r2.name,
          target: e3.name,
          propertyName: n2,
          constraints: r2.constraints,
          validationTypeOptions: r2.options,
          validationOptions: i3
        };
        t2.push(new Vi(a3));
      });
    }), t2;
  }, e2;
})();
var Ui = function(e2) {
  var t2 = typeof Symbol == "function" && Symbol.iterator, n2 = t2 && e2[t2], r2 = 0;
  if (n2) return n2.call(e2);
  if (e2 && typeof e2.length == "number") return { next: function() {
    return e2 && r2 >= e2.length && (e2 = void 0), {
      value: e2 && e2[r2++],
      done: !e2
    };
  } };
  throw TypeError(t2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var Wi = function(e2, t2) {
  var n2 = typeof Symbol == "function" && e2[Symbol.iterator];
  if (!n2) return e2;
  var r2 = n2.call(e2), i3, a3 = [], o3;
  try {
    for (; (t2 === void 0 || t2-- > 0) && !(i3 = r2.next()).done; ) a3.push(i3.value);
  } catch (e3) {
    o3 = { error: e3 };
  } finally {
    try {
      i3 && !i3.done && (n2 = r2.return) && n2.call(r2);
    } finally {
      if (o3) throw o3.error;
    }
  }
  return a3;
};
var Gi = function(e2, t2, n2) {
  if (n2 || arguments.length === 2) for (var r2 = 0, i3 = t2.length, a3; r2 < i3; r2++) (a3 || !(r2 in t2)) && (a3 ||= Array.prototype.slice.call(t2, 0, r2), a3[r2] = t2[r2]);
  return e2.concat(a3 || Array.prototype.slice.call(t2));
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
    var t2 = this;
    new Hi().transform(e3).forEach(function(e4) {
      return t2.addValidationMetadata(e4);
    });
  }, e2.prototype.addValidationMetadata = function(e3) {
    var t2 = this.validationMetadatas.get(e3.target);
    t2 ? t2.push(e3) : this.validationMetadatas.set(e3.target, [e3]);
  }, e2.prototype.addConstraintMetadata = function(e3) {
    var t2 = this.constraintMetadatas.get(e3.target);
    t2 ? t2.push(e3) : this.constraintMetadatas.set(e3.target, [e3]);
  }, e2.prototype.groupByPropertyName = function(e3) {
    var t2 = {};
    return e3.forEach(function(e4) {
      t2[e4.propertyName] || (t2[e4.propertyName] = []), t2[e4.propertyName].push(e4);
    }), t2;
  }, e2.prototype.getTargetValidationMetadatas = function(e3, t2, n2, r2, i3) {
    var a3, o3, s3 = function(e4) {
      return e4.always === void 0 ? e4.groups && e4.groups.length ? false : n2 : e4.always;
    }, c3 = function(e4) {
      return !!(r2 && (!i3 || !i3.length) && e4.groups && e4.groups.length);
    }, l3 = (this.validationMetadatas.get(e3) || []).filter(function(n3) {
      return n3.target !== e3 && n3.target !== t2 ? false : s3(n3) ? true : c3(n3) ? false : i3 && i3.length > 0 ? n3.groups && !!n3.groups.find(function(e4) {
        return i3.indexOf(e4) !== -1;
      }) : true;
    }), u3 = [];
    try {
      for (var d2 = Ui(this.validationMetadatas.entries()), f2 = d2.next(); !f2.done; f2 = d2.next()) {
        var p2 = Wi(f2.value, 2), ee2 = p2[0], m2 = p2[1];
        e3.prototype instanceof ee2 && u3.push.apply(u3, Gi([], Wi(m2), false));
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
    var te2 = u3.filter(function(t3) {
      return typeof t3.target == "string" || t3.target === e3 || t3.target instanceof Function && !(e3.prototype instanceof t3.target) ? false : s3(t3) ? true : c3(t3) ? false : i3 && i3.length > 0 ? t3.groups && !!t3.groups.find(function(e4) {
        return i3.indexOf(e4) !== -1;
      }) : true;
    }).filter(function(e4) {
      return !l3.find(function(t3) {
        return t3.propertyName === e4.propertyName && t3.type === e4.type;
      });
    });
    return l3.concat(te2);
  }, e2.prototype.getTargetValidatorConstraints = function(e3) {
    return this.constraintMetadatas.get(e3) || [];
  }, e2;
})(), (function() {
  function e2() {
  }
  return e2.isValid = function(e3) {
    var t2 = this;
    return e3 !== "isValid" && e3 !== "getMessage" && Object.keys(this).map(function(e4) {
      return t2[e4];
    }).indexOf(e3) !== -1;
  }, e2.CUSTOM_VALIDATION = "customValidation", e2.NESTED_VALIDATION = "nestedValidation", e2.PROMISE_VALIDATION = "promiseValidation", e2.CONDITIONAL_VALIDATION = "conditionalValidation", e2.WHITELIST = "whitelistValidation", e2.IS_DEFINED = "isDefined", e2;
})();
var Ki = new ((function() {
  function e2() {
    this.instances = [];
  }
  return e2.prototype.get = function(e3) {
    var t2 = this.instances.find(function(t3) {
      return t3.type === e3;
    });
    return t2 || (t2 = {
      type: e3,
      object: new e3()
    }, this.instances.push(t2)), t2.object;
  }, e2;
})())();
var qi;
var Q;
function Ji(e2) {
  if (qi) try {
    var t2 = qi.get(e2);
    if (t2 || !Q || !Q.fallback) return t2;
  } catch (e3) {
    if (!Q || !Q.fallbackOnErrors) throw e3;
  }
  return Ki.get(e2);
}
(function() {
  function e2(e3, t2, n2) {
    n2 === void 0 && (n2 = false), this.target = e3, this.name = t2, this.async = n2;
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
      options: Object.keys(Yi).map((e2, t2) => ({
        id: p(),
        label: `${Yi[e2].toLowerCase()}`,
        value: e2,
        position: t2
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
  constructor(e2, t2) {
    super(e2), this.name = "RestApiClientError", this.status = t2?.status, this.statusText = t2?.statusText, this.url = t2?.url, this.body = t2?.body;
  }
};
var o2 = () => globalThis.process?.env ?? {};
var s2 = (e2) => /^\/?s\//.test(e2);
var c2 = (e2) => e2.replace(/^(\/?)s\//, "$1");
var l2 = (e2, t2, n2) => {
  let r2 = /^https?:\/\//i.test(t2) ? t2 : `${e2}${t2.startsWith("/") ? "" : "/"}${t2}`;
  if (!i2(n2)) return r2;
  let a3 = new URLSearchParams();
  for (let [e3, t3] of Object.entries(n2)) i2(t3) && a3.append(e3, String(t3));
  let o3 = a3.toString();
  return o3.length === 0 ? r2 : r2.includes("?") ? `${r2}&${o3}` : `${r2}?${o3}`;
};
var u2 = class {
  constructor(e2) {
    this.refreshAccessTokenPromise = null, this.baseUrl = e2?.baseUrl, this.token = e2?.token, this.defaultHeaders = e2?.defaultHeaders, this.fetchImplementation = e2?.fetch ?? globalThis.fetch ?? null, this.authorizationToken = e2?.token ?? null, this.runAs = e2?.runAs;
  }
  request(e2, t2, n2) {
    return this.execute(e2, t2, n2?.body, n2);
  }
  get(e2, t2) {
    return this.execute("GET", e2, void 0, t2);
  }
  resolveUrl(e2, t2) {
    let n2 = this.resolveTarget(e2);
    return l2(n2.baseUrl, n2.path, t2?.query);
  }
  post(e2, t2, n2) {
    return this.execute("POST", e2, t2, n2);
  }
  put(e2, t2, n2) {
    return this.execute("PUT", e2, t2, n2);
  }
  patch(e2, t2, n2) {
    return this.execute("PATCH", e2, t2, n2);
  }
  delete(e2, t2) {
    return this.execute("DELETE", e2, void 0, t2);
  }
  resolveBaseUrl() {
    let t2 = this.baseUrl ?? o2().TWENTY_API_URL;
    if (!i2(t2) || t2.trim().length === 0) throw new a2(`Missing API url. Set the \`${aa}\` environment variable or pass \`baseUrl\` to \`RestApiClient\`.`);
    return t2.replace(/\/+$/, "");
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
      let t2 = o2();
      this.authorizationToken = this.token ?? t2[e2] ?? t2.TWENTY_API_KEY ?? null;
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
  sendRequest(e2, t2, n2, r2, o3) {
    if (!i2(this.fetchImplementation)) throw new a2("Global `fetch` function is not available, pass a fetch implementation to `RestApiClient`.");
    let s3 = new Headers(this.defaultHeaders);
    i2(o3?.headers) && new Headers(o3.headers).forEach((e3, t3) => s3.set(t3, e3));
    let c3 = typeof FormData < "u" && n2 instanceof FormData, l3 = i2(n2) && !c3 && typeof n2 != "string";
    c3 ? s3.delete("Content-Type") : l3 && s3.set("Content-Type", "application/json"), s3.set("Authorization", `Bearer ${r2}`);
    let u3 = i2(n2) ? c3 || typeof n2 == "string" ? n2 : JSON.stringify(n2) : void 0;
    return this.fetchImplementation.call(globalThis, e2, {
      method: t2,
      headers: s3,
      body: u3,
      signal: o3?.signal
    });
  }
  async parseResponse(e2, t2) {
    let n2 = await e2.text(), r2;
    if (n2.trim().length > 0) try {
      r2 = JSON.parse(n2);
    } catch {
      r2 = n2;
    }
    if (!e2.ok) throw new a2(`Request to ${t2} failed with status ${e2.status} ${e2.statusText}`, {
      status: e2.status,
      statusText: e2.statusText,
      url: t2,
      body: r2
    });
    return r2;
  }
  async execute(e2, t2, n2, r2) {
    let a3 = this.resolveTarget(t2), o3 = l2(a3.baseUrl, a3.path, r2?.query), s3 = this.resolveToken(), c3 = await this.sendRequest(o3, e2, n2, s3, r2);
    if (c3.status === 401) {
      let t3 = await this.requestRefreshedAccessToken();
      i2(t3) && (c3 = await this.sendRequest(o3, e2, n2, t3, r2));
    }
    return this.parseResponse(c3, o3);
  }
};

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

// src/shared/outbox.ts
var client2 = new u2({ runAs: "application" });
var sentLastHour = async (gatewayId) => {
  const since = new Date(Date.now() - 60 * 60 * 1e3).toISOString();
  const rows = rowsOf(
    await client2.get("/rest/smsOutboxTasks", {
      query: {
        filter: `and(shlyuzId[eq]:"${gatewayId}",otpravlenoV[gte]:"${since}",status[in]:["OTPRAVLENO","DOSTAVLENO"])`,
        limit: 200
      }
    }),
    "smsOutboxTasks"
  );
  return rows.length;
};
var dueTasks = async () => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const rows = rowsOf(
    await client2.get("/rest/smsOutboxTasks", {
      query: {
        filter: `and(status[eq]:"ZHDET",or(sleduyushchayaPopytka[is]:NULL,sleduyushchayaPopytka[lte]:"${now}"))`,
        limit: 10,
        orderBy: "createdAt"
      }
    }),
    "smsOutboxTasks"
  );
  return rows.filter((row) => row.id);
};
var pendingStatus = async () => {
  const rows = rowsOf(
    await client2.get("/rest/smsOutboxTasks", {
      query: {
        filter: `and(status[eq]:"OTPRAVLENO",vneshniyId[neq]:NULL)`,
        limit: 20,
        orderBy: "updatedAt"
      }
    }),
    "smsOutboxTasks"
  );
  return rows.filter((row) => row.id);
};
var readGateway = async (gatewayId) => {
  if (!gatewayId) return null;
  const response = await client2.get(`/rest/smsGateways/${gatewayId}`, {
    query: { select: "id,login,parol,adresServera,limitVChas" }
  });
  const row = response?.data?.smsGateway;
  if (!row) return null;
  const server = String(row.adresServera ?? "");
  const base = server.replace(/\/mobile\/v1\/?$/, "/3rdparty/v1").replace(/\/+$/, "");
  return {
    base,
    login: String(row.login ?? ""),
    parol: String(row.parol ?? ""),
    limit: Number(row.limitVChas ?? 0)
  };
};
var authHeader = (auth) => `Basic ${Buffer.from(`${auth.login}:${auth.parol}`).toString("base64")}`;
var firstRecord = (body) => {
  if (Array.isArray(body)) return body[0];
  const data = body?.data;
  if (Array.isArray(data)) return data[0];
  const single = pickCreated(body);
  return single ?? (body?.id ? body : void 0);
};
var sendTask = async (task, auth) => {
  const digits = String(task.nomer ?? "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `7${digits}` : digits;
  const text = String(task.tekst ?? "");
  if (!phone || !text) return { ok: false, error: "\u043F\u0443\u0441\u0442\u043E\u0439 \u043D\u043E\u043C\u0435\u0440 \u0438\u043B\u0438 \u0442\u0435\u043A\u0441\u0442" };
  try {
    const response = await fetch(`${auth.base}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(auth)
      },
      body: JSON.stringify({
        message: text,
        phoneNumbers: [`+${phone}`],
        withDeliveryReport: true
      })
    });
    const body = await response.text();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    }
    const record = firstRecord(body ? JSON.parse(body) : null);
    if (!record?.id) return { ok: false, error: `\u043D\u0435\u0442 id \u0432 \u043E\u0442\u0432\u0435\u0442\u0435: ${body.slice(0, 200)}` };
    return { ok: true, externalId: String(record.id), state: String(record.state ?? "Pending") };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
};
var readRemoteState = async (externalId, auth) => {
  try {
    const response = await fetch(`${auth.base}/messages/${externalId}`, {
      headers: { Authorization: authHeader(auth) }
    });
    if (!response.ok) return null;
    const body = await response.json();
    return { state: String(body.state ?? "") };
  } catch {
    return null;
  }
};
var patchTask = async (taskId, patch) => {
  await client2.patch(`/rest/smsOutboxTasks/${taskId}`, patch);
};
var patchMessage = async (messageId, patch) => {
  if (!messageId) return;
  await client2.patch(`/rest/soobshcheniya/${messageId}`, patch);
};
var overLimit = async (task, auth) => {
  if (auth.limit <= 0 || !task.shlyuzId) return false;
  return await sentLastHour(task.shlyuzId) >= auth.limit;
};

// src/logic-functions/sms-outbox-send.logic-function.ts
var MAX_ATTEMPTS = 3;
var RETRY_DELAY_MS = 5 * 60 * 1e3;
var REMOTE_TO_TASK = {
  Delivered: "DOSTAVLENO",
  Failed: "OSHIBKA",
  Sent: "OTPRAVLENO",
  Pending: "OTPRAVLENO",
  Cancelled: "OSHIBKA"
};
var handler = async () => {
  const errors = [];
  let sent = 0;
  let confirmed = 0;
  let failed = 0;
  for (const task of await pendingStatus().catch(() => [])) {
    try {
      const auth = await readGateway(String(task.shlyuzId ?? ""));
      if (!auth) continue;
      const remote = await readRemoteState(String(task.vneshniyId ?? ""), auth);
      if (!remote?.state) continue;
      const status = REMOTE_TO_TASK[remote.state];
      if (!status || status === "OTPRAVLENO") continue;
      await patchTask(task.id, { status, oshibka: status === "OSHIBKA" ? remote.state : "" });
      if (task.soobshchenieId) {
        await patchMessage(String(task.soobshchenieId), {
          statusDostavki: status === "DOSTAVLENO" ? "DOSTAVLENO" : "OSHIBKA"
        });
      }
      confirmed += 1;
    } catch (error) {
      errors.push(`\u0441\u0442\u0430\u0442\u0443\u0441 ${task.id}: ${String(error)}`);
    }
  }
  for (const task of await dueTasks().catch(() => [])) {
    try {
      const auth = await readGateway(String(task.shlyuzId ?? ""));
      if (!auth) {
        await patchTask(task.id, { status: "OSHIBKA", oshibka: "\u0448\u043B\u044E\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
        failed += 1;
        continue;
      }
      if (await overLimit(task, auth)) {
        await patchTask(task.id, {
          sleduyushchayaPopytka: new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
          oshibka: "\u043B\u0438\u043C\u0438\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0432 \u0447\u0430\u0441 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D"
        });
        continue;
      }
      const result = await sendTask(task, auth);
      const attempts = Number(task.popytki ?? 0) + 1;
      if (result.ok) {
        await patchTask(task.id, {
          status: "OTPRAVLENO",
          vneshniyId: result.externalId,
          otpravlenoV: (/* @__PURE__ */ new Date()).toISOString(),
          popytki: attempts,
          oshibka: "",
          sleduyushchayaPopytka: null
        });
        if (task.soobshchenieId) {
          await patchMessage(String(task.soobshchenieId), {
            statusDostavki: "OTPRAVLYAETSYA",
            vneshniyId: result.externalId
          });
        }
        sent += 1;
      } else if (attempts >= MAX_ATTEMPTS) {
        await patchTask(task.id, {
          status: "OSHIBKA",
          popytki: attempts,
          oshibka: result.error.slice(0, 500)
        });
        if (task.soobshchenieId) {
          await patchMessage(String(task.soobshchenieId), { statusDostavki: "OSHIBKA" });
        }
        failed += 1;
      } else {
        await patchTask(task.id, {
          popytki: attempts,
          oshibka: result.error.slice(0, 500),
          sleduyushchayaPopytka: new Date(Date.now() + RETRY_DELAY_MS).toISOString()
        });
      }
    } catch (error) {
      errors.push(`\u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 ${task.id}: ${String(error)}`);
    }
  }
  return { sent, confirmed, failed, errors };
};
var sms_outbox_send_logic_function_default = defineLogicFunction({
  universalIdentifier: SMS_OUTBOX_SEND_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: "sms-outbox-send",
  description: "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 SMS \u0438 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u0432 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438",
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: {
    pattern: "* * * * *"
  }
});
export {
  sms_outbox_send_logic_function_default as default
};
//# sourceMappingURL=sms-outbox-send.logic-function.mjs.map
