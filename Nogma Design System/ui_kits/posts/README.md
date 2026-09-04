# Modelo Nogma — Design System de arte

Este é o **modelo oficial** da Nogma para **posts (carrossel/feed/stories), site e apresentações**.
Foi consolidado a partir do carrossel de referência **`posts/diagnostico/`** (slides 01–07) —
esse post é o **modelo vivo**: quando tiver dúvida de como algo fica, olhe lá.

> Regra de ouro: **preto + lime, dark-tech, tipografia Agency/Raleway, e o "nó" (intersecção) como motivo.**

---

## 1. Arquivos

```
design-system/
├── styles.css          # entrada dos TOKENS (importa tokens/*). Linke SEMPRE primeiro.
├── system.css          # ★ SISTEMA de arte (todos os componentes). Linke depois de styles.css.
├── MODELO-NOGMA.md     # este guia
├── tokens/             # colors, typography, spacing, fonts, base
├── assets/
│   ├── fonts/          # Agency + Raleway
│   ├── logo-nogma-lime.png
│   ├── isotype-n-lime-glow.svg   # o "n" (nó) com glow, pra usar grande
│   └── intersecoes/    # 8,9,10,11.png — os traços do "nó" (fundo transparente)
├── posts/
│   ├── _template.html  # esqueleto pra começar post novo
│   └── diagnostico/    # POST DE REFERÊNCIA (01–07) + _sys.css + preview.html + serve.py
```

Todo post/página linka os dois, nesta ordem:
```html
<link rel="stylesheet" href="styles.css">   <!-- tokens -->
<link rel="stylesheet" href="system.css">    <!-- componentes -->
<body class="on-black"> … </body>
```

---

## 2. Fundamentos visuais

**Cor**
- **Base PRETA `#0A0B0C`** em toda arte externa (o design system é `.on-black`).
- **Acento LIME `#CCFF00`** (`--lime-500`) — energia, destaques, 1 frase-chave por bloco.
- Texto: **branco** (títulos/ênfase) e **cinza** (`--ink-2`, corpo secundário).
- **TEAL `#3FB7C9` é cor de SISTEMA INTERNO (produto), NÃO da arte.** Não usar como fundo nem como acento nos posts. "Médio/baixo" em medidores e tags = **cinza**, nunca teal.

**Tipografia**
- **Agency** → display, numerais, eyebrows (CAIXA-ALTA), rótulos. `--font-display`.
- **Raleway** → títulos (ExtraBold) e corpo. `--heading-family` / `--font-sans`.
- **Mono** (sistema) → contadores, chips de telemetria, metadados. `--font-mono`.
- Muito respiro (whitespace) é assinatura da marca.

---

## 3. Fundo "dark-tech"

Cada slide combina camadas dentro de `<div class="bg"> … </div>`:
- **`.grid`** (blueprint) **OU `.dots`** (constelação) — **varie entre slides** pra não ficar tudo o mesmo quadriculado.
- **`.glow-lime` + `.glow-teal`** (ambos lime; "teal" é só o nome da classe) — **mude a posição** por slide.
- **`.stroke`** = a intersecção (ver §4).

---

## 4. Intersecção — o "nó" (motivo recorrente)

Os traços lime em `assets/intersecoes/` (PNG transparente) são o motivo de marca. Regras:

1. **As pontas ficam SEMPRE fora do quadro.** Nada de término/gancho aparecendo dentro do slide — se aparecer, **amplie** o traço até a ponta sair. (Foi assim que fechamos capa/CTA.)
2. **Como textura de fundo:** opacidade baixa **(~.14–.28)**, atrás do conteúdo (`z-index:0`).
3. **Emenda entre dois slides** (continuidade ao deslizar): use o **mesmo `width` e `top`** nos dois; no slide da **direita**, `left = left(esquerda) − 1080`. Assim metade do traço fica num slide, metade no outro, e o corte bate no pixel da virada. (Ex.: capa→2 e 6→7.)
4. Varie o elemento (8/9/10/11) entre slides vizinhos pra não repetir.

Marcação:
```html
<div class="bg">
  <div class="grid"></div>
  <div class="glow-lime"></div><div class="glow-teal"></div>
  <img class="stroke" src="../assets/intersecoes/9.png" alt="">
</div>
```
```css
/* fundo (pontas fora) */            .bg .stroke{width:1180px; top:-320px; right:-240px; opacity:.15;}
/* emenda: slide esq */              .bg .stroke{width:1640px; top:-260px; left:457px;  opacity:.3;}
/* emenda: slide dir (mesmo w/top) */.bg .stroke{width:1640px; top:-260px; left:-623px; opacity:.3;}
```

---

## 5. Componentes (classes em `system.css`)

- **Topo** `.top`: `.wordmark` (logo grande, 88px) à esquerda + `.counter` ("0X / 0N") **ou** `.live` (chip com `.pulse`) à direita.
- **Eyebrow** `.eyebrow` (`.sq` = quadrado lime; senão traço): Agency caixa-alta, lime.
- **Headline** `.h1` (Raleway ExtraBold) + destaque `.lm` (lime).
- **Corpo** `.sub` (cinza; `<b>` = branco, `.lm` = lime).
- **Rodapé** `.foot`: `.site` (nogma.br) à esquerda + `.drag` (**seta grande →**) à direita. No último slide, só `.handle` (@nogma.br) à direita.
- **Card bento** `.card` / `.card--accent` (topo lime). **Numeral fantasma** `.ghost`.
- **Chip de telemetria** `.chip` / `.tele` (mono).
- **Medidor** `.amb` (alto·médio·baixo): **alto = lime**, resto cinza.
- **Linha de painel** `.row` (ícone + nome + meta + tag) e **tag** `.pc` (`.hi` lime, `.mid`/`.lo` cinza).
- **Faixa horizontal** `.band` (padrão "os 3 ângulos"): borda-esq lime + **número gigante de leve atrás** à direita (centralizado no **eixo do dígito**, com `+30px` compensando o descendente da Agency).
- **Matriz 2×2** (impacto × esforço): 4 quadrantes nomeados, canto vencedor lime + ponto no extremo. (Ver slide 04.)
- **Card de CTA lime** `.cta` (o "comenta X"): fundo lime, texto petróleo, palavra-chave em caixa escura + botão-seta. (Ver slide 07.)

---

## 6. Regras de copy

- **Sem hífen/travessão nas frases** → use **vírgula** (ex.: "morre na escolha, não na execução").
- **Sem estatística inventada.** Se citar estudo, base honesta e sem instituição falsa ("estudos com centenas de implementações").
- **Poucos exemplos concretos** — não colocar cenário inventado em todos os quadros.
- Uma ideia por slide; **um destaque lime por bloco**.
- Números/valores ilustrativos, quando usados, marcados como **exemplo**.

---

## 7. Layout & formato

- **Feed post: 1080×1350**, `padding:72px`. **Story/Reels: 1080×1920** → `.slide{height:1920px}` no post.
- Renderiza **@2x** (2160×2700) pra ficar nítido.
- **Centralizado** (capa, afirmações) vs **alinhado à esquerda** (painéis/dados).
- Contadores "0X / 0N" (o deck de referência tem 7).

---

## 8. Render & preview

**Render @2x (headless Chrome):**
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --no-sandbox --allow-file-access-from-files \
  --force-device-scale-factor=2 --window-size=1080,1350 --default-background-color=00000000 \
  --screenshot="out/slide.png" "file://…/slide.html"
```

**Viewer ao vivo** (iframes, sem gerar PNG a cada mudança): `serve.py` sobe servidor com cache
desligado em `design-system/` → abrir `http://localhost:8765/posts/<deck>/preview.html`.
`preview.html` tem modo **emenda** (slides encostados, pra ver a intersecção atravessar) e **separado**.
```
cd design-system && python3 serve.py    # (rodar em background)
```

---

## 9. Começar um post novo

1. Copie `posts/_template.html` (ajuste `../` → `../../` se o post ficar numa subpasta).
2. Um arquivo HTML por slide (`01-….html`, `02-….html`…), linkando `styles.css` + `system.css`.
3. Monte o `preview.html` (copie o do diagnóstico, atualize a lista de slides).
4. Varie fundo/glow/intersecção entre slides; siga as regras de copy (§6).
5. Renderize @2x pra `out/`.

---

## 10. Site & apresentações

Mesma linguagem: **preto `#0A0B0C` + lime**, tipografia **Agency/Raleway**, camada **dark-tech**
(grid/dots + glows), e o **"nó" (intersecção)** como motivo com pontas fora do quadro. Reaproveite
os **tokens** (`styles.css`) e os **componentes** (`system.css`) num container próprio (não precisa ser
`.slide` 1080×1350). **Teal** só aparece dentro de UI de **produto/sistema interno**, nunca na arte de marca.
```
```
Related: `posts/diagnostico/` (modelo vivo) · tokens em `tokens/*`.
