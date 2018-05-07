module.exports = async function createProof (tree, query) {
  let from = '.' + query
  let to = '.' + query + '/'

  if (query === '') to = '/'

  try {
    await tree.get(from)
  } catch (err) {
    if (!err.notFound) throw err

    let path = query.split('.')
    query = path.slice(0, -1).join('.')
    from = '.' + query
    to = '.' + query + '.'
  }

  return tree.getBranchRange(from, to)
}
