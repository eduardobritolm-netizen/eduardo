/* Barra lateral do painel: adiciona o rótulo "Módulos" e um ícone a cada item,
   a partir do data-n do link. Não altera os links (texto/href ficam no HTML). */
(function(){
  var ICONS={
    index:'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
    'visao-geral':'M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z',
    processual:'M3 3v16a2 2 0 0 0 2 2h16M8 15l3-4 3 3 4-6',
    ouvidoria:'M4 5h16v10H9l-4 4V5z',
    transparencia:'M4 20V9m5 11V4m5 16v-7m5 7V11',
    gestao:'M4 20V9m5 11V4m5 16v-7m5 7V11',
    contratacoes:'M8 4h6l4 4v12H6V6a2 2 0 0 1 2-2zM9 13h6M9 17h6',
    despesas:'M3 3v18h18M7 14l3-4 3 3 5-7',
    precos:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    precedentes:'M7 3h7l4 4v14H7zM10 8h5M10 12h5M10 16h3',
    api:'M8 9l-3 3 3 3m8-6 3 3-3 3M14 5l-4 14'
  };
  function build(){
    var nav=document.querySelector('.topnav nav');
    if(!nav) return;
    if(!nav.parentNode.querySelector('.navsec')){
      var sec=document.createElement('div');sec.className='navsec';sec.textContent='Módulos';
      nav.parentNode.insertBefore(sec,nav);
    }
    nav.querySelectorAll('a').forEach(function(a){
      if(a.querySelector('svg')) return;
      var p=ICONS[a.dataset.n];
      if(!p) return;
      a.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+p+'"/></svg>');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build);
  else build();
})();
