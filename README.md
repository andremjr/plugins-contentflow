# Plugins para ContentFlow

Plugins independentes e de código aberto para o [ContentFlow](https://github.com/andremjr/contentflow). Licença **MIT**: você pode usar, estudar, melhorar, distribuir e vender versões derivadas, preservando os avisos de licença e autoria.

## Usar no aplicativo

No ContentFlow 1.3.3 ou superior, abra **Plugins → Catálogo de plugins**, instale os pacotes desejados e revise as permissões para ativá-los. Atualizações compatíveis aparecem com um indicador azul nos plugins instalados. Instalação e ativação são decisões locais; contas, login, perfis e credenciais não são distribuídos.

Instalação por pasta também é possível: obtenha o ZIP da release correspondente, extraia e selecione a pasta no Gerenciador de Plugins.

## Estrutura

- `plugins/`: código-fonte dos plugins, manifestos, READMEs e licenças.
- `catalog.json`: catálogo consultado pelo aplicativo.
- Releases: pacotes individuais imutáveis, com versão e SHA-256.
- `scripts/package.mjs`: prepara somente o plugin escolhido e uma nova revisão do catálogo.

Executáveis e runtimes de terceiros são distribuídos nos ZIPs das releases; seus avisos, licenças e instruções de preparação permanecem nas fontes. Ao desenvolver a partir de um clone, prepare as dependências conforme o README do plugin, ou extraia o pacote da mesma versão antes de alterar suas fontes.

## Publicar uma atualização individual

1. Altere somente o plugin desejado e incremente seu `version` no manifesto e no package.json. Portas incompatíveis exigem nova major; `apiVersion` é independente dessa versão.
2. Preserve seu ID público e declare `minCoreVersion` e permissões corretas.
3. Instale as dependências do empacotador com `npm install` e execute `npm run package -- nome-da-pasta`.
4. Revise o ZIP e crie a release com a tag indicada pelo script, enviando o pacote primeiro.
5. Depois da confirmação do upload, copie o `catalog.json` preparado em release/ para a raiz e publique esse arquivo no branch main.

O catálogo conserva as entradas dos demais plugins. Não é necessário republicar todos nem lançar uma versão do aplicativo. Não inclua cookies, tokens, sessões, perfis ou capturas locais. Builds e publicação são locais, sem GitHub Actions.

O catálogo está em https://raw.githubusercontent.com/andremjr/plugins-contentflow/main/catalog.json.

## Licenças

Veja [LICENSE](LICENSE) e [LICENSING.md](LICENSING.md). MIT cobre as partes de autoria do mantenedor. Dependências, incluindo FFmpeg e Python, conservam suas licenças e notices. O núcleo ContentFlow mantém sua licença própria.
