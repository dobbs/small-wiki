// Manage the incremental viewing from one tab in the browser
// Usage: import { start } from "./view.js"; start()

export { start }
import {types, typesLoaded} from './types.js'

const newpid = () => `panel-${Math.floor(Math.random()*1000000)}`
let lineup = window.lineup = {
  panels: [],
  style() {
    return `
    .wiki-root section {display: flex; flex-direction: row;
      scrollbar-width: none; overflow-x: auto; overflow-y: hidden;}
    .wiki-root article {flex: 0 0 400px; margin: 8px; padding: 8px; overflow-y: auto; overflow-x: hidden;
        color: black; background-color: white; box-shadow: 2px 1px 4px rgba(0, 0, 0, 0.2);}`
  },
  toDOM() {
    const section = document.createElement('section')
    section.setAttribute('data-wiki', 'lineup')
    //TODO create custom event handler
    return section
  },
  reparseHash() {
    let clean = (window.location.hash||'#/welcome-visitors').replace(/(^[\/#]+)|(\/+$)/g,'')
    let idents = clean.split('/')
    let pairs = []
    idents.forEach(function (element) {
      var slug, where
      if (element.includes('@')) {
        [slug, where] = element.split('@')
      } else {
        slug = element
        where = 'view'
      }
      const isOrigin = where == 'view'
      pairs.push({where, slug, isOrigin})
    })
    console.info('*** pairs', pairs)
    return pairs
  },
  updateHash() {
    console.info('***', lineup.panels)
    let newHash = '#' + lineup.panels.flatMap( ({where, slug}) =>
      (where == 'ghost') ? [] :
      (where == 'view') ?  [slug] :
                           [`${slug}@${where}`]
    ).join('/')
    let title = lineup.panels[lineup.panels.length - 1].page.title
    window.history.pushState(null, title, newHash)
  },
  populate() {
    const lineupDOM = document.querySelector('[data-wiki=lineup]')
    lineupDOM.textContent = ''
    lineup.panels.length = 0
    let pairs = this.reparseHash()
    pairs.forEach(({where, slug, isOrigin}) => {
      let pid = newpid()
      let url = isOrigin ? `./${slug}.json` : `//${where}/${slug}.json`
      let panel = {pid, where, slug, url}
      lineup.addPanel(panel)
    })
  },
  removePanelsRightOf(pid) {
    let hit = lineup.panels.findIndex(panel => panel.pid == pid)
    const lineupDOM = document.querySelector('[data-wiki=lineup]')
    for(let i = lineup.panels.length-1; i > hit; i--) {
      let panel = lineup.panels.pop()
      let article = lineupDOM.querySelector(`#${panel.pid}`)
      lineupDOM.removeChild(article)
    }
  },
  addPanel(panel) {
    const lineupDOM = document.querySelector('[data-wiki=lineup]')
    let {where, slug} = panel
    panel.pid = panel.pid || newpid()
    lineup.panels.push(panel)
    let article = newPage(panel)
    lineupDOM.appendChild(article)
    article.scrollIntoView({inline: 'nearest'})
    // Only need to probe for page if we don't already have it
    if (!panel.page) {
      probe(where, slug).then(page => {
        panel.page = page;
        const renderEvent = Object.assign(new Event('wiki-render'), {panel, article})
        article.dispatchEvent(renderEvent)
      })
    } else {
      const renderEvent = Object.assign(new Event('wiki-render'), {panel, article})
      article.dispatchEvent(renderEvent)
    }
  }
}

function start () {
  const root = document.body
  wikiStyle(root)
  wikiLineup(root)
  wikiFooter(root)
  lineup.populate()
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

function wikiLineup(dom, rereadHash) {
  ensureStyleTag(dom).insertAdjacentHTML("beforeend", lineup.style())
  dom.appendChild(lineup.toDOM())
  window.addEventListener('hashchange', lineup.populate.bind(lineup))
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
  if (panel.where == 'ghost') {
    article.setAttribute('style', 'opacity: 0.5;')
  }
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
    const flag = ['view', 'ghost', 'default'].includes(panel.where) ? `./favicon.png` : `//${panel.where}/favicon.png`
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
      await typesLoaded
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
  if (pid) {
    event.preventDefault()
    event.stopPropagation()
    let title = target.innerText
    let panel = await resolve(title, pid)
    let saveLineup = !!event.shiftKey
    if (! saveLineup) {
      lineup.removePanelsRightOf(pid)
    }
    lineup.addPanel(panel)
    lineup.updateHash()
  } else {
    const article = target.closest('article')
    if (article) {
      article.scrollIntoView({inline: 'nearest'})
    }
  }
}

async function resolve(title, pid) {
  const asSlug = (title) => title.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase()
  const recent = (list, action) => {if (action.site && !list.includes(action.site)) list.push(action.site); return list}
  let panel = lineup.panels.find(panel => panel.pid == pid)
  let path = (panel.page.journal||[]).reverse().reduce(recent,[location.host, panel.where])
  let slug = asSlug(title)
  let fetchPromises = path.map(where => probe(where, slug))
  let hit = -1
  let page = null
  for (let i =0; i < fetchPromises.length; i++) {
    page = await fetchPromises[i]
    if (page) {
      hit = i
      break;
    }
  }
  if (hit >= 0) {
    return {pid:newpid(), where:path[hit], slug, page:page}
  } else {
    let page = {title:title ,story:[{"text":"We could not find this page in the expected context.","type":"paragraph"}],journal:[]}
    return {pid:newpid(), where:'ghost', slug, page:page}
  }
}

function probe(where, slug) {
  if (where == 'ghost') {
    return null
  } else {
    return fetchWithTimeout(resolveURL(where, slug), {mode: 'cors'})
      .then(res => res.ok ? res.json() : where == 'view' ? probe('default', slug) : null)
      .catch(err => null)
  }
}

async function fetchWithTimeout(resource, options) {
  const timeout = 2000
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  const response = await fetch(resource, {options, signal: controller.signal})
  clearTimeout(id)
  return response
}

function resolveURL(where, resource) {
  let site = where == 'view' ? location.host : where
  if (site == 'default') {
    return `/default-pages/${resource}.json`
  } else {
    return `//${site}/${resource}.json`
  }
}

function linkmark() {
  return `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAC0WlDQ1BJQ0MgUHJvZmlsZQAAKJGNlM9LFGEYx7+zjRgoQWBme4ihQ0ioTBZlROWuv9i0bVl/lBLE7Oy7u5Ozs9PM7JoiEV46ZtE9Kg8e+gM8eOiUl8LALALpblFEgpeS7Xlnxt0R7ccLM/N5nx/f53nf4X2BGlkxTT0kAXnDsZJ9Uen66JhU+xEhHEEdwqhTVNuMJBIDoMFjsWtsvofAvyute/v/OurStpoHhP1A6Eea2Sqw7xfZC1lqBBC5XsOEYzrE9zhbnv0x55TH8659KNlFvEh8QDUtHv+auEPNKWmgRiRuyQZiUgHO60XV7+cgPfXMGB6k73Hq6S6ze3wWZtJKdz9xG/HnNOvu4ZrE8xmtN0bcTM9axuod9lg4oTmxIY9DI4YeH/C5yUjFr/qaoulEk9v6dmmwZ9t+S7mcIA4TJ8cL/TymkXI7p3JD1zwW9KlcV9znd1Yxyeseo5g5U3f/F/UWeoVR6GDQYNDbgIQk+hBFK0xYKCBDHo0iNLIyN8YitjG+Z6SORIAl8q9TzrqbcxtFyuZZI4jGMdNSUZDkD/JXeVV+Ks/JX2bDxeaqZ8a6qanLD76TLq+8ret7/Z48fZXqRsirI0vWfGVNdqDTQHcZYzZcVeI12P34ZmCVLFCpFSlXadytVHJ9Nr0jgWp/2j2KXZpebKrWWhUXbqzUL03v2KvCrlWxyqp2zqtxwXwmHhVPijGxQzwHSbwkdooXxW6anRcHKhnDpKJhwlWyoVCWgUnymjv+mRcL76y5o6GPGczSVImf/4RVyGg6CxzRf7j/c/B7xaOxIvDCBg6frto2ku4dIjQuV23OFeDCN7oP3lZtzXQeDj0BFs6oRavkSwvCG4pmdxw+6SqYk5aWzTlSuyyflSJ0JTEpZqhtLZKi65LrsiWL2cwqsXQb7Mypdk+lnnal5lO5vEHnr/YRsPWwXP75rFzeek49rAEv9d/AvP1FThgxSQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAKtJREFUGJVtkLERwjAMRZ+5UHmmNNpCrpMloMi5gCXcO1MkLWwBS6SCO1EQgkP4d2q+nr50cmZGqbZt18YsV4IxRqv2FcfD8XeYXWl0Xefutzsxxk1iFUJYrfLeU9f1BtwB5JzJOeO9R1UREcZxXCVX5R0l1Pc9AKfz6ZsIoKpcrpcFmqaJlJJ7Pp6klByqah8Nw2BN05iZ2ezzqWU1gIggIv/e+AZDCH+bpV442lpGxygDswAAAABJRU5ErkJggg==" alt="" />`
}
