# INV-490: Extract currency formatting into a shared helper

Tech debt. Invoice table, invoice PDF and the payments email each format amounts with
their own copy of the same code. Move it into one `formatMoney` helper. No behaviour
change; outputs must stay byte-identical.
