/**
 * Proxy de preços da PGE-AM (Google Apps Script) — versão JSONP.
 * Deixa a página estática consultar a API de Preços Praticados do Compras.gov.br,
 * que não libera CORS. Só repassa consultas GET de leitura; não grava nada.
 *
 * COMO PUBLICAR / ATUALIZAR:
 *  1. https://script.google.com -> abra o projeto -> cole/substitua este código -> Salve (Ctrl+S).
 *  2. Implantar -> Gerenciar implantações -> lápis (editar) -> Versão: NOVA VERSÃO -> Implantar.
 *     (Manter a implantação existente conserva a mesma URL /exec.)
 *  3. Executar como: Eu.  Quem tem acesso: "Qualquer pessoa".
 */
var BASE = 'https://dadosabertos.compras.gov.br';
var ROTAS_OK = /^\/modulo-(pesquisa-preco|material|servico)\//;  // só endpoints de consulta

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};
  var path = p.path || '';
  var qs = p.qs || '';
  var cb = p.callback || '';
  var body;
  if (!ROTAS_OK.test(path)) {
    body = JSON.stringify({ erro: 'rota nao permitida' });
  } else {
    var url = BASE + path + (qs ? '?' + qs : '');
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Accept': 'application/json' } });
    body = resp.getContentText() || 'null';
  }
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
