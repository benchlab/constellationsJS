let old = require('old')
let Transaction = require('level-transactions')
let _Node = require('./node.js')

class Tree {
  constructor (db) {
    if (!db || db.toString() !== 'LevelUP') {
      throw Error('Must specify a LevelUp interface')
    }
    this.db = db
    this._rootNode = null
    this.lock = null

    this.Node = _Node(this.db)

    this.initialized = false
    this.initialize = this.maybeLoad()
  }

  async maybeLoad () {
    try {
      let rootKey = (await this.db.get(':root')).toString()
      this._rootNode = await this.Node.get(rootKey)
    } catch (err) {
      if (!err.notFound) throw err
    }

    this.initialized = true
  }

  async rootNode () {
    await this.initialize
    return this._rootNode
  }

  rootHash () {
    if (this._rootNode == null) return null
    return this._rootNode.hash
  }

  async setRoot (node, ntx) {
    await this.initialize

    if (!ntx) {
      ntx = createNtx(this.db)
      var createdNtx = true
    }

    if (node != null) {
      await this.db.put(':root', node.key)
    } else {
      await this.db.del(':root')
    }

    this._rootNode = node

    if (createdNtx) {
      await ntx.commit()
    }
  }

  async acquireLock () {
    while (true) {
      if (!this.lock) break
      await this.lock
    }

    let _resolve
    let releaseLock = () => {
      this.lock = null
      _resolve()
    }
    this.lock = new Promise((resolve) => {
      _resolve = resolve
    })

    return releaseLock
  }

  async put (key, value) {
    await this.initialize

    let release = await this.acquireLock()

    let ntx = createNtx(this.db)
    let node = new this.Node({ key, value, db: this.db })

    // no root, set node as root
    if (this._rootNode == null) {
      await node.save(ntx)
      await this.setRoot(node, ntx)
      await ntx.commit()
      release()
      return
    }

    let successor = await this._rootNode.put(node, ntx)
    await this.setRoot(successor, ntx)
    await ntx.commit()
    release()
  }

  async get (key) {
    await this.initialize
    return this.Node.get(key)
  }

  async del (key) {
    await this.initialize

    if (this._rootNode == null) {
      throw Error('Tree is empty')
    }

    let release = await this.acquireLock()

    let ntx = createNtx(this.db)
    let successor = await this._rootNode.delete(key, ntx)
    await this.setRoot(successor, ntx)
    await ntx.commit()

    release()
  }

  async getBranchRange (from, to) {
    await this.initialize
    let release = await this.acquireLock()
    let branch = this._rootNode.getBranchRange(from, to, this.db)
    release()
    return branch
  }
}

module.exports = old(Tree)

function createNtx (db) {
  let ntx = new Transaction(db)
  return {
    get: promisify(ntx, 'get'),
    put: promisify(ntx, 'put'),
    del: promisify(ntx, 'del'),
    commit: promisify(ntx, 'commit')
  }
}

function promisify (obj, method) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      obj[method](...args, (err, value) => {
        if (err) return reject(err)
        resolve(value)
      })
    })
  }
}
