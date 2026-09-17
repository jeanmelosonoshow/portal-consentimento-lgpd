# Portal de Consentimento LGPD — Sono Show

Interface pública do processo de consentimento para participação no Club Moveleiro.

O portal é hospedado na Vercel. A Vercel funciona como uma API intermediária
same-origin e encaminha as operações ao Google Apps Script, que continua responsável
pela verificação de duplicidade, registro na planilha, geração do comprovante em PDF
e envio dos e-mails.

## Publicação

Qualquer alteração enviada para a branch conectada aciona a publicação automática
na Vercel.

## Configuração da Vercel

1. Importe este repositório no projeto da Vercel.
2. Se solicitado, use o preset **Other** e deixe o comando de build vazio.
3. Crie a variável de ambiente `APPS_SCRIPT_URL` com o URL `/exec` da implantação
   pública do Apps Script.
4. Faça um redeploy após salvar a variável.

O arquivo `.env.example` contém o formato esperado. Não coloque chaves privadas,
tokens ou dados pessoais no repositório.

## Incorporação

Após a primeira publicação, o portal pode ser incorporado em outra página com:

```html
<iframe
  src="https://SEU-PROJETO.vercel.app/"
  title="Consentimento LGPD — Sono Show"
  width="100%"
  height="1000"
  style="border:0;width:100%;min-height:1000px"
  loading="lazy">
</iframe>
```
