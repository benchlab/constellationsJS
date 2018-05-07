let struct = require('varstruct')
let VarInt = require('varint')
let {
  ripemd160,
  sha256,
  keyToPath,
  access,
  symbols
} = require('./common.js')
let { parse } = require('./json.js')

const nullHash = Buffer.alloc(20)
const VarString = struct.VarString(VarInt)

function childHash (child) {
  if (child == null) {
    return nullHash
  }
  if (typeof child === 'string') {
    return Buffer.from(child, 'base64')
  }
  if (typeof child === 'object') {
    return getHash(child)
  }
  throw Error('Invalid child node value')
}

function getHash (node) {
  let kvHash = node.kvHash
    ? Buffer.from(node.kvHash, 'base64')
    : getKvHash(node)

  let input = Buffer.concat([
    childHash(node.left),
    childHash(node.right),
    kvHash
  ])
  return ripemd160(sha256(input))
}

function getKvHash ({ key, value }) {
  let input = Buffer.concat([
    VarString.encode(key),
    VarString.encode(value)
  ])
  return ripemd160(sha256(input))
}

function flatten (node, nodes = [], path = []) {
  if (node.left && typeof node.left === 'object') {
    flatten(node.left, nodes, path.concat(false))
  }

  if (path.length === 0) {
    node.isEdge = node.left == null || node.right == null
  } else {
    let equal = true
    for (let i = 1; i < path.length; i++) {
      if (path[i] !== path[i - 1]) {
        equal = false
        break
      }
    }
    let leftEdge = path[0] === false
    let noChildOnEdge = leftEdge ? node.left == null : node.right == null
    node.isEdge = equal && noChildOnEdge
  }

  nodes.push(node)
  if (node.right && typeof node.right === 'object') {
    flatten(node.right, nodes, path.concat(true))
  }
  return nodes
}

module.exports = function verify (expectedRootHash, proof, query = '') {
  let rootHash = getHash(proof).toString('hex')
  if (rootHash !== expectedRootHash) {
    throw Error('Proof does not match expected root hash')
  }

  let from = '.' + query
  let to = '.' + query + '/'
  if (query === '') to = '/'
  let nodes = flatten(proof)

  let valueNodes = []
  for (let node of nodes) {
    if (!node.key) {
      if (valueNodes.length > 0) break
      continue
    }
    valueNodes.push(node)
  }

  let checkRange = () => {
    let firstKeyPastFrom = valueNodes[0].key >= from
    let firstKeyIsEdge = valueNodes[0].isEdge
    if (firstKeyPastFrom && !firstKeyIsEdge) {
      throw Error('First key greater than beginning of range')
    }

    let lastKeyBeforeTo = valueNodes[valueNodes.length - 1].key <= to
    let lastKeyIsEdge = valueNodes[valueNodes.length - 1].isEdge
    if (lastKeyBeforeTo && !lastKeyIsEdge) {
      throw Error('Last key less than end of range')
    }
  }

  let discoveryNodes = valueNodes.filter((node) => {
    return node.key >= from && node.key <= to
  })

  if (discoveryNodes.length === 0) {
    let path = query.split('.')
    let parentKey = '.' + path.slice(0, -1).join('.')
    let valueKey = path[path.length - 1]
    from = parentKey
    to = parentKey + '.'
    checkRange()

    for (let node of valueNodes) {
      if (node.key === parentKey) {
        var parentNode = node
        break
      }
      if (node.key > parentKey) {
        throw Error('Parent node not found')
      }
    }
    let parentValue = parse(parentNode.value)
    return parentValue[valueKey]
  }

  checkRange()

  let discovery
  for (let node of discoveryNodes) {
    let key = node.key.slice(from.length)
    if (key === '') key = symbols.root

    let path = keyToPath(key)
    if (path[0] === '') path.shift()
    let value = parse(node.value)

    if (path.length === 0) {
      discovery = value
    } else {
      if (!discovery) discovery = {}
      let [ parent ] = access(discovery, path.slice(0, -1))
      let name = path[path.length - 1]
      parent[name] = value
    }
  }
  return discovery
}
