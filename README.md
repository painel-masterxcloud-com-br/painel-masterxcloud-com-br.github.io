# Master XCloud Web

Interface web/PWA do Master XCloud, hospedada no GitHub Pages e conectada ao backend da aplicação.

## O que funciona
- Interface responsiva para celular e desktop.
- Login por e-mail e senha através do backend.
- Validação e manutenção de sessão.
- Ativação de dispositivo com Device Key / MAC e M3U / DNS.
- Status visual da operação e contagem de ativações da sessão.
- Instalação como PWA em navegadores compatíveis.
- Hospedagem do frontend via GitHub Pages.

## Arquitetura
O GitHub Pages hospeda apenas o frontend estático. As credenciais e operações são enviadas por HTTPS para o backend configurado no `app.js`:

`https://master-xcloud-web.onrender.com`

Endpoints utilizados atualmente:
- `GET /health`
- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /operations/activate`

O token de sessão é mantido em `sessionStorage`, portanto não fica persistido após o encerramento da sessão do navegador.

## PWA
O projeto possui:
- `manifest.webmanifest`
- `service-worker.js`
- ícones 192x192 e 512x512

O service worker usa estratégia network-first para os arquivos do frontend e não intercepta chamadas para o backend no Render.

## Publicação
O repositório usa a branch `main` e pode ser publicado pelo GitHub Pages a partir da raiz `/`.

O domínio personalizado é definido pelo arquivo `CNAME`.

## Teste local
O frontend pode ser aberto diretamente pelo `index.html`, mas chamadas à API dependem de conectividade com o backend e das regras de CORS configuradas no servidor.
