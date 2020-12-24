// Manage the incremental viewing from one tab in the browser
// Usage: import { start } from "./view.js"; start()

export { start }
import { types } from "./types.js"

const newpid = () => Math.floor(Math.random()*1000000)
let lineup = window.lineup = []

function start () {
  document.body.insertAdjacentHTML("beforeend", `
    <style>
      body, html {width: 100vw; height: 100vh;}
      body {font-family: Arial, Helvetica, sans-serif;
        display:flex; flex-direction:column;
        margin:0; padding:0; overflow:hidden;}
      section {flex: 90 80 auto; display: flex; flex-direction: row; scrollbar-width: none;}
      article {flex: 0 0 400px; position: relative;
        margin: 8px; color: black; background-color: white; box-shadow: 2px 1px 4px rgba(0, 0, 0, 0.2);
      }
      .paper {padding: 8px; overflow-y: auto; overflow-x: hidden;
        top: 0; bottom: 0; left: 0; right: 0; position: absolute;}
      footer {background-color:#ccc; padding:10px;
        flex: 2 0 20px;}
    </style>
    <section data-wiki=lineup></section>
    <footer>${footer()}</footer>`)
  populateLineup()
  document.addEventListener('click', click)
}

function populateLineup() {
  let hash = (location.hash||'view/welcome-visitors').replace(/(^[\/#]+)|(\/+$)/g,'')
  let fields = hash.split('/')
  const lineupDOM = document.querySelector('[data-wiki=lineup]')
  while (fields.length) {
    let [where,slug] = fields.splice(0,2)
    let pid = newpid()
    lineupDOM.insertAdjacentHTML("beforeend", `<article id=${pid}><h3>${slug}</h3></article>`)
    let url = where=='view' ? `./${slug}.json` : `//${where}/${slug}.json`
    let panel = {pid, where, slug, url}
    lineup.push(panel)
    fetch(url).then(res => res.json()).then(json => {panel.page = json; refresh(panel)})
  }
}

function footer() {
  return `<span>smallest wiki revisited</span>`
}


function update() {
  const lineupDOM = document.querySelector('[data-wiki=lineup]')
  lineupDOM.textContent = ''
  for (const panel of lineup) {
    lineupDOM.insertAdjacentHTML("beforeend", `<article id=${panel.pid}><h3>${panel.page.title}</h3></article>`)
  }
  for (const panel of lineup) {
    refresh(panel)
  }
}

async function refresh(panel) {
  let url = panel.where=='view' ? `./favicon.png` : `//${panel.where}/favicon.png`
  let title = `<h3><img width=24 src="${url}"> ${panel.page.title}</h3>`
  let story = (await Promise.all(panel.page.story.map(item => render(item,panel)))).join("\n")
  document.getElementById(panel.pid).innerHTML = `<div class=paper>${title}${story}</div>`
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
  if (pid) {
    event.preventDefault()
    event.stopPropagation()
    let title = target.innerText
    let panel = await resolve(title, pid)
    let hit = lineup.findIndex(panel => panel.pid == pid)
    lineup.splice(hit+1,lineup.length, panel)
    update()
  }
}

async function resolve(title, pid) {
  const asSlug = (title) => title.replace(/\s/g, '-').replace(/[^A-Za-z0-9-]/g, '').toLowerCase()
  const recent = (list, action) => {if (action.site && !list.includes(action.site)) list.push(action.site); return list}
  let panel = lineup.find(panel => panel.pid == pid)
  let path = (panel.page.journal||[]).reverse().reduce(recent,[location.host, panel.where])
  console.log('resolve',{panel, path})
  let slug = asSlug(title)
  let pages = await Promise.all(path.map(where => probe(where, slug)))
  console.log({path, pages})
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
  return fetch(`//${site}/${slug}.json`)
    .then(res => res.ok ? res.json() : null)
    .catch(err => null)
}

function linkmark() {
  return `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAC0WlDQ1BJQ0MgUHJvZmlsZQAAKJGNlM9LFGEYx7+zjRgoQWBme4ihQ0ioTBZlROWuv9i0bVl/lBLE7Oy7u5Ozs9PM7JoiEV46ZtE9Kg8e+gM8eOiUl8LALALpblFEgpeS7Xlnxt0R7ccLM/N5nx/f53nf4X2BGlkxTT0kAXnDsZJ9Uen66JhU+xEhHEEdwqhTVNuMJBIDoMFjsWtsvofAvyute/v/OurStpoHhP1A6Eea2Sqw7xfZC1lqBBC5XsOEYzrE9zhbnv0x55TH8659KNlFvEh8QDUtHv+auEPNKWmgRiRuyQZiUgHO60XV7+cgPfXMGB6k73Hq6S6ze3wWZtJKdz9xG/HnNOvu4ZrE8xmtN0bcTM9axuod9lg4oTmxIY9DI4YeH/C5yUjFr/qaoulEk9v6dmmwZ9t+S7mcIA4TJ8cL/TymkXI7p3JD1zwW9KlcV9znd1Yxyeseo5g5U3f/F/UWeoVR6GDQYNDbgIQk+hBFK0xYKCBDHo0iNLIyN8YitjG+Z6SORIAl8q9TzrqbcxtFyuZZI4jGMdNSUZDkD/JXeVV+Ks/JX2bDxeaqZ8a6qanLD76TLq+8ret7/Z48fZXqRsirI0vWfGVNdqDTQHcZYzZcVeI12P34ZmCVLFCpFSlXadytVHJ9Nr0jgWp/2j2KXZpebKrWWhUXbqzUL03v2KvCrlWxyqp2zqtxwXwmHhVPijGxQzwHSbwkdooXxW6anRcHKhnDpKJhwlWyoVCWgUnymjv+mRcL76y5o6GPGczSVImf/4RVyGg6CxzRf7j/c/B7xaOxIvDCBg6frto2ku4dIjQuV23OFeDCN7oP3lZtzXQeDj0BFs6oRavkSwvCG4pmdxw+6SqYk5aWzTlSuyyflSJ0JTEpZqhtLZKi65LrsiWL2cwqsXQb7Mypdk+lnnal5lO5vEHnr/YRsPWwXP75rFzeek49rAEv9d/AvP1FThgxSQAAAAlwSFlzAAALEwAACxMBAJqcGAAAAKtJREFUGJVtkLERwjAMRZ+5UHmmNNpCrpMloMi5gCXcO1MkLWwBS6SCO1EQgkP4d2q+nr50cmZGqbZt18YsV4IxRqv2FcfD8XeYXWl0Xefutzsxxk1iFUJYrfLeU9f1BtwB5JzJOeO9R1UREcZxXCVX5R0l1Pc9AKfz6ZsIoKpcrpcFmqaJlJJ7Pp6klByqah8Nw2BN05iZ2ezzqWU1gIggIv/e+AZDCH+bpV442lpGxygDswAAAABJRU5ErkJggg==" alt="" />`
}
