# Renderizador de Vídeo de Storyboard

Plugin API v2 que transforma o manifesto da prévia animada em MP4. A prévia permanece uma entrega separada e inspecionável; este plugin apenas materializa o vídeo final com rasterização local e FFmpeg.

O pipeline avança o tempo quadro a quadro, escreve RGBA com backpressure no FFmpeg, seleciona Intel QSV quando configurado e disponível e combina a narração. Legendas SRT podem ser queimadas opcionalmente.

O runtime declara a permissão `native` porque `@napi-rs/canvas` carrega um binding N-API local. Nenhum dado é enviado a terceiros.

O desenvolvimento local requer Node 26, `npm ci` nesta pasta e FFmpeg no `PATH`. Rode `node test.mjs` para os testes locais. Para validar a geração de um MP4 real no PowerShell, execute `$env:FFMPEG_STORYBOARD_E2E='1'; node test.mjs`. Uma distribuição pública deve incluir as dependências nativas e o FFmpeg permitido, com as licenças e os avisos de terceiros, antes de ser publicada.
