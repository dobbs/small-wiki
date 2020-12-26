// Manage the incremental viewing from one tab in the browser
// Usage: import { start } from "./view.js"; start()

export { start }
import { types } from "./types.js"

const newpid = () => Math.floor(Math.random()*1000000)
let lineup = window.lineup = []

function start () {
  const root = document.body
  wikiStyle(root)
  wikiLineup(root)
  wikiFooter(root)
  populateLineup()
  document.addEventListener('click', click)
}

function wikiStyle(dom) {
  dom.classList.add("wiki-root")
  ensureStyleTag(dom).insertAdjacentHTML("beforeend", `
    .wiki-root {font-family: Arial, Helvetica, sans-serif;
      display:flex; flex-direction:column;
      margin:0; padding:0; overflow:hidden;}
    .wiki-root section {flex: 90 80 auto;}
    .wiki-root footer {flex: 2 0 20px;}`)
}

function wikiLineup(dom) {
  ensureStyleTag(dom).insertAdjacentHTML("beforeend", `
    .wiki-root section {display: flex; flex-direction: row;
      scrollbar-width: none; overflow-x: auto; overflow-y: hidden;}
    .wiki-root article {flex: 0 0 400px; margin: 8px; padding: 8px; overflow-y: auto; overflow-x: hidden;
        color: black; background-color: white; box-shadow: 2px 1px 4px rgba(0, 0, 0, 0.2);}`)
  dom.insertAdjacentHTML("beforeend", `<section data-wiki=lineup></section>`)
  window.addEventListener('hashchange', populateLineup)
}

function wikiFooter(dom) {
  ensureStyleTag(dom).insertAdjacentHTML("beforeend", `
    .wiki-root footer {background-color:#ccc; padding:10px;}`)
  dom.insertAdjacentHTML("beforeend", `
    <footer>${footer()}</footer>`)
}

function ensureStyleTag(dom) {
  let style = dom.querySelector('style')
  if (! style) {
    style = document.createElement('style')
    dom.appendChild(style)
  }
  return style
}

function newPage(panel) {
  panel.pid = panel.pid || newpid()
  const article = document.createElement('article')
  article.setAttribute('id', panel.pid)
  article.insertAdjacentHTML('beforeend', `
  <header>
    <nav data-wiki="twins"></nav>
    <h3 data-wiki="title"></h3>
  </header>`)
  article.addEventListener('wiki-render', ({panel, article}) => {
    renderHeader({panel, article})
    clearStory({panel, article})
    renderStory({panel, article})
  })

  function renderHeader({panel, article}) {
    // TODO: do something with twins
    const flag = panel.where=='view' ? `./favicon.png` : `//${panel.where}/favicon.png`
    article.querySelector('[data-wiki="title"]')
      .innerHTML = `<img width="24" height="24" src="${flag}"/> ${panel.page.title}`
  }

  function clearStory({panel, article}) {
    let el = article.lastElementChild
    while(el && el.tagName.toLowerCase() != 'header') {
      article.removeChild(el)
      el = article.lastElementChild
    }
  }

  async function renderStory({panel, article}) {
    clearStory({panel, article})
    const story = await Promise.all(panel.page.story.map(item => render(item, panel)))
    for(let html of story) {
      article.insertAdjacentHTML('beforeend', html)
    }
  }

  return article
}

function populateLineup() {
  let hash = (location.hash||'view/welcome-visitors').replace(/(^[\/#]+)|(\/+$)/g,'')
  let fields = hash.split('/')
  const lineupDOM = document.querySelector('[data-wiki=lineup]')
  lineupDOM.textContent = ''
  lineup.length = 0
  while (fields.length) {
    let [where, slug] = fields.splice(0,2)
    let pid = newpid()
    let url = where=='view' ? `./${slug}.json` : `//${where}/${slug}.json`
    let panel = {pid, where, slug, url}
    lineup.push(panel)
    let article = newPage(panel)
    lineupDOM.appendChild(article)
    article.scrollIntoView({inline: 'nearest'})
    probe(where, slug)
      .then(page => {
        panel.page = page;
        article.dispatchEvent(Object.assign(new Event('wiki-render'), {panel, article}))
      })
  }
}

function footer() {
  return `<span>smallest wiki revisited</span>`
}

async function render(item, panel) {
  switch (item.type) {
    case 'paragraph':
      let resolved = item.text
        .replace(/\[\[(.+?)\]\]/g, internal)
        .replace(/\[(.+?) (.+?)\]/g, external)
      return `<p>${resolved}</p>`
    default:
      let handler = types[item.type]
      if (handler) {
        return handler.emit(null, item)
      }
  }
  return `<p style="background-color:#eee;">${item.type}</p>`

  function internal(link, title) {
    return `<a href="#" data-pid=${panel.pid}>${title}</a>`
  }

  function external(link, url, words) {
    return `<a href="${url}" target=_blank>${words} ${linkmark()}</a>`
  }
}

async function click(event) {
  let target = event.target
  let pid = target.dataset.pid
  const article = target.closest('article')
  if (article) {
    article.scrollIntoView({inline: 'nearest'})
  }
  if (pid) {
    event.preventDefault()
    event.stopPropagation()
    let title = target.innerText
    let panel = await resolve(title, pid)
    let hit = lineup.findIndex(panel => panel.pid == pid)
    lineup.splice(hit+1,lineup.length, panel)
    let newHash = '#/'+lineup.flatMap(({where, slug}) => [where, slug]).join('/')
    window.history.pushState(null, panel.page.title, newHash)
    populateLineup()
  }
}

async function resolve(title, pid) {
  const asSlug = (title) => title.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase()
  const recent = (list, action) => {if (action.site && !list.includes(action.site)) list.push(action.site); return list}
  let panel = lineup.find(panel => panel.pid == pid)
  let path = (panel.page.journal||[]).reverse().reduce(recent,[location.host, panel.where])
  let slug = asSlug(title)
  let pages = await Promise.all(path.map(where => probe(where, slug)))
  let hit = pages.findIndex(page => page)
  if (hit >= 0) {
    return {pid:newpid(), where:path[hit], slug, page:pages[hit]}
  } else {
    let page = {title,story:[],journal:[]}
    return {pid:newpid(), where:'ghost', slug, page}
  }
}

function probe(where, slug) {
  let site = where == 'view' ? location.host : where
  return fetch(`//${site}/${slug}.json`, {mode: 'cors'})
    .then(res => res.ok ? res.json() : null)
    .catch(err => null)
}

function linkmark() {
  return `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAC0WlDQ1BJQ0MgUHJvZmlsZQAAKJGNlM9LFGEYx7+zjRgoQWBme4ihQ0ioTBZlROWuv9i0bVl/lBLE7Oy7u5Ozs9PM7JoiEV46ZtE9Kg8e+gM8eOiUl8LALALpblFEgpeS7Xlnxt0R7ccLM/N5nx/f53nf4X2BGlkxTT0kAXnDsZJ9Uen66JhU+xEhHEEdwqhTVNuMJBIDoMFjsWtsvofAvyute/v/OurStpoHhP1A6Eea2Sqw7xfZC1lqBBC5XsOEYzrE9zhbnv0x55TH8659KNlFvEh8QDUtHv+auEPNKWmgRiRuyQZiUgHO60XV7+cgPfXMGB6k73Hq6S6ze3wWZtJKdz9xG/HnNOvu4ZrE8xmtN0bcTM9axuod9lg4oTmxIY9DI4YeH/C5yUjFr/qaoulEk9v6dmmwZ9t+S7mcIA4TJ8cL/TymkXI7p3JD1zwW9KlcV9znd1Yxyeseo5g5U3f/F/UWeoVR6GDQYNDbgIQk+hBFK0xYKCBDHo0iNLIyN8YitjG+Z6SORIAl8q9TzrqbcxtFyuZZI4jGMdNSUZDkD/JXeVV+Ks/JX2bDxeaqZ8a6qanLD76TLq+8ret7/Z48fZXqRsirI0vWfGVNdqDTQHcZYzZcVeI12P34ZmCVLFCpFSlXadytVHJ9Nr0jgWp/2j2KXZpebKrWWhUXbqzUL03v2KvCrlWxyqp2zqtxwXwmHhVPijGxQzwHSbwkdooXxW6anRcHKhnDpKJhwlWyoVCWgUnymjv+mRcL76y5o6GPGczSVImf/4RVyGg6CxzRf7j/c/B7xaOxIvDCBg6frto2ku4dIjQuV23OFeDCN7oP3lZtzXQeDj0BFs6oRavkSwvCG4pmdxw+6SqYk5aWzTlSuyyflSJ0JTEpZqhtLZKi65LrsiWL2cwqsXQb7Mypdk+lnnal5lO5vEHnr/YRsPWwXP75rFzeek49rAEv9d/AvP1FThgxSQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAKtJREFUGJVtkLERwjAMRZ+5UHmmNNpCrpMloMi5gCXcO1MkLWwBS6SCO1EQgkP4d2q+nr50cmZGqbZt18YsV4IxRqv2FcfD8XeYXWl0Xefutzsxxk1iFUJYrfLeU9f1BtwB5JzJOeO9R1UREcZxXCVX5R0l1Pc9AKfz6ZsIoKpcrpcFmqaJlJJ7Pp6klByqah8Nw2BN05iZ2ezzqWU1gIggIv/e+AZDCH+bpV442lpGxygDswAAAABJRU5ErkJggg==" alt="" />`
}
