/* The browser query console: sql.js over a SQLite snapshot of the platform's tables.
   Mirrors the product's rules: SELECT or WITH only, 500 rows, every result priced in rows and ms. */
(function(){
  var root=document.getElementById('console'); if(!root) return;
  var editor=root.querySelector('#sql'), runBtn=root.querySelector('#run'), out=root.querySelector('#result'),
      status=root.querySelector('#status'), schema=root.querySelector('#schema'), chart=root.querySelector('#chart'),
      qlist=root.querySelectorAll('[data-q]'), DB_URL=root.getAttribute('data-db');
  var SQL=null, db=null, loading=null, MAX_ROWS=500;

  function setStatus(msg, kind){ status.textContent=msg; status.className='status '+(kind||''); }

  function loadDb(){
    if(loading) return loading;
    setStatus('loading the snapshot…','busy');
    loading=Promise.all([
      initSqlJs({locateFile:function(f){return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/'+f}}),
      fetch(DB_URL).then(function(r){
        if(!r.ok) throw new Error('snapshot fetch failed: '+r.status);
        if(DB_URL.endsWith('.gz')){
          if(!('DecompressionStream' in window)) throw new Error('this browser cannot inflate the snapshot');
          return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        }
        return r.arrayBuffer();
      })
    ]).then(function(pair){
      SQL=pair[0]; db=new SQL.Database(new Uint8Array(pair[1]));
      renderSchema();
      var n=db.exec("SELECT (SELECT COUNT(*) FROM launches)+(SELECT COUNT(*) FROM boosters)+(SELECT COUNT(*) FROM satellites)+(SELECT COUNT(*) FROM appstore_charts)+(SELECT COUNT(*) FROM itch_games)")[0].values[0][0];
      setStatus('snapshot loaded · '+n.toLocaleString()+' rows across 6 tables and 5 views · runs in your browser, nothing leaves the page','ok');
      if(!out.innerHTML) setTimeout(run,0);
      return db;
    }).catch(function(e){ setStatus(e.message,'err'); loading=null; throw e; });
    return loading;
  }

  function isSafe(sql){
    var s=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').trim();
    if(!/^(select|with)\b/i.test(s)) return 'Only SELECT (or a CTE starting with WITH) runs here, same as the product.';
    if(/;\s*\S/.test(s)) return 'One statement at a time.';
    if(/\b(insert|update|delete|drop|create|alter|attach|pragma|vacuum|replace)\b/i.test(s.replace(/'[^']*'/g,"''"))) return 'That statement is not a SELECT.';
    return null;
  }

  function fmt(v){
    if(v===null||v===undefined) return '<span class="null">NULL</span>';
    if(typeof v==='number'){ return Number.isInteger(v)? v.toLocaleString() : (Math.abs(v)<1e-3? v.toExponential(2) : v.toLocaleString(undefined,{maximumFractionDigits:3})); }
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  }

  function run(){
    var sql=editor.value; var bad=isSafe(sql);
    if(bad){ setStatus(bad,'err'); return; }
    loadDb().then(function(){
      var t0=performance.now(), res;
      try{ res=db.exec(sql); }catch(e){ setStatus(e.message,'err'); out.innerHTML=''; chart.innerHTML=''; return; }
      var ms=performance.now()-t0;
      if(!res.length){ out.innerHTML='<p class="empty">No rows.</p>'; chart.innerHTML=''; setStatus('0 rows · '+ms.toFixed(1)+' ms','ok'); return; }
      var r=res[0], cols=r.columns, rows=r.values, capped=rows.length>MAX_ROWS;
      if(capped) rows=rows.slice(0,MAX_ROWS);
      var h='<div class="tablewrap"><table><thead><tr>'+cols.map(function(c){return '<th>'+fmt(c)+'</th>'}).join('')+'</tr></thead><tbody>';
      rows.forEach(function(row){ h+='<tr>'+row.map(function(v){return '<td class="'+(typeof v==='number'?'n':'')+'">'+fmt(v)+'</td>'}).join('')+'</tr>'; });
      out.innerHTML=h+'</tbody></table></div>';
      setStatus(rows.length.toLocaleString()+(capped?' of more':'')+' rows · '+cols.length+' columns · '+ms.toFixed(1)+' ms'+(capped?' · capped at 500 rows, as the product does':''),'ok');
      drawChart(cols,rows);
    }).catch(function(){});
  }

  function drawChart(cols,rows){
    chart.innerHTML='';
    if(rows.length<2||rows.length>60||cols.length<2) return;
    // the measure is the last numeric column; every other column labels the bar
    var numIdx=-1;
    for(var i=cols.length-1;i>=0;i--){ if(typeof rows[0][i]==='number'){ numIdx=i; break; } }
    if(numIdx<0) return;
    var labIdx=[]; for(var j=0;j<cols.length;j++) if(j!==numIdx) labIdx.push(j);
    var labels=rows.map(function(r){ return labIdx.map(function(j){ return r[j]===null?'NULL':String(r[j]); }).join(' · ').slice(0,34); });
    var vals=rows.map(function(r){return +r[numIdx]||0}), max=Math.max.apply(null,vals), min=Math.min(0,Math.min.apply(null,vals));
    if(!(max>min)) return;
    var W=Math.max(360,Math.min(900,chart.clientWidth||720)),H=Math.min(460,60+rows.length*22),
        L=Math.min(Math.round(W*0.38),Math.max.apply(null,labels.map(function(t){return t.length}))*6.6+16),R=64;
    var title=fmt(cols[numIdx])+' by '+labIdx.map(function(j){return fmt(cols[j])}).join(' · ');
    var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+title+'">';
    s+='<text x="'+L+'" y="16" class="ct">'+title+'</text>';
    var bh=(H-40)/rows.length, x0=L+((0-min)/(max-min))*(W-L-R);
    rows.forEach(function(r,i){
      var v=vals[i], y=30+i*bh, x=L+((Math.min(v,0)-min)/(max-min))*(W-L-R), w=Math.abs(v)/(max-min)*(W-L-R);
      s+='<rect x="'+x+'" y="'+(y+2)+'" width="'+Math.max(w,1)+'" height="'+Math.max(bh-4,2)+'" rx="2" class="bar"/>';
      s+='<text x="'+(L-8)+'" y="'+(y+bh/2+4)+'" text-anchor="end" class="lab">'+fmt(labels[i])+'</text>';
      s+='<text x="'+(Math.max(x+w,x0)+6)+'" y="'+(y+bh/2+4)+'" class="val">'+fmt(v)+'</text>';
    });
    s+='<line x1="'+x0+'" x2="'+x0+'" y1="28" y2="'+(H-8)+'" class="axis"/></svg>';
    chart.innerHTML=s;
  }

  function renderSchema(){
    var rows=db.exec("SELECT table_name, column_name, note FROM _columns")[0].values, by={};
    rows.forEach(function(r){ (by[r[0]]=by[r[0]]||[]).push(r); });
    var counts={}; ['launches','boosters','satellites','appstore_charts','itch_games','ingest_runs'].forEach(function(t){ counts[t]=db.exec('SELECT COUNT(*) FROM '+t)[0].values[0][0]; });
    var h='';
    Object.keys(by).forEach(function(t){
      var isView=!(t in counts);
      h+='<details'+(t==='launches'?' open':'')+'><summary><span class="tn">'+t+'</span><span class="tc">'+(isView?'view':counts[t].toLocaleString()+' rows')+'</span></summary><ul>';
      by[t].forEach(function(r){ h+='<li><code>'+r[1]+'</code>'+(r[2]?'<span>'+fmt(r[2])+'</span>':'')+'</li>'; });
      h+='</ul></details>';
    });
    schema.innerHTML=h;
  }

  runBtn.addEventListener('click',run);
  editor.addEventListener('keydown',function(e){ if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){ e.preventDefault(); run(); } });
  qlist.forEach(function(b){ b.addEventListener('click',function(){
    qlist.forEach(function(o){o.setAttribute('aria-pressed','false')}); b.setAttribute('aria-pressed','true');
    editor.value=b.getAttribute('data-q').trim(); run();
    editor.scrollIntoView({block:'nearest',behavior:'smooth'});
  })});
  // start loading once the console is near the viewport
  if('IntersectionObserver' in window){ var io=new IntersectionObserver(function(es){ if(es.some(function(e){return e.isIntersecting})){ io.disconnect(); loadDb().catch(function(){}); } },{rootMargin:'400px'}); io.observe(root); }
  else loadDb().catch(function(){});
})();
