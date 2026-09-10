/** Static episode documents use a small progressive enhancement, not hydration. */
export function EpisodeNavigation() {
  return (
    <nav
      className="episode-jumps"
      aria-label="Transcript navigation"
      data-pagefind-ignore=""
      hidden
    >
      <div className="episode-jumps-top">
        <button type="button" data-jump="top" aria-label="Back to top" hidden>
          <span>Back to top</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h14M12 20V8m-6 6 6-6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          data-jump="previous"
          aria-label="Previous chapter"
          disabled
        >
          <span>Previous chapter</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
      </div>
      <div className="episode-jumps-bottom">
        <button
          type="button"
          data-jump="next"
          aria-label="Next chapter"
          disabled
        >
          <span>Next chapter</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

export const EPISODE_NAVIGATION_SCRIPT = `(function(){
var nav=document.querySelector(".episode-jumps");
var heads=[].slice.call(document.querySelectorAll(".transcript h2[id]"));
if(!nav||!heads.length)return;
var top=nav.querySelector('[data-jump="top"]'),prev=nav.querySelector('[data-jump="previous"]'),next=nav.querySelector('[data-jump="next"]');
var current=-1,queued=false;
function update(){
 queued=false;
 var episode=document.querySelector(".episode");
 if(episode)nav.style.setProperty("--episode-jumps-right",Math.max(0,document.documentElement.clientWidth-episode.getBoundingClientRect().right)+"px");
 var line=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
 current=-1;
 for(var i=0;i<heads.length;i++)if(heads[i].getBoundingClientRect().top<=line+2)current=i;
 top.hidden=window.scrollY<160;
 prev.disabled=current<=0;
 next.disabled=current>=heads.length-1;
 prev.setAttribute("aria-label","Previous chapter"+(current>0?": "+heads[current-1].textContent:""));
 next.setAttribute("aria-label","Next chapter"+(current<heads.length-1?": "+heads[current+1].textContent:""));
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(update)}}
nav.addEventListener("click",function(e){
 var button=e.target.closest("[data-jump]");if(!button||button.disabled)return;
 update();
 var behavior=window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth";
 if(button.dataset.jump==="top"){
  history.pushState(history.state,"",location.pathname+location.search);
  window.scrollTo({top:0,behavior:behavior});
  var title=document.querySelector(".episode-intro h1");
  if(title){title.tabIndex=-1;title.focus({preventScroll:true})}
  return;
 }
 var index=button.dataset.jump==="previous"?current-1:current+1;
 var target=heads[index];if(!target)return;
 // Collapse the mobile outline before measuring the destination.
 var disclosure=document.querySelector(".chapter-disclosure");
 if(disclosure&&window.matchMedia("(max-width: 56rem)").matches)disclosure.open=false;
 history.pushState(history.state,"","#"+encodeURIComponent(target.id));
 target.tabIndex=-1;
 target.focus({preventScroll:true});
 target.scrollIntoView({block:"start",behavior:behavior});
});
window.addEventListener("scroll",schedule,{passive:true});
window.addEventListener("resize",schedule);
window.addEventListener("hashchange",schedule);
window.addEventListener("pageshow",schedule);
if(window.ResizeObserver){var observer=new ResizeObserver(schedule);observer.observe(document.body)}
nav.hidden=false;update();
})();`;
