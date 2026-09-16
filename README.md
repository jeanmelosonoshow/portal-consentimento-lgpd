# Portal de Consentimento LGPD — Sono Show

Interface pública do processo de consentimento para participação no Club Moveleiro.

O portal é hospedado no GitHub Pages. A verificação de duplicidade, o registro na
planilha, a geração do comprovante em PDF e o envio dos e-mails são processados por
um backend no Google Apps Script.

## Publicação

Qualquer alteração enviada para a branch `main` aciona a publicação automática no
GitHub Pages.

## Incorporação

Após a primeira publicação, o portal pode ser incorporado em outra página com:

```html
<iframe
  src="https://jeanmelosonoshow.github.io/portal-consentimento-lgpd/"
  title="Consentimento LGPD — Sono Show"
  width="100%"
  height="1000"
  style="border:0;width:100%;min-height:1000px"
  loading="lazy">
</iframe>
```
