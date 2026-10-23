# Vídeo por Sequência de Imagens (FFmpeg)

Plugin independente Plugin API v2 para o processo universal **Edição**. Recebe imagens na ordem definida pelo Método e gera um MP4 H.264. A capability original usa uma faixa de áudio como duração total; a capability de edição por SRT também funciona sem áudio e aplica movimentos Ken Burns variados em uma única renderização do FFmpeg.

## Capability

- `compose-image-sequence-with-audio`
- bloco: `CRIAR`
- operador: `Código`
- entrada `images`: uma ou mais imagens JPEG, PNG ou WebP; a ordem é preservada
- entrada `audio`: AAC, FLAC, M4A/MP4, MP3, OGG/Opus, WAV ou WebM
- entrada opcional `subtitles`: um arquivo SRT; em `timingMode: "srt"`, a troca das imagens acompanha o final dos cues
- saída `video`: MP4 H.264 (`yuv420p`) com áudio AAC

### Edição por SRT com Ken Burns

- `compose-image-sequence-from-srt`
- entrada `images`: imagens ordenadas JPEG, PNG ou WebP
- entrada `subtitles`: um arquivo SRT obrigatório; o último cue define a duração sem áudio
- entrada opcional `audio`: quando presente, fornece a faixa final e sua duração é validada contra o SRT
- saída `video`: MP4 H.264, com áudio AAC somente quando fornecido

Os movimentos disponíveis incluem zoom in, zoom out e panorâmicas horizontais, verticais e diagonais. A escolha varia por imagem com uma semente determinística: retries com os mesmos inputs e configuração preservam o resultado. O FFmpeg monta todos os segmentos em um único grafo e codifica o MP4 uma vez, sem gravar clipes intermediários. Para evitar o aspecto de movimento em degraus do `zoompan`, o plugin usa supersampling 2× com interpolação Lanczos antes de reduzir para a resolução final; isso dá precisão de meio pixel sem adicionar OpenCV ao runtime.

O preset `balanced` usa amplitude de 13%, entre `subtle` (6%) e `dynamic` (16%).

O padrão é 1920×1080, 30 fps, enquadramento `cover` e CRF 20. A capability original usa distribuição `equal`; a nova capability usa movimento `balanced` e semente `1`. Em `contain`, o plugin preserva toda a imagem e preenche o restante com a cor configurada. No modo SRT, deve existir ao menos um cue por imagem; se houver mais cues que imagens, o plugin os agrupa preservando toda a linha do tempo.

## Execução e segurança

Todo o processamento ocorre localmente e sem rede. O plugin usa somente arquivos liberados por `resolveInputFile()`, grava em `getOutputPath()` e inicia o executável empacotado com argumentos estruturados, sem shell. A execução respeita timeout e o sinal de cancelamento do núcleo. Limites: 60 imagens, 4 GB por entrada, 6 horas de áudio e 8 GB de saída.

Permissões: `filesystem:read`, `filesystem:write` e `process`. Efeitos: artifact local e subprocesso. Custo externo: nenhum. Dados enviados a terceiros: nenhum.

## FFmpeg empacotado

O plugin contém o FFmpeg 6.1.1 estático para Windows x64. Consulte `THIRD_PARTY_NOTICES.md` e `vendor/ffmpeg/README.md` para licença, proveniência e hash.

## Validação

```powershell
npm run plugin:kit -- check ./ecosystem/plugins/reference/ffmpeg-image-sequence-video
```

Versão do ContentFlow testada: 0.4.1. Runtime: Node 26/ESM. Não há secrets, autenticação ou credenciais para revogar.


## Licença MIT

O código deste plugin é aberto sob MIT: uso pessoal ou comercial, modificação e redistribuição são permitidos com preservação dos avisos de autoria e licença. Dependências de terceiros conservam suas próprias licenças e avisos. A licença do aplicativo ContentFlow é separada.
