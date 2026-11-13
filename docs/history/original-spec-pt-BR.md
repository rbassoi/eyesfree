# Projeto: Módulo de Acessibilidade Óptica Inteligente (Leitura Sem Óculos)

Este documento reúne a especificação técnica, a arquitetura de calibração visual para idosos e pessoas com baixa acuidade visual (miopia, presbiopia e astigmatismo) e o **código-fonte completo de um protótipo interativo funcional**.

---

## 1. Visão Geral da Solução

Muitos usuários idosos ou com desvios refrativos perdem os óculos ou não estão com eles em mãos no momento de usar um aplicativo essencial (banco, saúde, mensagens). Em vez de exigir que o usuário saiba seu grau oftalmológico técnico (ex: `-1.75 ESF / -1.00 CIL Eixo 180°`), o módulo utiliza **Calibração Perceptiva por Escolha Visual**:

1. **Passo 1 — Cancelamento de Sombra Fantasma (Astigmatismo / Coma):**
   * O usuário vê cartões com as mesmas letras (`E A O`), cada um com uma pré-compensação de deslocamento sub-pixel e contra-sombra em ângulos diferentes ($0^\circ$, $45^\circ$, $90^\circ$, $135^\circ$).
   * A pessoa escolhe o cartão onde as letras **não parecem sobrepostas/duplicadas**.
2. **Passo 2 — Deconvolução Óptica e Anti-Crowding (Presbiopia / Miopia):**
   * O usuário escolhe entre 4 níveis de nitidez de borda (*High-Contrast Inverse Blurring* via Matriz de Convolução SVG) combinados com espaçamento anti-aglutinação (*anti-crowding*), evitando que o borrão de uma letra invada a letra vizinha na retina.
3. **Passo 3 — Aplicação Global no App:**
   * A calibração escolhida é salva no `localStorage` (ou estado global do app) e injetada automaticamente no container raiz do aplicativo, ajustando o fundo para `#E6E8EC` (necessário para permitir que os halos claros de deconvolução tenham contraste luminoso real na tela).

---

## 2. Arquitetura Técnica dos Filtros

Para que uma tela comum (LCD/OLED) consiga compensar parcialmente a falta de foco do olho humano, combinamos três técnicas simultâneas:

### A. Matriz de Convolução Laplaciana Modificada (`feConvolveMatrix`)
A função de espalhamento de ponto (*Point Spread Function* - PSF) de um olho sem óculos atua como um filtro passa-baixa (borrão Gaussiano). Para pré-compensar isso na tela antes da luz chegar ao olho, aplicamos um operador inverso de realce de alta frequência:

$$K_{\text{deconv}} = \begin{bmatrix} 0 & -k & 0 \\ -k & 1 + 4k & -k \\ 0 & -k & 0 \end{bmatrix}$$

Onde $k$ varia de $0.4$ (grau leve) a $1.3$ (grau severo). Isso cria uma micro-borda hiper-clara do lado externo da letra e hiper-escura do lado interno, cancelando a transição cinzenta gerada pelo olho desfocado.

### B. Contra-Deslocamento Direcional (Anti-Ghosting para Astigmatismo)
Quando o usuário relata ver **"letras sobrepostas umas às outras"**, há um deslocamento vetorial $(\Delta x, \Delta y)$ causado pela curvatura irregular da córnea. Aplicamos uma camada de cancelamento de fase (halo claro no vetor da sombra fantasma + reforço de borda no vetor oposto):

$$\text{text-shadow}: (-\Delta x)\text{px } (-\Delta y)\text{px } 0\text{px rgba}(0,0,0, \alpha), (\Delta x)\text{px } (\Delta y)\text{px } 0\text{px rgba}(255,255,255, \beta)$$

---

## 3. Código Completo do Protótipo Funcional (`index.html`)

Copie o código abaixo e salve como `index.html`. Ele pode ser aberto diretamente em qualquer navegador no celular ou computador, sem necessidade de instalar dependências externas.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Protótipo: Acessibilidade Óptica Sem Óculos</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --vision-letter-spacing: 0em;
      --vision-word-spacing: 0em;
      --vision-font-weight-boost: 400;
      --vision-text-shadow: none;
      --vision-filter: none;
      --vision-bg-surface: #ffffff;
      --vision-scale: 1;
    }

    /* Classe global aplicada ao App inteiro quando o modo Sem Óculos está ativo */
    .optical-corrected-app {
      filter: var(--vision-filter);
      letter-spacing: var(--vision-letter-spacing) !important;
      word-spacing: var(--vision-word-spacing) !important;
      text-shadow: var(--vision-text-shadow) !important;
    }

    /* Quando o filtro de deconvolução está ativo, reduzimos o branco puro (#FFF -> #E5E7EB)
       para que o filtro SVG possa criar "halos brancos" (#FFF) ao redor das letras pretas */
    .optical-surface-compensation {
      background-color: #E4E7EC !important;
      color: #0F172A !important;
    }

    .optical-surface-compensation .card-surface {
      background-color: #EAECEF !important;
      border-color: #CBD5E1 !important;
    }

    /* Estilos específicos dos cartões de teste de sobreposição (Passo 1) */
    .ghost-option-0 {
      /* Normal sem compensação */
      text-shadow: none;
    }
    .ghost-option-horiz {
      /* Compensa astigmatismo horizontal (Eixo 180°) */
      text-shadow: -1.4px 0px 0px rgba(255,255,255,0.95), 1.2px 0px 0px rgba(0,0,0,0.55);
      filter: url(#svg-astig-horiz);
    }
    .ghost-option-vert {
      /* Compensa astigmatismo vertical (Eixo 90°) */
      text-shadow: 0px -1.4px 0px rgba(255,255,255,0.95), 0px 1.2px 0px rgba(0,0,0,0.55);
      filter: url(#svg-astig-vert);
    }
    .ghost-option-diag1 {
      /* Compensa astigmatismo oblíquo (Eixo 45°) */
      text-shadow: -1.3px -1.3px 0px rgba(255,255,255,0.95), 1.1px 1.1px 0px rgba(0,0,0,0.55);
      filter: url(#svg-astig-diag1);
    }
    .ghost-option-diag2 {
      /* Compensa astigmatismo oblíquo (Eixo 135°) */
      text-shadow: 1.3px -1.3px 0px rgba(255,255,255,0.95), -1.1px 1.1px 0px rgba(0,0,0,0.55);
      filter: url(#svg-astig-diag2);
    }
    .ghost-option-double {
      /* Alto contraste de contorno duplo para sobreposição radial */
      text-shadow: 
        -1.2px -1.2px 0px #FFFFFF,
         1.2px -1.2px 0px #FFFFFF,
        -1.2px  1.2px 0px #FFFFFF,
         1.2px  1.2px 0px #FFFFFF,
         0px    0px   1px rgba(0,0,0,0.8);
    }

    /* Simulador de Visão Desfocada (Para o desenvolvedor testar como o idoso enxerga) */
    .simulate-uncorrected-eye {
      filter: blur(1.45px) contrast(0.92);
    }
  </style>
</head>
<body class="bg-slate-900 min-h-screen flex flex-col items-center justify-start py-6 px-4 font-sans text-slate-900">

  <!-- =========================================================================
       FILTROS SVG ÓPTICOS (MATRIZES DE DECONVOLUÇÃO E EIXO DIRECIONAL)
       Ficam ocultos no DOM e podem ser aplicados em qualquer tela do app
  ========================================================================== -->
  <svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">
    <defs>
      <!-- Nível 1: Compensação Leve (+1.0D / -1.0D) -->
      <filter id="svg-deconv-mild">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
             0   -0.55   0
           -0.55  3.20 -0.55
             0   -0.55   0" />
      </filter>

      <!-- Nível 2: Compensação Moderada (+1.75D / -1.75D) -->
      <filter id="svg-deconv-medium">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
             0   -0.95   0
           -0.95  4.80 -0.95
             0   -0.95   0" />
      </filter>

      <!-- Nível 3: Compensação Forte (+2.50D / -2.50D) -->
      <filter id="svg-deconv-strong">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
            -0.25 -1.15 -0.25
            -1.15  6.60 -1.15
            -0.25 -1.15 -0.25" />
      </filter>

      <!-- Filtros Direcionais para Astigmatismo (Cancelamento de Sombra) -->
      <filter id="svg-astig-horiz">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
             0     0     0
           -1.1   3.2  -1.1
             0     0     0" />
      </filter>

      <filter id="svg-astig-vert">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
             0   -1.1   0
             0    3.2   0
             0   -1.1   0" />
      </filter>

      <filter id="svg-astig-diag1">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
           -1.0   0     0
             0    3.0   0
             0    0   -1.0" />
      </filter>

      <filter id="svg-astig-diag2">
        <feConvolveMatrix order="3 3" preserveAlpha="true"
          kernelMatrix="
             0    0   -1.0
             0    3.0   0
           -1.0   0     0" />
      </filter>
    </defs>
  </svg>

  <!-- Barra de Controle do Desenvolvedor (Topo) -->
  <div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-3.5 mb-4 text-white shadow-lg">
    <div class="flex items-center justify-between gap-2">
      <div>
        <span class="text-xs uppercase tracking-wider font-bold text-amber-400 block">Modo Desenvolvedor</span>
        <p class="text-xs text-slate-300">Simular olho sem óculos (borrão óptico) para testar o efeito:</p>
      </div>
      <button id="btn-toggle-eye-sim" onclick="toggleEyeSimulation()"
        class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 border border-slate-500 transition shrink-0">
        Simular Olho: OFF
      </button>
    </div>
  </div>

  <!-- =========================================================================
       CONTAINER DO CELULAR (SIMULAÇÃO DO APLICATIVO)
  ========================================================================== -->
  <div id="phone-viewport" class="w-full max-w-md rounded-[36px] border-[8px] border-slate-700 shadow-2xl overflow-hidden bg-white transition-colors duration-300">
    
    <!-- Wrapper onde o filtro óptico global é injetado -->
    <div id="app-optical-root" class="min-h-[720px] flex flex-col justify-between bg-white transition-all duration-200">
      
      <!-- Cabeçalho do App -->
      <header class="bg-blue-700 text-white px-5 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 class="text-lg font-bold leading-tight">MeuBanco Sênior</h1>
          <p id="status-badge" class="text-xs text-blue-100 mt-0.5">Visão Padrão (Com Óculos)</p>
        </div>
        <button onclick="openCalibrationModal()" 
          class="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs px-3.5 py-2.5 rounded-xl shadow flex items-center gap-1.5 transition">
          <span>👓</span> Sem Óculos?
        </button>
      </header>

      <!-- CONTEÚDO PRINCIPAL: Alterna entre a Home do App e o Calibrador de Acessibilidade -->
      <main class="flex-1 p-5 overflow-y-auto">

        <!-- ===============================================================
             TELA 1: CALIBRADOR VISUAL DE ACESSIBILIDADE (A SUA IDEIA)
        ================================================================ -->
        <section id="screen-calibration" class="space-y-5">
          <div class="card-surface bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-blue-800">Ajuste de Leitura Sem Óculos</span>
              <span id="step-indicator" class="text-xs font-bold bg-blue-700 text-white px-2.5 py-0.5 rounded-full">Passo 1 de 2</span>
            </div>
            <p id="calibration-instruction" class="text-sm text-slate-800 font-medium leading-snug">
              Tire os óculos, segure o celular na distância normal e <strong>toque no quadro onde as letras parecem MENOS sobrepostas ou duplicadas</strong>:
            </p>
          </div>

          <!-- PASSO 1: ESCOLHA DE DESLOCAMENTO / SOBREPOSIÇÃO (ASTIGMATISMO / FANTASMA) -->
          <div id="step-1-container" class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              
              <!-- Opção A: Padrão -->
              <button onclick="selectGhostOption('none', this)" class="ghost-card card-surface group border-2 border-slate-300 bg- $('#E4E7EC') rounded-2xl p-4 text-center hover:border-blue-600 focus:outline-none transition flex flex-col items-center justify-center bg-[#E4E7EC]">
                <span class="text-xs font-bold text-slate-600 mb-1">Opção 1 (Padrão)</span>
                <div class="ghost-option-0 text-3xl font-extrabold tracking-wide text-slate-900 my-1">E A O</div>
                <span class="text-xs font-semibold text-slate-800">Leitura 48</span>
              </button>

              <!-- Opção B: Deslocamento Horizontal (Eixo 180°) -->
              <button onclick="selectGhostOption('horiz', this)" class="ghost-card card-surface group border-2 border-slate-300 rounded-2xl p-4 text-center hover:border-blue-600 focus:outline-none transition flex flex-col items-center justify-center bg-[#E4E7EC]">
                <span class="text-xs font-bold text-slate-600 mb-1">Opção 2 (Lateral)</span>
                <div class="ghost-option-horiz text-3xl font-extrabold tracking-wide text-slate-900 my-1">E A O</div>
                <span class="ghost-option-horiz text-xs font-semibold text-slate-800">Leitura 48</span>
              </button>

              <!-- Opção C: Deslocamento Vertical (Eixo 90°) -->
              <button onclick="selectGhostOption('vert', this)" class="ghost-card card-surface group border-2 border-slate-300 rounded-2xl p-4 text-center hover:border-blue-600 focus:outline-none transition flex flex-col items-center justify-center bg-[#E4E7EC]">
                <span class="text-xs font-bold text-slate-600 mb-1">Opção 3 (Vertical)</span>
                <div class="ghost-option-vert text-3xl font-extrabold tracking-wide text-slate-900 my-1">E A O</div>
                <span class="ghost-option-vert text-xs font-semibold text-slate-800">Leitura 48</span>
              </button>

              <!-- Opção D: Deslocamento Diagonal 45° -->
              <button onclick="selectGhostOption('diag1', this)" class="ghost-card card-surface group border-2 border-slate-300 rounded-2xl p-4 text-center hover:border-blue-600 focus:outline-none transition flex flex-col items-center justify-center bg-[#E4E7EC]">
                <span class="text-xs font-bold text-slate-600 mb-1">Opção 4 (Diagonal A)</span>
                <div class="ghost-option-diag1 text-3xl font-extrabold tracking-wide text-slate-900 my-1">E A O</div>
                <span class="ghost-option-diag1 text-xs font-semibold text-slate-800">Leitura 48</span>
              </button>

              <!-- Opção E: Deslocamento Diagonal 135° -->
              <button onclick="selectGhostOption('diag2', this)" class="ghost-card card-surface group border-2 border-slate-300 rounded-2xl p-4 text-center hover:border-blue-600 focus:outline-none transition flex flex-col items-center justify-center bg-[#E4E7EC]">
                <span class="text-xs font-bold text-slate-600 mb-1">Opção 5 (Diagonal B)</span>
                <div class="ghost-option-diag2 text-3xl font-extrabold tracking-wide text-slate-900 my-1">E A O</div>
                <span class="ghost-option-diag2 text-xs font-semibold text-slate-800">Leitura 48</span>
              </button>

              <!-- Opção F: Halo Anti-Sobreposição Total -->
              <button onclick="selectGhostOption('double', this)" class="ghost-card card-surface group border-2 border-slate-300 rounded-2xl p-4 text-center hover:border-blue-600 focus:outline-none transition flex flex-col items-center justify-center bg-[#E4E7EC]">
                <span class="text-xs font-bold text-slate-600 mb-1">Opção 6 (Contorno)</span>
                <div class="ghost-option-double text-3xl font-extrabold tracking-wide text-slate-900 my-1">E A O</div>
                <span class="ghost-option-double text-xs font-semibold text-slate-800">Leitura 48</span>
              </button>
            </div>

            <button onclick="goToStep2()" class="w-full py-4 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-base shadow-lg transition">
              Continuar para Nitidez de Grau →
            </button>
          </div>

          <!-- PASSO 2: ESCOLHA DO GRAU DE DECONVOLUÇÃO (MIOPIA / PRESBIOPIA / VISTA CANSADA) -->
          <div id="step-2-container" class="hidden space-y-3">
            <div class="space-y-2.5">
              
              <!-- Grau Leve -->
              <button onclick="selectSharpnessLevel('mild', this)" class="sharp-card w-full border-2 border-slate-300 rounded-2xl p-4 text-left bg-[#E4E7EC] hover:border-blue-600 transition">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-blue-900 uppercase">Nível 1 • Grau Leve (~1.0 a 1.5)</span>
                </div>
                <p style="filter: url(#svg-deconv-mild); letter-spacing: 0.04em;" class="text-lg font-bold text-slate-900">
                  Pagamento de R$ 158,90 confirmado
                </p>
              </button>

              <!-- Grau Moderado -->
              <button onclick="selectSharpnessLevel('medium', this)" class="sharp-card w-full border-2 border-blue-600 ring-2 ring-blue-300 rounded-2xl p-4 text-left bg-[#E4E7EC] hover:border-blue-600 transition">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-blue-900 uppercase">Nível 2 • Grau Médio (~1.75 a 2.25)</span>
                  <span class="text-[11px] bg-blue-700 text-white px-2 py-0.5 rounded-full font-bold">Mais escolhido</span>
                </div>
                <p style="filter: url(#svg-deconv-medium); letter-spacing: 0.07em;" class="text-lg font-bold text-slate-900">
                  Pagamento de R$ 158,90 confirmado
                </p>
              </button>

              <!-- Grau Forte -->
              <button onclick="selectSharpnessLevel('strong', this)" class="sharp-card w-full border-2 border-slate-300 rounded-2xl p-4 text-left bg-[#E4E7EC] hover:border-blue-600 transition">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs font-bold text-blue-900 uppercase">Nível 3 • Grau Forte (+2.50 ou mais)</span>
                </div>
                <p style="filter: url(#svg-deconv-strong); letter-spacing: 0.10em; word-spacing: 0.08em;" class="text-xl font-extrabold text-slate-900">
                  Pagamento de R$ 158,90 confirmado
                </p>
              </button>

            </div>

            <!-- Controle Fino de Distanciamento Anti-Fusão (Evita que as letras grudem na retina) -->
            <div class="card-surface bg-slate-100 border border-slate-300 rounded-2xl p-3.5">
              <label for="slider-crowding" class="block text-xs font-bold text-slate-800 mb-1">
                Separar letras que parecem "grudadas": <span id="crowding-val">Médio</span>
              </label>
              <input id="slider-crowding" type="range" min="0" max="3" value="2" oninput="updateCrowdingPreview(this.value)"
                class="w-full accent-blue-700 h-2 bg-slate-300 rounded-lg cursor-pointer" />
            </div>

            <div class="flex gap-2 pt-1">
              <button onclick="backToStep1()" class="w-1/3 py-3.5 rounded-2xl border-2 border-slate-400 text-slate-800 font-bold text-sm">
                ← Voltar
              </button>
              <button onclick="applyCalibrationToEntireApp()" class="w-2/3 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base shadow-lg">
                Aplicar no Aplicativo ✓
              </button>
            </div>
          </div>
        </section>

        <!-- ===============================================================
             TELA 2: APLICATIVO REAL (PARA VER O EFEITO APLICADO EM TUDO)
        ================================================================ -->
        <section id="screen-app-home" class="hidden space-y-4">
          
          <!-- Banner de Calibração Ativa -->
          <div class="card-surface bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span class="text-xs font-extrabold uppercase text-emerald-900 block">✓ Modo Sem Óculos Ativo</span>
              <p id="active-profile-desc" class="text-xs text-slate-800 font-medium">
                Compensação aplicada em todas as telas.
              </p>
            </div>
            <button onclick="resetToNormalVision()" class="text-xs font-bold underline text-red-700 shrink-0 ml-2">
              Desativar
            </button>
          </div>

          <!-- Cartão de Saldo -->
          <div class="card-surface bg-slate-100 border-2 border-slate-300 rounded-2xl p-4">
            <span class="text-sm font-bold text-slate-700 block">Saldo disponível em conta</span>
            <div class="text-3xl font-extrabold text-slate-950 my-1">R$ 3.482,65</div>
            <p class="text-xs font-semibold text-slate-700">Aposentadoria INSS recebida dia 05/11</p>
          </div>

          <!-- Botões de Ação Rápida -->
          <div class="grid grid-cols-2 gap-3">
            <div class="card-surface border-2 border-slate-300 rounded-2xl p-3.5 bg-slate-50">
              <span class="text-xl block mb-1">📄</span>
              <h3 class="font-extrabold text-base text-slate-900">Pagar Conta</h3>
              <p class="text-xs text-slate-700 font-medium">Luz, água, telefone e boletos</p>
            </div>
            <div class="card-surface border-2 border-slate-300 rounded-2xl p-3.5 bg-slate-50">
              <span class="text-xl block mb-1">💊</span>
              <h3 class="font-extrabold text-base text-slate-900">Receita Médica</h3>
              <p class="text-xs text-slate-700 font-medium">Lembretes de remédios às 14h</p>
            </div>
          </div>

          <!-- Lista de Últimas Movimentações (Ótimo para testar leitura de números pequenos) -->
          <div class="card-surface border-2 border-slate-300 rounded-2xl p-4 bg-slate-50 space-y-3">
            <h2 class="text-base font-extrabold text-slate-900 border-b border-slate-300 pb-2">
              Últimos Comprovantes
            </h2>
            
            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-bold text-slate-900">Farmácia DrogaRaia</p>
                <p class="text-xs text-slate-700 font-medium">12 Nov • Cartão de Débito</p>
              </div>
              <span class="text-sm font-extrabold text-slate-900">- R$ 84,50</span>
            </div>

            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-bold text-slate-900">Supermercado Pão de Açúcar</p>
                <p class="text-xs text-slate-700 font-medium">10 Nov • PIX Enviado</p>
              </div>
              <span class="text-sm font-extrabold text-slate-900">- R$ 216,30</span>
            </div>

            <div class="flex justify-between items-center">
              <div>
                <p class="text-sm font-bold text-slate-900">Companhia de Energia (CEMIG)</p>
                <p class="text-xs text-slate-700 font-medium">08 Nov • Débito Automático</p>
              </div>
              <span class="text-sm font-extrabold text-slate-900">- R$ 142,80</span>
            </div>
          </div>

        </section>

      </main>

      <!-- Barra de Navegação Inferior do App -->
      <footer class="border-t-2 border-slate-200 px-6 py-3 flex justify-around items-center text-xs font-bold text-slate-700 bg-slate-50">
        <button onclick="showHomeScreen()" class="flex flex-col items-center gap-0.5 text-blue-800">
          <span>🏠</span>
          <span>Início</span>
        </button>
        <button onclick="openCalibrationModal()" class="flex flex-col items-center gap-0.5">
          <span>👁️</span>
          <span>Ajustar Vista</span>
        </button>
        <button class="flex flex-col items-center gap-0.5">
          <span>📞</span>
          <span>Ajuda</span>
        </button>
      </footer>

    </div>
  </div>

  <!-- =========================================================================
       LÓGICA JAVASCRIPT DE CALIBRAÇÃO E PERSISTÊNCIA DO PERFIL VISUAL
  ========================================================================== -->
  <script>
    // Estado da calibração do usuário
    const visionState = {
      ghostAxis: 'horiz',      // 'none', 'horiz', 'vert', 'diag1', 'diag2', 'double'
      sharpnessLevel: 'medium', // 'mild', 'medium', 'strong'
      crowdingLevel: 2,        // 0 a 3
      simulatingEyeBlur: false
    };

    // Mapas de configuração óptica baseados na escolha visual do usuário
    const GHOST_SHADOW_MAP = {
      none: 'none',
      horiz: '-1.3px 0px 0px rgba(255,255,255,0.95), 1.1px 0px 0px rgba(0,0,0,0.45)',
      vert: '0px -1.3px 0px rgba(255,255,255,0.95), 0px 1.1px 0px rgba(0,0,0,0.45)',
      diag1: '-1.2px -1.2px 0px rgba(255,255,255,0.95), 1.0px 1.0px 0px rgba(0,0,0,0.45)',
      diag2: '1.2px -1.2px 0px rgba(255,255,255,0.95), -1.0px 1.0px 0px rgba(0,0,0,0.45)',
      double: '-1.1px -1.1px 0px #FFFFFF, 1.1px -1.1px 0px #FFFFFF, -1.1px 1.1px 0px #FFFFFF, 1.1px 1.1px 0px #FFFFFF'
    };

    const SHARPNESS_FILTER_MAP = {
      mild: 'url(#svg-deconv-mild)',
      medium: 'url(#svg-deconv-medium)',
      strong: 'url(#svg-deconv-strong)'
    };

    const CROWDING_SPACING_MAP = [
      { letter: '0.01em', word: '0.02em', label: 'Padrão' },
      { letter: '0.04em', word: '0.05em', label: 'Suave' },
      { letter: '0.065em', word: '0.08em', label: 'Médio' },
      { letter: '0.095em', word: '0.12em', label: 'Amplo' }
    ];

    function selectGhostOption(axis, btnElement) {
      visionState.ghostAxis = axis;
      document.querySelectorAll('.ghost-card').forEach(btn => {
        btn.classList.remove('border-blue-600', 'ring-2', 'ring-blue-400');
        btn.classList.add('border-slate-300');
      });
      btnElement.classList.remove('border-slate-300');
      btnElement.classList.add('border-blue-600', 'ring-2', 'ring-blue-400');
    }

    function selectSharpnessLevel(level, btnElement) {
      visionState.sharpnessLevel = level;
      document.querySelectorAll('.sharp-card').forEach(btn => {
        btn.classList.remove('border-blue-600', 'ring-2', 'ring-blue-300');
        btn.classList.add('border-slate-300');
      });
      btnElement.classList.remove('border-slate-300');
      btnElement.classList.add('border-blue-600', 'ring-2', 'ring-blue-300');
    }

    function updateCrowdingPreview(val) {
      const idx = parseInt(val, 10);
      visionState.crowdingLevel = idx;
      document.getElementById('crowding-val').textContent = CROWDING_SPACING_MAP[idx].label;
    }

    function goToStep2() {
      document.getElementById('step-1-container').classList.add('hidden');
      document.getElementById('step-2-container').classList.remove('hidden');
      document.getElementById('step-indicator').textContent = 'Passo 2 de 2';
      document.getElementById('calibration-instruction').innerHTML =
        'Agora escolha a frase onde os <strong>números e letras estão mais fáceis de ler</strong> sem precisar apertar os olhos:';
    }

    function backToStep1() {
      document.getElementById('step-2-container').classList.add('hidden');
      document.getElementById('step-1-container').classList.remove('hidden');
      document.getElementById('step-indicator').textContent = 'Passo 1 de 2';
      document.getElementById('calibration-instruction').innerHTML =
        'Tire os óculos, segure o celular na distância normal e <strong>toque no quadro onde as letras parecem MENOS sobrepostas ou duplicadas</strong>:';
    }

    function applyCalibrationToEntireApp() {
      const root = document.documentElement;
      const appContainer = document.getElementById('app-optical-root');
      const spacing = CROWDING_SPACING_MAP[visionState.crowdingLevel];

      // Define as variáveis CSS globais que afetam todo o aplicativo
      root.style.setProperty('--vision-text-shadow', GHOST_SHADOW_MAP[visionState.ghostAxis]);
      root.style.setProperty('--vision-filter', SHARPNESS_FILTER_MAP[visionState.sharpnessLevel]);
      root.style.setProperty('--vision-letter-spacing', spacing.letter);
      root.style.setProperty('--vision-word-spacing', spacing.word);

      // Aplica as classes de compensação óptica no container raiz do App
      appContainer.classList.add('optical-corrected-app', 'optical-surface-compensation');

      // Atualiza os indicadores visuais
      document.getElementById('status-badge').textContent = 'Modo Sem Óculos: ATIVO';
      document.getElementById('active-profile-desc').textContent =
        `Eixo: ${visionState.ghostAxis.toUpperCase()} • Nitidez: ${visionState.sharpnessLevel.toUpperCase()} • Espaço: ${spacing.label}`;

      // Salva no localStorage para o idoso não precisar calibrar toda vez que abrir o app
      localStorage.setItem('user_optical_profile', JSON.stringify(visionState));

      showHomeScreen();
    }

    function resetToNormalVision() {
      const appContainer = document.getElementById('app-optical-root');
      appContainer.classList.remove('optical-corrected-app', 'optical-surface-compensation');
      document.getElementById('status-badge').textContent = 'Visão Padrão (Com Óculos)';
      localStorage.removeItem('user_optical_profile');
    }

    function openCalibrationModal() {
      document.getElementById('screen-app-home').classList.add('hidden');
      document.getElementById('screen-calibration').classList.remove('hidden');
      backToStep1();
    }

    function showHomeScreen() {
      document.getElementById('screen-calibration').classList.add('hidden');
      document.getElementById('screen-app-home').classList.remove('hidden');
    }

    // Função para o desenvolvedor simular como uma pessoa com presbiopia/miopia enxerga a tela
    function toggleEyeSimulation() {
      const viewport = document.getElementById('phone-viewport');
      const btn = document.getElementById('btn-toggle-eye-sim');
      visionState.simulatingEyeBlur = !visionState.simulatingEyeBlur;

      if (visionState.simulatingEyeBlur) {
        viewport.classList.add('simulate-uncorrected-eye');
        btn.textContent = 'Simular Olho: ON (Desfocado)';
        btn.classList.replace('bg-slate-700', 'bg-amber-500');
        btn.classList.add('text-slate-950');
      } else {
        viewport.classList.remove('simulate-uncorrected-eye');
        btn.textContent = 'Simular Olho: OFF';
        btn.classList.replace('bg-amber-500', 'bg-slate-700');
        btn.classList.remove('text-slate-950');
      }
    }
  </script>
</body>
</html>
```

---

## 4. Como Integrar no Seu Aplicativo Atual

Dependendo da tecnologia que você já utiliza no seu aplicativo, a integração segue a mesma lógica do protótipo acima:

1. **Se o seu App for Web / PWA / Capacitor / Ionic / React:**
   * Basta colocar o bloco `<svg>` com os `<feConvolveMatrix>` no `index.html` raiz e aplicar a classe `.optical-corrected-app` na `<div id="root">`.
2. **Se o seu App for React Native:**
   * Crie um `VisionAccessibilityContext` que envolve a árvore de rotas.
   * Use `@shopify/react-native-skia` (que suporta `RuntimeShader` e matrizes de convolução na GPU em 60fps) ou crie um componente base `<AccessibleText>` que aplica o `textShadowOffset`, `textShadowColor` e `letterSpacing` salvos no `AsyncStorage`.
3. **Se o seu App for Flutter:**
   * Envolva o `MaterialApp` com um widget `BackdropFilter` ou `ImageFiltered` utilizando `ImageFilter.matrix()` ou um `FragmentShader` GLSL customizado com a matriz Laplaciana $3 \times 3$.