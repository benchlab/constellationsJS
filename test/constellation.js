let test = require('ava')
let { simDb } = require('./common.js')
let { symbols } = require('../src/common.js')
let constellation = require('../src/constellation.js')

test('create constellation without db', async (t) => {
  try {
    await constellation()
    t.fail()
  } catch (err) {
    t.is(err.message, 'Must provide a LevelUP instance')
  }

  try {
    await constellation({})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Must provide a LevelUP instance')
  }
})

test('create constellation', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  t.deepEqual(obj, {})

  let mutations = constellation.mutations(obj)
  t.deepEqual(mutations.before, {})
  t.deepEqual(mutations.after, {})
})

test('create constellation with existing data', async (t) => {
  let db = simDb({
    store: {
      ':root': '.foo',
      'n.foo': 'G+PH6PHsNTbVHY8Kt0AJypGvIU+9uZNSZeEldRF/R+AxQJmP7oqoQAEBB3sieCI6NX0BLgYuZm9vLnkA',
      'n.foo.y': 'yJfgdnJGSp+rACbCM+3xlQeaxlAWd6DqBI4netwFUt3YkCpNxG7GCAAACXsieiI6MTIzfQAABC5mb28=',
      'n.': 'cWSoYAhQYgpWR5tMg1mrQk7NKurl2dH4Ve4Abbq4P+mpcc7kve/sxgAADXsiYmFyIjoiYmF6In0AAAQuZm9v'
    }
  })

  let obj = await constellation(db)

  t.deepEqual(obj, {
    foo: { x: 5, y: { z: 123 } },
    bar: 'baz'
  })

  let mutations = constellation.mutations(obj)
  t.deepEqual(mutations.before, {})
  t.deepEqual(mutations.after, {})
})

test('create constellation with existing data, with no non-objects on root', async (t) => {
  let db = simDb({
    store: {
      ':root': '.foo',
      'n.foo': 'nVLY483AXQKEMrv1w66IcV3v/IG9uZNSZeEldRF/R+AxQJmP7oqoQAABB3sieCI6NX0ABi5mb28ueQA=',
      'n.foo.y': 'yJfgdnJGSp+rACbCM+3xlQeaxlAWd6DqBI4netwFUt3YkCpNxG7GCAAACXsieiI6MTIzfQAABC5mb28='
    }
  })

  let obj = await constellation(db)

  t.deepEqual(obj, {
    foo: { x: 5, y: { z: 123 } }
  })

  let mutations = constellation.mutations(obj)
  t.deepEqual(mutations.before, {})
  t.deepEqual(mutations.after, {})
})

test('rollback', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  t.deepEqual(obj, {})

  obj.foo = { x: 5, y: { z: 123 } }
  obj.bar = 'baz'

  t.deepEqual(obj, {
    foo: { x: 5, y: { z: 123 } },
    bar: 'baz'
  })

  constellation.rollback(obj)

  t.deepEqual(obj, {})
})

test('commit', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  obj.foo = { x: 5, y: { z: 123 } }
  obj.bar = 'baz'

  await constellation.commit(obj)

  t.deepEqual(obj, {
    foo: { x: 5, y: { z: 123 } },
    bar: 'baz'
  })
  t.is(constellation.hash(obj).toString('hex'), '1be3c7e8f1ec3536d51d8f0ab74009ca91af214f')

  let mutations = constellation.mutations(obj)
  t.deepEqual(mutations.before, {})
  t.deepEqual(mutations.after, {})
})

test('call constellation methods on non-constellation object', async (t) => {
  try {
    await constellation.commit({})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Must specify a root constellation object')
  }

  try {
    constellation.mutations({})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Must specify a root constellation object')
  }

  try {
    constellation.rollback({})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Must specify a root constellation object')
  }
})

test('rollback on array length increase', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  obj.array = [ 1, 2, 3 ]

  await constellation.commit(obj)

  obj.array.push(4)

  constellation.rollback(obj)

  t.deepEqual(obj, { array: [ 1, 2, 3 ] })
})

test('rollback on array length increase with objects', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  obj.array = [ {}, {}, {} ]

  await constellation.commit(obj)

  obj.array.push({})

  constellation.rollback(obj)

  t.deepEqual(obj, { array: [ {}, {}, {} ] })
})

test('rollback on array length decrease', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  obj.array = [ 1, 2, 3 ]

  await constellation.commit(obj)

  obj.array.pop()

  constellation.rollback(obj)

  t.deepEqual(obj, { array: [ 1, 2, 3 ] })
})

test('rollback on array length decrease with objects', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  obj.array = [ {}, {}, {} ]

  await constellation.commit(obj)

  obj.array.pop()

  constellation.rollback(obj)

  t.deepEqual(obj, { array: [ {}, {}, {} ] })
})

test('rollback on array length increase with mixed types', async (t) => {
  let db = simDb()
  let obj = await constellation(db)

  obj.array = [ {}, {}, {}, 4, 5, 6 ]

  await constellation.commit(obj)

  obj.array.push({})

  constellation.rollback(obj)

  t.deepEqual(obj, { array: [ {}, {}, {}, 4, 5, 6 ] })
})
