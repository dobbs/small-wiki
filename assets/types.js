import * as code from "./types/code.js"
import * as graphviz from "./types/graphviz.js"
import * as html from "./types/html.js"
import * as markdown from "./types/markdown.js"
import * as pagefold from "./types/pagefold.js"

const types = {
  code,
  graphviz,
  html,
  markdown,
  pagefold
}
let typesLoaded = Promise.resolve(types)

export {types, typesLoaded}
