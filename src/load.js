let { access, keyToPath } = require('./common.js')
let { parse } = require('./json.js')

async function load (tree) {

  let rootNode = await tree.rootNode()
  if (!rootNode) return {}

  let cursor = await rootNode.min()
  let root = {}

  if (cursor.key === '.') {
    // cursor is root object
    root = parse(cursor.value)
    cursor = await cursor.next()
  }

  while (cursor) {
    let path = keyToPath(cursor.key.slice(1))
    let [ parent ] = access(root, path.slice(0, -1))
    let key = path[path.length - 1]
    parent[key] = parse(cursor.value)
    cursor = await cursor.next()
  }

  return root
}

module.exports = load
