const MAX_LEN = 200;
const fail = (m) => {
  throw new Error(m);
};

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) fail("syntax");
      toks.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/i.test(c)) {
      const m = /^[a-z]+/i.exec(src.slice(i))[0];
      toks.push({ t: "id", v: m.toLowerCase() });
      i += m.length;
    } else if ("+-*/%^()".includes(c)) {
      toks.push({ t: c });
      i++;
    } else {
      fail("syntax");
    }
  }
  return toks;
}

export function evaluate(expr) {
  if (typeof expr !== "string") fail("syntax");
  if (expr.length > MAX_LEN) fail("too-long");
  const toks = tokenize(expr);
  let p = 0;
  const peek = () => toks[p]?.t;

  // additive := term (('+'|'-') term)*
  function additive() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = toks[p++].t;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  // term := power (('*'|'/'|'%') power)*
  function term() {
    let v = power();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = toks[p++].t;
      const r = power();
      if (op === "*") v *= r;
      else {
        if (r === 0) fail("divide-by-zero");
        v = op === "/" ? v / r : v % r;
      }
    }
    return v;
  }
  // power := unary ('^' power)?   (right-associative)
  function power() {
    const base = unary();
    if (peek() === "^") {
      p++;
      return Math.pow(base, power());
    }
    return base;
  }
  // unary := '-' unary | '+' unary | atom
  function unary() {
    if (peek() === "-") {
      p++;
      return -unary();
    }
    if (peek() === "+") {
      p++;
      return unary();
    }
    return atom();
  }
  function atom() {
    const tok = toks[p];
    if (!tok) fail("syntax");
    if (tok.t === "num") {
      p++;
      return tok.v;
    }
    if (tok.t === "(") {
      p++;
      const v = additive();
      if (peek() !== ")") fail("syntax");
      p++;
      return v;
    }
    if (tok.t === "id") {
      p++;
      if (tok.v === "pi") return Math.PI;
      if (tok.v === "sqrt") {
        if (peek() !== "(") fail("syntax");
        p++;
        const v = additive();
        if (peek() !== ")") fail("syntax");
        p++;
        if (v < 0) fail("syntax");
        return Math.sqrt(v);
      }
    }
    return fail("syntax");
  }

  const result = additive();
  if (p !== toks.length) fail("syntax");
  if (!Number.isFinite(result)) fail("syntax");
  return result;
}
