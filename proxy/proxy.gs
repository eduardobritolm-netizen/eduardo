/**
 * Proxy de preços da PGE-AM (Google Apps Script).
 * Deixa a página estática consultar a API de Preços Praticados do Compras.gov.br,
 * que não libera CORS. Só repassa consultas GET de leitura; não grava nada.
 *
 * COMO PUBLICAR (uma vez):
 *  1. https://script.google.com  ->  Novo projeto  ->  cole este arquivo.
 *  2. Implantar  ->  Nova implantação  ->  tipo "App da Web".
 *  3. Executar como: Eu.  Quem tem acesso: "Qualquer pessoa".
 *  4. Implantar  ->  copie a URL que termina em /exec.
 *  5. Cole essa URL na constante PROXY no topo de precos.html.
 */
var BASE = 'https://dadosabertos.compras.gov.br';
var ROTAS_OK = /^\/modulo-(pesquisa-preco|material|servico)\//;  // só endpoints de consulta

function doGet(e) {
  var path = (e.parameter.path || '');
  var qs = (e.parameter.qs || '');
  if (!ROTAS_OK.test(path)) {
    return ContentService.createTextOutput(JSON.stringify({ erro: 'rota não permitida' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var url = BASE + path + (qs ? '?' + qs : '');
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Accept': 'application/json' } });
  return ContentService.createTextOutput(resp.getContentText())
    .setMimeType(ContentService.MimeType.JSON);
}
