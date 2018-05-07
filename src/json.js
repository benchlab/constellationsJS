let stableStringify = require('json-stable-stringify')

const base64Prefix = ':base64:'

function stringify (obj) {
  let convertedObj = deepClone(obj, bufferToBase64Replacer)
  return stableStringify(convertedObj)
}

function parse (json) {
  let obj = JSON.parse(json)
  return convertBase64ToBuffers(obj)
}

function deepClone (obj, replacer) {
  let newObj = Array.isArray(obj) ? [] : {}
  Object.assign(newObj, obj)
  for (let key in newObj) {
    newObj[key] = replacer(newObj[key])
    if (typeof newObj[key] === 'object') {
      newObj[key] = deepClone(newObj[key], replacer)
    }
  }
  return newObj
}

function bufferToBase64Replacer (value) {
  if (
    typeof value === 'object' &&
    value.type === 'Buffer' &&
    Array.isArray(value.data)
  ) {
    value = Buffer.from(value)
  }
  if (!Buffer.isBuffer(value)) return value
  return `${base64Prefix}${value.toString('base64')}`
}
function base64ToBufferReplacer (value) {
  if (typeof value !== 'string') return value
  if (!value.startsWith(base64Prefix)) return value
  return Buffer.from(value.slice(base64Prefix.length), 'base64')
}

function convertBuffersToBase64 (obj) {
  return replace(obj, bufferToBase64Replacer)
}

function convertBase64ToBuffers (obj) {
  return replace(obj, base64ToBufferReplacer)
}

function replace (obj, replacer) {
  for (let key in obj) {
    obj[key] = replacer(obj[key])
    if (typeof obj[key] === 'object' && !Buffer.isBuffer(obj[key])) {
      replace(obj[key], replacer)
    }
  }
  return obj
}

module.exports = {
  stringify,
  parse,
  convertBuffersToBase64,
  convertBase64ToBuffers
}
