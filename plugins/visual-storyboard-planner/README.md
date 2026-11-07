# Planejador Visual de Storyboard

Plugin independente Plugin API v2 para transformar planos semânticos de cenas em imagens de storyboard exibidas pela galeria nativa do ContentFlow.

## Fronteira da capability

O plugin não interpreta roteiro, não escolhe relações editoriais e não chama IA. Um Bloco anterior de operador `IA` ou `Humano` produz uma lista `text/many/inline`, com um objeto JSON por cena. O Core preserva identidade, ordem e tentativas; esta capability de operador `Código` valida cada item e materializa:

- `storyboard_frames`: `image/many/artifact`, em SVG;
- `normalized_scenes`: `text/many/inline`, com o JSON canônico validado.

O storyboard aparece no renderer nativo `image-gallery`. Não há HTML, React ou interface arbitrária injetada pelo plugin.

## Contrato de cada cena

```json
{
  "schemaVersion": "1",
  "id": "scene-001",
  "title": "A confiança quebrada",
  "narration": {
    "text": "Desde aquele dia, Marina nunca mais confiou em ninguém.",
    "startMs": 0,
    "endMs": 4800
  },
  "relationship": {
    "type": "figurative",
    "explanation": "A quebra emocional é representada por um coração fragmentado."
  },
  "visual": {
    "description": "Marina em primeiro plano enquanto um coração de vidro se rompe atrás dela.",
    "assetType": "motion_graphic",
    "prompt": "cinematic woman foreground, glass heart breaking in slow motion",
    "searchTerms": ["broken glass heart", "woman distrust"],
    "sketch": {
      "background": "#17202b",
      "shapes": [
        { "type": "ellipse", "cx": 50, "cy": 45, "rx": 18, "ry": 24, "fill": "#dc4455" },
        { "type": "line", "x1": 50, "y1": 69, "x2": 50, "y2": 92, "stroke": "#ffffff", "strokeWidth": 3 }
      ]
    }
  },
  "layers": [
    {
      "id": "marina",
      "type": "avatar",
      "label": "Marina",
      "x": 8,
      "y": 16,
      "width": 42,
      "height": 78,
      "zIndex": 10,
      "opacity": 1,
      "entry": { "type": "fade", "atMs": 0, "durationMs": 350 },
      "motion": "slow push-in"
    }
  ]
}
```

Relações aceitas: `direct_literal`, `figurative`, `abstract` e `programmatic`.

Tipos de asset aceitos: `ai_image`, `ai_video`, `stock_footage`, `avatar`, `motion_graphic`, `text`, `screen_recording` e `other`.

Tipos de camada aceitos: `background`, `media`, `avatar`, `text`, `graphic`, `overlay` e `other`. Posição e tamanho usam percentuais de `0` a `100`.

`visual.sketch` é opcional e contém 1 a 60 formas vetoriais simples (`rect`, `ellipse`, `line`, `polygon`) com coordenadas de `0` a `100` e cores hexadecimais. O Bloco anterior planeja essas formas; este plugin apenas valida e desenha. Sem esboço, o quadro mostra a descrição visual em destaque para não ficar vazio. O esboço é uma referência de composição, não o asset final.

## Execução e segurança

O processamento é local, determinístico e sem rede. O plugin recebe somente os itens conectados ao Bloco, grava SVGs na pasta de saída concedida pelo Core e não persiste conteúdo fora dos artifacts. A permissão necessária é `filesystem:write`; o único efeito declarado é `local_artifact`.

## Desenvolvimento

Na raiz do checkout do ContentFlow:

```sh
npm run plugin:kit -- check ../plugins-contentflow/plugins/visual-storyboard-planner
node ../plugins-contentflow/plugins/visual-storyboard-planner/test.mjs
```

O teste de contrato e os testes unitários não substituem a validação vertical no aplicativo: Bloco anterior → lista de planos → execução da capability → galeria de imagens → delivery persistida.
