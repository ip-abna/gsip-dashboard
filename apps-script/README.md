# Proxy da planilha (Apps Script)

The dashboard cannot read a private sheet with an API key, so this script runs
inside the sheet (under the NA account) and publishes only the columns the
dashboard shows. `Email`, `Nome` and `Telefone` never leave the sheet. The
dashboard reads the script's web address instead of calling Google's API, so
there is no API key to manage.

## Install (once, in the NEW sheet)

Paste this file into the new sheet's **Extensões → Apps Script**, never the old
sheet's: the script always reads the sheet it lives in.

1. In the new sheet: **Extensões → Apps Script**. Delete what is there, paste
   `Code.gs`, save.
2. **Implantar → Novo deploy → app da Web**:
   - Executar como: **eu** (the NA account)
   - Acesso: **Qualquer pessoa**
3. Copy the web address it gives you and send it over. That is what the
   dashboard reads.

## Check it

Open the address in a browser. You should see `{"rows":[…],"locale":"pt_BR"}`.
Search the page for `Email`: no match means names and contacts are not leaking.

## Change it

To hide another column, add its exact header title to `BLOCKED_COLUMNS` in
`Code.gs`, paste it over the code in Apps Script, then **Implantar →
Gerenciar implantações → Nova versão**. Keep this file and the sheet's copy
the same; this file is the backup.
