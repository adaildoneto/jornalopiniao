# Jornal Opiniao App

App web/PWA para leitura das noticias do site `jornalopiniao.net` dentro do app e envio de denuncias do leitor para a redacao. A capa e a leitura destacam duas pracas principais: Rio Branco, capital do Acre, e Boca do Acre, no Amazonas.

O feed carrega materias sob demanda pela API do WordPress. Quando uma cidade ou editoria ainda nao tem chamadas suficientes para preencher a capa, o app busca paginas adicionais automaticamente e tambem oferece o botao "Carregar mais materias".

## Como usar

Abra `index.html` no navegador ou sirva a pasta localmente:

```powershell
npm run serve
```

Depois acesse `http://localhost:4173`.

## App Android com Capacitor

O projeto ja esta preparado para evoluir de web/PWA para aplicativo Android usando Capacitor.

```powershell
npm install
npm run build
npx cap sync android
```

Para abrir o projeto nativo no Android Studio:

```powershell
npm run android:open
```

Depois de qualquer alteracao em `index.html`, `app.js`, `styles.css`, `manifest.webmanifest` ou `sw.js`, rode `npm run build` e `npx cap sync android` para atualizar os arquivos dentro do app Android.

Para gerar um APK debug pelo terminal, use Java 11 ou superior. Nesta maquina, o JDK do Android Studio funcionou:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
cd android
.\gradlew.bat assembleDebug
```

O APK debug fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

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
