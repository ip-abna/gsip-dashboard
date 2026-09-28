/**
 * Proxy público do painel GSIP.
 *
 * A planilha continua privada. Este script publica só as colunas que o
 * painel mostra — sem Email, Nome e Telefone. Numa planilha nova, cole este
 * arquivo em Extensões → Apps Script e implante como app da Web com acesso
 * "Qualquer pessoa". Como instalar, em apps-script/README.md.
 */

// Colunas que existem na planilha e nunca saem dela. Para esconder outra,
// some o título exato (como está no cabeçalho) nesta lista.
var BLOCKED_COLUMNS = ['Email', 'Nome', 'Telefone'];

// Aba que o Google cria ao vincular um formulário: "Respostas ao formulário 4",
// "Form Responses 1". Religar o formulário cria a aba N+1, e o painel passa a
// ler a de número maior sozinho.
var RESPONSES_TAB = /^(respostas ao formulário|form responses)\s+(\d+)$/i;

function doGet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tab = newestResponsesTab(ss);
    if (!tab) {
        return json({ error: 'Nenhuma aba de respostas. Ligue o formulário em Respostas → Vincular ao Planilhas.' });
    }

    // getValues (não getDisplayValues): números chegam como número e datas
    // como Date, sem a formatação da localidade. O painel já entende os dois.
    var values = ss.getSheetByName(tab).getDataRange().getValues();
    var headers = values[0].map(function (header) { return String(header); });
    var rows = values.slice(1).map(function (cells) {
        var row = {};
        headers.forEach(function (header, i) {
            if (BLOCKED_COLUMNS.indexOf(header.trim()) !== -1) return;
            var value = cells[i];
            if (value === '' || value === null || value === undefined) return;
            row[header] = value instanceof Date ? value.toISOString() : value;
        });
        return row;
    });

    return json({ rows: rows, locale: ss.getSpreadsheetLocale() || 'pt_BR' });
}

/**
 * A aba de respostas de número maior. Sem ela, o painel não tem o que ler.
 */
function newestResponsesTab(ss) {
    var best = null;
    var bestN = -1;
    ss.getSheets().forEach(function (sheet) {
        var match = RESPONSES_TAB.exec(sheet.getName());
        if (match && +match[2] > bestN) {
            bestN = +match[2];
            best = sheet.getName();
        }
    });
    return best;
}

function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
