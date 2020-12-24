const typenames = [
  "code",
  "graphviz",
  "html",
  "markdown",
  "pagefold"
]

export const loadTypes = Promise.all(
  typenames.map(typename => import(`./types/${typename}.js`)))
  .then(modules => {
    const result = {}
    for(let i = 0; i < typenames.length; i++) {
      result[typenames[i]] = modules[i]
    }
    return result
  })
