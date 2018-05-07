# constellationJS

constellationJS worked directly with [dappJS](#https://github.com/benchlab/dappjs) provides a Javascript library for `Merkle tree state`, with `LevelUP persistence` and a super simple `interface`.

`constellationJS` uses the ES6 Proxy API to give the best possible interface, it's just an object. Behind the scenes, `constellationJS` uses a Merkle AVL tree, which lets us do cool things like efficiently iterating through keys, making range proofs, etc. Since every child object is its own tree node, it's fast to update the db and recompute the hash even for very large states.

## Install constellationJS (Adding to dappJS)

```bash
yarn add constellationsjs --save
```

```js
let constellation = require('constellationsjs')

let state = await constellation(levelUpDb)

state.foo = 'bar'
state.baz = { x: 123, y: { z: 456 } }
delete state.baz.x

await constellation.commit(state)

constellation.rollback(state)

let rootHash = constellation.hash(state)

let proof = await constellation.proof(state, 'baz.y')

let value = constellation.verify(rootHash, proof, 'baz.y')

```

## Version
0.1.4

## LICENSE
Copyright 2018 BenchX

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, ALASKA BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
