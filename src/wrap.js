let { isObject, baseObject, access } = require('./common.js')

function wrap (obj, onMutate, path = []) {
  function recordMutation (op, childPath, value) {
    let fullPath = path.concat(childPath)
    let oldValue
    let existed = false
    try {
      [ oldValue, existed ] = access(obj, childPath)
    } catch (err) {}
    let mutation = {
      op,
      path: fullPath,
      oldValue: baseObject(oldValue),
      newValue: value,
      existed
    }
    onMutate(mutation)
  }

  function put (obj, key, value, path = []) {
    if (!isObject(value)) {
      if (isObject(obj[key])) {
        del(obj, key)
      }

      let parent = baseObject(obj)
      parent[key] = value
      recordMutation('put', path, parent)
      return
    }

    if (key in obj && !isObject(obj[key])) {
      let base = baseObject(obj)
      delete base[key]
      recordMutation('put', path, base)
    }

    if (Array.isArray(obj)) {
      let parent = baseObject(obj)
      recordMutation('put', path, parent)
    }

    let base = baseObject(value)
    recordMutation('put', path.concat(key), base)

    for (let childKey in value) {
      let child = value[childKey]

      if (!isObject(child)) {
        if (!isObject(obj[key])) continue
        if (!isObject(obj[key][childKey])) continue
        del(obj[key], childKey, path.concat(key))
        continue
      }

      put(value, childKey, child, path.concat(key))
    }
  }

  function del (obj, key, path = []) {
    let value = obj[key]

    if (!isObject(obj[key])) {
      let parent = baseObject(obj)
      delete parent[key]
      recordMutation('put', path, parent)
      return
    }

    for (let childKey in value) {
      let child = value[childKey]
      if (!isObject(child)) continue
      del(value, childKey, path.concat(key))
    }

    recordMutation('del', path.concat(key))
  }

  return new Proxy(obj, {
    get (obj, key) {
      let value = obj[key]
      if (typeof value === 'function') {
        return value.bind(obj)
      }
      if (!isObject(value)) {
        return value
      }

      let childPath = path.concat(key)
      return wrap(value, onMutate, childPath)
    },

    set (obj, key, value) {
      put(obj, key, value)
      obj[key] = value
      return true
    },

    deleteProperty (obj, key) {
      if (!(key in obj)) return true
      del(obj, key)
      delete obj[key]
      return true
    },

    ownKeys () {
      return Object.getOwnPropertyNames(obj)
    }
  })
}

module.exports = wrap
