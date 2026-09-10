import { LINK_SUBJECTS } from "../content/link-subjects.ts";
import type { LinkResource } from "../content/links.ts";
import { hms, monthYear } from "../content/time.ts";

export const LINK_LIBRARY_SCRIPT = `(function(){
var root=document.querySelector('.link-library');if(!root)return;
var input=document.getElementById('link-filter'),subject=document.getElementById('subject-filter'),year=document.getElementById('year-filter'),sort=document.getElementById('link-sort');
var archive=document.getElementById('link-results'),list=document.getElementById('resource-list'),cards=[].slice.call(list.querySelectorAll('.link-row'));
var more=document.getElementById('load-links'),empty=document.getElementById('links-empty'),count=document.getElementById('link-count'),heading=document.getElementById('results-heading');
var PAGE=24,limit=PAGE,all=false;
function normalize(s){return s.toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\brscs?\\b/g,'react server components').replace(/react forget/g,'react compiler')}
function restore(){var p=new URLSearchParams(location.search);input.value=p.get('q')||'';subject.value=p.get('subject')||'';if(subject.selectedIndex<0)subject.value='';year.value=p.get('year')||'';if(year.selectedIndex<0)year.value='';sort.value=p.get('sort')==='oldest'?'oldest':'newest';all=p.get('view')==='all';limit=PAGE}
function url(push){var u=new URL(location.href);['q','subject','year','sort','view'].forEach(function(k){u.searchParams.delete(k)});if(input.value.trim())u.searchParams.set('q',input.value.trim());if(subject.value)u.searchParams.set('subject',subject.value);if(year.value)u.searchParams.set('year',year.value);if(sort.value!=='newest')u.searchParams.set('sort',sort.value);if(all)u.searchParams.set('view','all');u.hash='';history[push?'pushState':'replaceState']({},'',u)}
function update(){
 var active=all||!!input.value.trim()||!!subject.value||!!year.value;
 root.classList.toggle('has-selection',active);document.getElementById('subject-browser').hidden=active;document.getElementById('archive-controls').hidden=!active;archive.open=active;
 if(!active){cards.forEach(function(c){c.hidden=true});return}
 var words=normalize(input.value.trim()).split(/\\s+/).filter(Boolean),matched=[];
 cards.forEach(function(card){
  var mentions=[].slice.call(card.querySelectorAll('.resource-mention'));
  var visible=mentions.filter(function(m){return(!subject.value||m.dataset.subjects.split(' ').includes(subject.value))&&(!year.value||m.dataset.date.slice(0,4)===year.value)&&words.every(function(w){return normalize(m.dataset.text).includes(w)})});
  card.hidden=true;if(!visible.length)return;
  visible.sort(function(a,b){return a.dataset.date.localeCompare(b.dataset.date)});if(sort.value==='newest')visible.reverse();
  var primary=visible[0],link=primary.querySelector('a'),main=card.querySelector('.primary-discussion');main.href=link.href;main.textContent=link.textContent;main.title=link.title;
  card.querySelector('.resource-title a').textContent=primary.dataset.title;
  mentions.forEach(function(m){m.hidden=m===primary||!visible.includes(m)});
  var extra=card.querySelector('.resource-discussions');extra.hidden=visible.length<2;extra.querySelector('summary').textContent=(visible.length-1)+' more discussion'+(visible.length===2?'':'s');
  matched.push({card:card,date:primary.dataset.date,month:primary.dataset.month});
 });
 matched.sort(function(a,b){var order=a.date.localeCompare(b.date);return(sort.value==='newest'?-order:order)||a.card.dataset.url.localeCompare(b.card.dataset.url)});
 list.replaceChildren();var groups=new Map();
 matched.slice(0,limit).forEach(function(m){
  var key=m.date.slice(0,7),group=groups.get(key);
  if(!group){var section=document.createElement('section');section.className='resource-month';section.dataset.month=key;
   var title=document.createElement('h3');title.id='month-'+key;title.className='resource-month-heading';var time=document.createElement('time');time.dateTime=key;time.textContent=m.month;title.appendChild(time);section.appendChild(title);section.setAttribute('aria-labelledby',title.id);
   group=document.createElement('ol');section.appendChild(group);groups.set(key,group);list.appendChild(section)}
  m.card.hidden=false;group.appendChild(m.card);
 });
 heading.textContent=subject.value?subject.options[subject.selectedIndex].text:'Explore the archive';
 count.textContent=matched.length?Math.min(limit,matched.length)+' of '+matched.length+' resources'+(year.value?' discussed in '+year.value:''):'No resources match these filters';
 empty.hidden=matched.length!==0;more.hidden=matched.length<=limit;more.textContent='Show '+Math.min(PAGE,matched.length-limit)+' more';
}
root.classList.add('links-enhanced');document.getElementById('archive-search').hidden=false;
root.addEventListener('click',function(e){var topic=e.target.closest('[data-subject]');if(topic){e.preventDefault();subject.value=topic.dataset.subject;all=!subject.value;limit=PAGE;url(true);update();heading.focus();heading.scrollIntoView({block:"start"});return}var reset=e.target.closest('[data-reset]');if(reset){input.value='';subject.value='';year.value='';sort.value='newest';all=false;limit=PAGE;url(true);update();document.getElementById('subjects-heading').focus()}});
input.addEventListener('input',function(){limit=PAGE;url(false);update()});
[subject,year,sort].forEach(function(el){el.addEventListener('change',function(){all=true;limit=PAGE;url(true);update()})});
more.addEventListener('click',function(){var before=limit;limit+=PAGE;update();var shown=list.querySelectorAll('.link-row:not([hidden])');if(shown[before])shown[before].querySelector('.resource-title a').focus()});
window.addEventListener('popstate',function(){restore();update()});restore();update();
})();`;

export function LinkLibrary({ resources }: { resources: LinkResource[] }) {
  const mentions = resources.flatMap((resource) => resource.mentions);
  const years = [
    ...new Set(mentions.map((mention) => mention.date.slice(0, 4))),
  ].sort();
  const episodes = new Set(mentions.map((mention) => mention.episodeSlug)).size;
  const monthGroups = Map.groupBy(
    resources.toSorted(
      (a, b) =>
        b.mentions.at(-1)!.date.localeCompare(a.mentions.at(-1)!.date) ||
        a.url.localeCompare(b.url),
    ),
    (resource) => resource.mentions.at(-1)!.date.slice(0, 7),
  );
  return (
    <div className="link-library">
      <header className="links-intro">
        <p className="eyebrow">The conversation, collected</p>
        <h1>Follow the ideas.</h1>
        <p className="lead">
          Explore the people, projects, and turning points discussed on This
          Month in React. Open a source, or return to the conversation around
          it.
        </p>
        <p className="library-stats">
          {resources.length.toLocaleString("en-US")} resources · {episodes}{" "}
          episodes · {years[0]}–{years.at(-1)}
        </p>
      </header>
      <div id="archive-search" hidden>
        <label htmlFor="link-filter">Search the archive</label>
        <input
          id="link-filter"
          type="search"
          placeholder="Try RSC, Waku, Dan Abramov…"
          autoComplete="off"
          aria-controls="resource-list"
        />
        <p className="search-hint">
          Search names, projects, sources, or words from the show notes.
        </p>
      </div>
      <section id="subject-browser" aria-labelledby="subjects-heading">
        <div className="subject-heading">
          <h2 id="subjects-heading" tabIndex={-1}>
            Start with a subject
          </h2>
          <a href="?view=all" data-subject="">
            Browse all resources ↗
          </a>
        </div>
        <div className="subject-grid">
          {LINK_SUBJECTS.map((subject) => {
            const count = resources.filter((resource) =>
              resource.subjects.includes(subject.id),
            ).length;
            return (
              <a
                className="subject-card"
                key={subject.id}
                href={`?subject=${subject.id}`}
                data-subject={subject.id}
              >
                <div className="subject-card-top">
                  <h3>{subject.title}</h3>
                  <span aria-hidden="true">↗</span>
                </div>
                <p>{subject.description}</p>
                <span className="subject-count">{count} resources</span>
              </a>
            );
          })}
        </div>
      </section>
      <div id="archive-controls" hidden>
        <button type="button" className="explore-subjects" data-reset="">
          ← Explore subjects
        </button>
        <div className="library-filters">
          <label>
            Subject
            <select id="subject-filter">
              <option value="">All subjects</option>
              {LINK_SUBJECTS.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Discussed in
            <select id="year-filter">
              <option value="">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select id="link-sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </div>
      <noscript>
        <style>{"#subject-browser { display: none; }"}</style>
        <p>
          Open the full archive below and use your browser’s Find command to
          look for a subject, person, or project.
        </p>
      </noscript>
      <details id="link-results">
        <summary>
          Browse all {resources.length.toLocaleString("en-US")} resources
        </summary>
        <div className="library-results-heading">
          <h2 id="results-heading" tabIndex={-1}>
            Explore the archive
          </h2>
          <p id="link-count" role="status" aria-live="polite" />
        </div>
        <p className="archive-date-note">
          Dates show when we discussed a resource, not when it was published.
        </p>
        <div id="links-empty" hidden>
          <h3>No matches yet.</h3>
          <p>Try fewer words, another year, or a broader subject.</p>
          <button type="button" data-reset="">
            Clear filters and explore subjects
          </button>
        </div>
        <div id="resource-list">
          {[...monthGroups].map(([key, grouped]) => (
            <section
              key={key}
              className="resource-month"
              data-month={key}
              aria-labelledby={`month-${key}`}
            >
              <h3 id={`month-${key}`} className="resource-month-heading">
                <time dateTime={key}>{monthYear(`${key}-01`)}</time>
              </h3>
              <ol>
                {grouped.map((resource) => {
                  const first = resource.mentions.at(-1)!;
                  const discussionLabel = (mention: typeof first) =>
                    `${mention.discussionUrl.includes("#") ? "Open discussion" : "Open episode"} · ${monthYear(mention.date)}${mention.time !== undefined ? ` · ${hms(mention.time)}` : ""}`;
                  return (
                    <li
                      className="link-row"
                      key={resource.id}
                      id={resource.id}
                      data-url={resource.url}
                      data-text={resource.text}
                    >
                      <article className="resource-body">
                        <p className="resource-host">{resource.host}</p>
                        <h4 className="resource-title">
                          <a href={resource.url} rel="noreferrer">
                            {first.text}
                          </a>
                        </h4>
                        <div className="resource-context">
                          <a
                            className="primary-discussion"
                            href={first.discussionUrl}
                            title={first.episodeTitle}
                          >
                            {discussionLabel(first)}
                          </a>
                          <details className="resource-discussions">
                            <summary>
                              {resource.mentions.length} discussions
                            </summary>
                            <ul>
                              {resource.mentions.map((mention) => (
                                <li
                                  key={`${mention.episodeSlug}-${mention.discussionUrl}-${mention.time}`}
                                  className="resource-mention"
                                  data-date={mention.date}
                                  data-month={monthYear(mention.date)}
                                  data-title={mention.text}
                                  data-subjects={mention.subjects.join(" ")}
                                  data-text={[
                                    mention.text,
                                    mention.url,
                                    ...mention.context,
                                  ].join(" ")}
                                >
                                  <a
                                    href={mention.discussionUrl}
                                    title={mention.episodeTitle}
                                  >
                                    {discussionLabel(mention)}
                                  </a>
                                  <p>{mention.text}</p>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
        <button id="load-links" type="button" hidden>
          Show more
        </button>
      </details>
    </div>
  );
}
