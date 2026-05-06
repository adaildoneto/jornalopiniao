# Jornal Opiniao App

App web/PWA para leitura das noticias do site `jornalopiniao.net` dentro do app e envio de denuncias do leitor para a redacao. A capa e a leitura destacam duas pracas principais: Rio Branco, capital do Acre, e Boca do Acre, no Amazonas.

## Como usar

Abra `index.html` no navegador ou sirva a pasta localmente:

```powershell
node .\dev-server.mjs
```

Depois acesse `http://localhost:4173`.

## Configuracao do canal de denuncia

No arquivo `app.js`, ajuste estes valores conforme o canal oficial da redacao:

```js
const NEWSROOM_EMAIL = "redacao@jornalopiniao.net";
const WHATSAPP_NUMBER = "";
```

Para WhatsApp, use o numero com codigo do pais e DDD, somente digitos. Exemplo: `5568999999999`.

## Fonte de noticias

O app consome a API publica do WordPress:

```text
https://jornalopiniao.net/wp-json/wp/v2/posts?per_page=18&_embed=1
```

Se a API estiver indisponivel, o app mostra uma chamada de fallback com orientacao para atualizar ou acessar o site oficial.

## Licenca

Este projeto usa a licenca descrita em `LICENSE`.
