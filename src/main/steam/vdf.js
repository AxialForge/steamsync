'use strict'

// Minimal Valve KeyValues (VDF) parser. Enough for libraryfolders.vdf and
// appmanifest_*.acf — both are the same simple quoted-key / quoted-value or
// nested-object format. Not a general-purpose VDF library; no #include, no
// conditionals, no macros (none appear in these files).
//
//   "key"    "value"
//   "key"    {  ...nested...  }
//
// Returns a plain nested object. Duplicate keys keep the last value.
function parse(text) {
  const root = {}
  const stack = [root]
  let i = 0
  const n = text.length

  function skipWs() {
    while (i < n) {
      const c = text[i]
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue }
      // line comment  //
      if (c === '/' && text[i + 1] === '/') {
        while (i < n && text[i] !== '\n') i++
        continue
      }
      break
    }
  }

  function readToken() {
    skipWs()
    if (i >= n) return null
    if (text[i] === '{' || text[i] === '}') { return text[i++] }
    if (text[i] === '"') {
      i++ // opening quote
      let out = ''
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) {
          const nx = text[i + 1]
          out += nx === 'n' ? '\n' : nx === 't' ? '\t' : nx === '\\' ? '\\' : nx
          i += 2
        } else {
          out += text[i++]
        }
      }
      i++ // closing quote
      return { str: out }
    }
    // unquoted token (rare, but handle it)
    let out = ''
    while (i < n && !' \t\r\n{}"'.includes(text[i])) out += text[i++]
    return { str: out }
  }

  let pendingKey = null
  while (i < n) {
    const tok = readToken()
    if (tok === null) break
    if (tok === '}') { stack.pop(); pendingKey = null; continue }
    if (tok === '{') {
      const obj = {}
      const parent = stack[stack.length - 1]
      if (pendingKey != null) parent[pendingKey] = obj
      stack.push(obj)
      pendingKey = null
      continue
    }
    // tok is { str }
    if (pendingKey == null) { pendingKey = tok.str; continue }
    // we have key + value
    stack[stack.length - 1][pendingKey] = tok.str
    pendingKey = null
  }
  return root
}

module.exports = { parse }
