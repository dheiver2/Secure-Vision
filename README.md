# Segure Vision

Uma plataforma de monitoramento de câmeras com baixa latência, interface web moderna, detecção de movimento, gravações e automação. Construída sobre Node.js (backend) e Vue (frontend), com armazenamento local em JSON (lowdb), pensada para ser simples de instalar, operar e evoluir.

Sumário
- Visão Geral
- Arquitetura
- Instalação e Execução
- Desenvolvimento da UI
- Armazenamento e Dados
- Capturas de Tela
- API e Permissões
- Streaming e Baixa Latência
- Testes
- Backup e Restauração
- Troubleshooting
- Segurança
- Contribuição e Licença

Visão Geral
- Objetivo: disponibilizar uma UI tipo NVR para câmeras RTSP, com foco em baixa latência, gestão de usuários, gravações, notificações e análise básica de movimento.
- Tecnologias-chave: Node.js, Express, lowdb (JSON), JWT, FFmpeg, WebSocket, Vue + Tailwind.

Arquitetura
- Backend (`src/`):
  - Servidor HTTP e APIs em `src/api` (módulos: autenticação, usuários, câmeras, configurações, sistema e backup).
  - Banco de dados local (lowdb) em `database/database.json` via `src/api/database.js`.
  - Autenticação via JWT e middleware de permissões (`auth.validation.middleware.js`, `auth.permission.middleware.js`).
  - Integração com FFmpeg e serviços de câmera (`src/common/ffmpeg.js`, `src/controller/camera/services/*`).
  - WebSocket e eventos do sistema (`src/api/socket.js`) para atualizações em tempo real.
- Frontend (`ui/`):
  - Aplicação Vue com hot‑reload (`npm run serve`), comunicação via REST e exibição de streams em tempo real.
  - Componentes de câmeras e player (ex.: `ui/src/components/camera-card.vue`).
- CLI/Execução:
  - Arquivo de entrada `bin/camera.ui.js` para iniciar o serviço e configurar o armazenamento.
  - Suporte a service mode (ex.: `misc/service/camera.ui.service`).

Instalação e Execução
- Pré‑requisitos: Node.js LTS, npm e FFmpeg instalados e acessíveis no `PATH`.
- Servidor/Serviço:
  - `npm install`
  - `camera.ui` (armazenamento padrão) ou `camera.ui -S "<caminho>"` para definir o diretório de armazenamento.
- Acesso:
  - Interface: `http://localhost:8081/`
  - Credenciais padrão: usuário `master`, senha `master` (será solicitado alterar no primeiro login).

Desenvolvimento da UI
- `cd ui && npm install`
- `npm run serve` para hot‑reload em `http://localhost:8081/`
- Se ocorrer erro OpenSSL (Node 17+): defina `NODE_OPTIONS=--openssl-legacy-provider` durante build/dev.

Armazenamento e Dados
- Diretório padrão: `~/.camera.ui` (Windows: `C:\Users\SEU_USUARIO\.camera.ui`).
- Estrutura:
  - `config.json` — configurações da aplicação
  - `database/database.json` — usuários, câmeras e settings (lowdb)
  - `recordings/` — gravações e snapshots
  - `logs/camera.ui.log` — logs do serviço
- Variáveis de ambiente (gerenciadas pelo serviço/CLI):
  - `CUI_STORAGE_PATH`, `CUI_STORAGE_CONFIG_FILE`, `CUI_STORAGE_DATABASE_FILE`, `CUI_STORAGE_RECORDINGS_PATH`
  - `CUI_LOG_MODE`, `CUI_VERSION`, `CUI_SERVICE_MODE`

Capturas de Tela
Imagens em `images/screenshots`.

![Login](images/screenshots/login.png)
![Dashboard](images/screenshots/dashboard.png)
![Cameras](images/screenshots/cameras.png)
![Camview](images/screenshots/camview.png)
![Config](images/screenshots/config.png)
![Console](images/screenshots/console.png)
![Notificações](images/screenshots/notifications.png)
![Gravações](images/screenshots/recordings.png)
![Utilização](images/screenshots/utilization.png)

API e Permissões
- Autenticação:
  - `POST /api/auth/login` — body `{ "username": "<user>", "password": "<senha>" }`
  - `POST /api/auth/logout` — requer Bearer token
  - `GET /api/auth/check` — status do token
- Usuários:
  - `GET /api/users` — listar (perm.: `users:access`)
  - `GET /api/users/{name}` — obter (mesmo usuário ou admin)
  - `POST /api/users` — criar (perm.: `admin`)
  - `PATCH /api/users/{name}` — atualizar (mesmo usuário ou admin)
  - `DELETE /api/users/{name}` — remover (perm.: `admin`)
- Configurações (Settings):
  - `GET /api/settings`, `GET /api/settings/{target}`
  - `PATCH /api/settings/{target}` (perm.: `settings:edit`)
  - `PUT /api/settings/reset` (perm.: `admin`)
- Sistema/DB:
  - `GET /api/system/db` — informações do `database.json` (perm.: `admin`)
  - `GET /api/system/db/download` — download do banco (perm.: `admin`)
- Backup:
  - `GET /api/backup/download` (perm.: `backup:download`)
  - `POST /api/backup/restore` (perm.: `backup:restore`, multipart `file`)
- Permissões (exemplos): `admin`, `users:access`, `users:edit`, `settings:edit`, `backup:download`, `backup:restore`.

Streaming e Baixa Latência
- Pipeline:
  - FFmpeg captura/transforma o stream da câmera (`src/common/ffmpeg.js`, serviços em `src/controller/camera/services`).
  - Frontend utiliza `JSMpeg.Player` para exibição em tempo real (`ui/src/components/camera-card.vue`).
- Recomendações de baixa latência:
  - Player: `webgl: true`, `pauseWhenHidden: false`, ajustar `videoBufferSize`.
  - FFmpeg: reduzir buffers (`-rtbufsize 512k`), `-flush_packets 1` para escoamento rápido.

Análise de Vídeo e Detecção de Objetos (Avançado)
- Visão geral:
  - O backend usa `PamDiff` para detectar movimento a partir de frames via `image2pipe` (FFmpeg).
  - Ao detectar movimento, captura um snapshot e envia para o AWS Rekognition (`DetectLabels`) para identificar objetos/labels.
  - Os resultados (labels, confiança e bounding boxes) são emitidos em tempo real via Socket para a UI.
- Como habilitar (AWS Rekognition):
  - Na UI, abra Configurações → Rekognition e informe `Access Key ID`, `Secret Access Key` e `Region`.
  - Ative o serviço (`active: true`) e defina limites de contingente/uso por minuto se desejar.
  - Em cada câmera, configure os filtros (whitelist de labels, limiar de confiança) conforme necessidade.
- Fluxo técnico:
  - FFmpeg (`-f image2pipe`) → `pipe2pam` → `PamDiff` → snapshot via serviços de câmera → `Rekognition DetectLabels` → evento Socket `videoanalysisDetections`.
- Endpoints de controle de análise:
  - `POST /api/cameras/{name}/videoanalysis/restart` — reinicia análise (útil após alterar configurações).
  - `POST /api/cameras/{name}/videoanalysis/stop` — interrompe análise para a câmera.
- Evento Socket e payload:
  - Canal: `videoanalysisDetections`
  - Exemplo de payload:
    ```json
    {
      "camera": "Entrada",
      "at": "2025-10-04T12:01:15.123Z",
      "detections": [
        {
          "label": "Person",
          "confidence": 92.1,
          "boxes": [
            { "left": 0.12, "top": 0.18, "width": 0.15, "height": 0.35 }
          ]
        },
        {
          "label": "Car",
          "confidence": 88.5,
          "boxes": [
            { "left": 0.52, "top": 0.40, "width": 0.20, "height": 0.18 }
          ]
        }
      ]
    }
    ```
- Overlay de detecções na UI:
  - O componente `ui/src/components/camera-card.vue` assina `videoanalysisDetections` e desenha caixas e labels em um `canvas` sobre o vídeo (`JSMpeg.Player`).
  - As caixas usam coordenadas relativas (0..1) do Rekognition e são convertidas para pixels do overlay.
  - O overlay é redimensionado junto ao player e limpa automaticamente após alguns segundos sem novas detecções.
- Filtros por câmera e qualidade dos resultados:
  - Você pode limitar labels detectados (ex.: apenas `Person`, `Car`) e ajustar o limiar mínimo de confiança.
  - Para melhorar a qualidade dos snapshots, garanta boa iluminação e bitrate adequado no stream da câmera.
- Performance, custos e limites:
  - A chamada ao Rekognition é acionada de forma "throttled" após eventos de movimento para reduzir uso e custos.
  - Defina contingentes por minuto e evite chamar em cada frame — ajuste via UI/Settings conforme seu orçamento.
  - Atenção a latência de rede e ao upload de imagens; use regiões AWS próximas ao servidor.
- Alternativa: modelos locais
  - Caso prefira evitar serviços externos, você pode integrar modelos locais (ex.: YOLO via ONNX) no mesmo ponto do pipeline (`videoanalysis.service.js`), substituindo a chamada ao Rekognition por inferência local.
  - Mantenha o mesmo formato de evento Socket para reaproveitar o overlay na UI.

Dicas de Desenvolvimento e Debug (Avançado)
- Backend:
  - Logs de análise e erros de FFmpeg/pipe estão disponíveis no console do serviço e em `logs/camera.ui.log`.
  - Ao ajustar parâmetros de FFmpeg, monitore quedas de frames e backpressure do pipe.
- Frontend:
  - Se o overlay ficar desalinhado, verifique a proporção do container. Ajuste para ler as dimensões reais de destino do `JSMpeg` quando necessário.
  - Use o dev server (`npm run serve` no diretório `ui`) com `NODE_OPTIONS=--openssl-legacy-provider` se usar Node 17+.
  - Ferramentas úteis: `Vue Devtools` para inspecionar estado e eventos, e o console para ver payloads de `videoanalysisDetections`.

Testes
- Testes em `test/__tests__` cobrindo autenticação, usuários, câmeras, settings, backup, etc.
- Script: `npm test` usa Jest com `NODE_OPTIONS=--experimental-vm-modules` (ver `package.json`).
- Boas práticas: adicionar testes para novos endpoints e fluxos críticos.

Backup e Restauração
- Download: `GET /api/backup/download` (exporta todo o ambiente)
- Restauração: `POST /api/backup/restore` (importa arquivo de backup)

Troubleshooting
- OpenSSL em Node 17+: definir `NODE_OPTIONS=--openssl-legacy-provider` durante build/dev da UI.
- Porta `8081` ocupada: liberar ou alterar porta do dev server.
- FFmpeg não encontrado: garantir instalação e presença no PATH.
- CRLF/LF em Windows: ajustar `git config core.autocrlf` conforme necessidade.
- Overlay não aparece:
  - Verifique se o stream está ativo no `camera-card` (canvas principal renderizado).
  - Confirme que o serviço Rekognition está ativo e que a câmera está configurada para detecção.
  - Cheque o evento Socket `videoanalysisDetections` no console e se o `camera` do payload corresponde ao nome da câmera exibida.

Segurança
- Senhas armazenadas com hash (salt + HMAC‑SHA512), não recuperáveis.
- Tokens JWT e permissões por recurso; minimize privilégios.
- Evite expor `database.json`; use endpoints autenticados para download/inspeção.

Contribuição e Licença
- Contribuição: seguir padrões de código, lint e testes; PRs são bem‑vindos.
- Licença: MIT (`LICENSE`).