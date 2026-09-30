(function(){
  document.querySelectorAll('[data-copy]').forEach(function(btn){
    var target=document.getElementById(btn.getAttribute('data-copy'));
    btn.addEventListener('click',function(){
      var done=function(){var t=btn.textContent;btn.textContent='copied';setTimeout(function(){btn.textContent=t},1500)};
      var fallback=function(){var r=document.createRange();r.selectNodeContents(target);var s=getSelection();s.removeAllRanges();s.addRange(r)};
      try{navigator.clipboard.writeText(target.textContent).then(done,fallback)}catch(e){fallback()}
    });
  });
})();
