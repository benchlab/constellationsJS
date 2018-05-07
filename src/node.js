let struct = require('varstruct')
let VarInt = require('varint')
let { sha256, ripemd160 } = require('./common.js')

const nullHash = Buffer.alloc(20)

let VarString = struct.VarString(VarInt)
let adapter = struct([
  ['hash', struct.Buffer(20)],
  ['kvHash', struct.Buffer(20)],
  ['leftHeight', struct.UInt8],
  ['rightHeight', struct.UInt8],
  ['value', VarString],
  ['leftKey', VarString],
  ['rightKey', VarString],
  ['parentKey', VarString]
])

const defaults = {
  hash: nullHash,
  kvHash: nullHash,
  leftHeight: 0,
  rightHeight: 0,
  leftKey: '',
  rightKey: '',
  parentKey: '',
  key: ''
}

const nullNode = Object.assign({
  height: () => 0,
  async save () {}
}, defaults)

function nodeKey (key) {
  return 'n' + key
}

function putNode (ntx, node) {
  let nodeBytes = adapter.encode(node).toString('base64')
  return ntx.put(nodeKey(node.key), nodeBytes)
}

function delNode (ntx, node) {
  return ntx.del(nodeKey(node.key))
}

module.exports = function (db) {
  async function getNode (ntx, key) {
    if (key === '') return null
    let nodeB64 = (await ntx.get(nodeKey(key))).toString()
    let nodeBytes = Buffer.from(nodeB64, 'base64')
    let decoded = adapter.decode(nodeBytes)
    decoded.key = key
    return new Node(decoded)
  }

  class Node {
    constructor (props) {
      if (props.key == null) {
        throw new Error('Key is required')
      }
      if (props.value == null) {
        throw new Error('Value is required')
      }

      Object.assign(this, defaults, props)

      if (this.kvHash.equals(nullHash)) {
        this.calculateKVHash()
      }
      if (this.hash.equals(nullHash)) {
        this.calculateHash()
      }
    }

    isInnerNode () {
      return this.leftKey || this.rightKey
    }

    isLeafNode () {
      return !this.isInnerNode()
    }

    left (ntx) {
      return getNode(ntx, this.leftKey)
    }

    right (ntx) {
      return getNode(ntx, this.rightKey)
    }

    child (ntx, left) {
      if (left) return this.left(ntx)
      return this.right(ntx)
    }

    parent (ntx) {
      return getNode(ntx, this.parentKey)
    }

    save (ntx) {
      return putNode(ntx, this)
    }

    async setChild (ntx, left, child, rebalance = true) {
      if (child != null) {
        child.parentKey = this.key
      } else {
        child = nullNode
      }

      this[left ? 'leftKey' : 'rightKey'] = child.key
      this[left ? 'leftHeight' : 'rightHeight'] = child.height()

      if (rebalance && Math.abs(this.balance()) > 1) {
        return this.rebalance(ntx)
      }

      let leftChild = left ? child : await this.left(ntx)
      let rightChild = !left ? child : await this.right(ntx)
      this.calculateHash(leftChild, rightChild)

      await this.save(ntx)
      await child.save(ntx)
      return this
    }

    balance () {
      return this.rightHeight - this.leftHeight
    }

    async rebalance (ntx) {
      let left = this.balance() < 0
      let child = await this.child(ntx, left)

      let childLeftHeavy = child.balance() < 0
      let childRightHeavy = child.balance() > 0
      let double = left ? childRightHeavy : childLeftHeavy
      if (double) {
        let successor = await child.rotate(ntx, !left)
        await this.setChild(ntx, left, successor, false)
      }
      return this.rotate(ntx, left)
    }

    async rotate (ntx, left) {
      let child = await this.child(ntx, left)
      let grandChild = await child.child(ntx, !left)
      await this.setChild(ntx, left, grandChild, false)
      child.parentKey = ''
      await child.setChild(ntx, !left, this, false)
      return child
    }

    height () {
      return Math.max(this.leftHeight, this.rightHeight) + 1
    }

    calculateHash (leftChild, rightChild) {
      let input = Buffer.concat([
        leftChild ? leftChild.hash : nullHash,
        rightChild ? rightChild.hash : nullHash,
        this.kvHash
      ])
      this.hash = ripemd160(sha256(input))
      return this.hash
    }

    calculateKVHash () {
      let input = Buffer.concat([
        VarString.encode(this.key),
        VarString.encode(this.value)
      ])
      this.kvHash = ripemd160(sha256(input))
      return this.kvHash
    }

    async put (node, ntx) {
      if (node.key === this.key) {
        this.value = node.value
        this.calculateKVHash()
        this.calculateHash(await this.left(ntx), await this.right(ntx))
        await this.save(ntx)
        return this
      }

      let left = node.key < this.key
      let child = await this.child(ntx, left)
      if (child == null) {
        let successor = await this.setChild(ntx, left, node)
        return successor
      }

      let newChild = await child.put(node, ntx)
      let successor = await this.setChild(ntx, left, newChild)
      return successor
    }

    async delete (key, ntx) {
      if (key === this.key) {

        if (this.isLeafNode()) {
          await delNode(ntx, this)
          return null
        }

        let left = this.leftHeight > this.rightHeight
        let successor = await this.child(ntx, left)
        successor.parentKey = this.parentKey
        let otherNode = await this.child(ntx, !left)
        if (otherNode) {
          successor = await successor.put(otherNode, ntx)
        }
        await delNode(ntx, this)
        return successor
      }

      let left = key < this.key
      let child = await this.child(ntx, left)
      if (child == null) {
        throw Error(`Key "${key}" not found`)
      }

      let newChild = await child.delete(key, ntx)
      let successor = await this.setChild(ntx, left, newChild)
      return successor
    }

    async edge (left, ntx = db) {
      let cursor = this
      while (true) {
        let child = await cursor.child(ntx, left)
        if (child == null) return cursor
        cursor = child
      }
    }
    min () { return this.edge(true) }
    max () { return this.edge(false) }

    async step (left, ntx = db) {
      let child = await this.child(ntx, left)
      if (child) return child.edge(!left, ntx)

      let cursor = await this.parent(ntx)
      while (cursor) {
        let skip = left
          ? cursor.key > this.key
          : cursor.key < this.key
        if (!skip) return cursor
        cursor = await cursor.parent(ntx)
      }

      return null
    }
    prev () { return this.step(true) }
    next () { return this.step(false) }

    async getBranchRange (from, to, ntx) {
      let left = await this.left(ntx)
      let right = await this.right(ntx)

      let branch = {
        left: left ? left.hash.toString('base64') : null,
        right: right ? right.hash.toString('base64') : null
      }

      async function isInRange (node) {
        if (node.key < from) {
          let next = await node.next(ntx)
          if (next == null) return true
          return next.key >= from
        }
        if (node.key > to) {
          let prev = await node.prev(ntx)
          if (prev == null) return true
          return prev.key <= to
        }
        return true
      }

      if (await isInRange(this)) {
        branch.key = this.key
        branch.value = this.value
      } else {
        branch.kvHash = this.kvHash.toString('base64')
      }

      if (left && this.key >= from) {
        branch.left = await left.getBranchRange(from, to, ntx)
      }
      if (right && this.key <= to) {
        branch.right = await right.getBranchRange(from, to, ntx)
      }

      return branch
    }
  }

  Node.get = (key, ntx = db) => getNode(db, key)
  return Node
}
