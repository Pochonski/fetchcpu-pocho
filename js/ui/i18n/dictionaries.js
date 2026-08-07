// Translation dictionaries for the LMC Simulator.
//
// Keys use dot-notation (e.g. "cpu.registers.pc"). Nested objects are
// flattened when looked up. Interpolation uses {0}, {1}, ... placeholders.

export const en = {
  app: {
    name: "Pocho LMC",
    tagline: "A simulator built by Pocho",
    eyebrow: "Little Man Computer",
    tutorial: "Tutorial",
    reference: "Reference",
    about: "About",
    theme: "Toggle theme",
    sound: "Sound",
    share: "Copy share URL",
    shareCopied: "Copied!",
    shareFailed: "Copy failed",
  },

  panels: {
    editor: {
      title: "Program · Assembly",
      blurbEyebrow: "About this example",
      expectedEyebrow: "Expected output",
      examples: "Examples",
      load: "Load",
      run: "Run",
      loadExample: "Load example",
      tryExample: "▶ Try example",
      import: "Import…",
      clear: "Clear",
      choose: "Choose example program",
      runningUntitled: "Untitled program",
    },
    cpu: {
      title: "CPU · State",
      reset: "Reset",
      now: "NOW",
      next: "NEXT",
      busWrite: "CPU writes to RAM",
      busRead: "CPU reads from RAM",
      rewind: "Step backward",
      step: "Step",
      pauseRun: "Run/Pause",
      fastForward: "Run to halt",
      clock: "Clock",
      slower: "Slower",
      faster: "Faster",
      inputLabel: "Input · stdin",
      inputPlaceholder: "One numeric value per line",
      outputLabel: "Output · stdout",
      flagsLabel: "FLAGS",
      flagZ: "Zero",
      flagN: "Negative",
      flagP: "Positive",
      phaseFetch: "Fetch",
      phaseDecode: "Decode",
      phaseExecute: "Execute",
      registers: { pc: "PC", cir: "CIR", mar: "MAR", mdr: "MDR", acc: "ACC", flags: "FLAGS" },
    },
    ram: {
      title: "RAM · 100 mailboxes",
      legend: { pc: "PC", mar: "MAR", code: "Code", data: "Data" },
    },
    log: {
      title: "Activity",
      clear: "Clear",
      export: "Export .lmc",
      historyBtn: "History",
      tabs: {
        live: "Live feed",
        history: "History",
        stats: "Stats",
        log: "Log file",
      },
      logFileToggle: "Capture to log file",
      downloadLog: "Download .txt",
      historyTitle: "Execution history",
    },
  },

  access: {
    label: "Last access",
    read: "READ",
    write: "WRITE",
    none: "—",
    phases: { fetch: "fetch", decode: "decode", execute: "execute", idle: "idle" },
  },

  blurb: {
    expected: "Expected output",
  },

  log: {
    loaded: "Loaded program with {0} instructions.",
    halted: "Program halted at PC={0}.",
    parseError: "Line {0}: {1}",
    outOfMemory: "Out of memory cells for immediate on line {0}",
    errorPrefix: "ERROR: {0}",
    stepDescription: "Cycle {0} | {1} | PC={2} MAR={3} MDR={4} CIR={5} ACC={6}",
  },

  stats: {
    title: "Statistics",
    reset: "Reset stats",
    cycles: "Cycles",
    instructions: "Instructions",
    branches: "Branches",
    reads: "Reads",
    writes: "Writes",
    runtime: "Runtime",
    opcodes: {
      LDA: "Load",
      STA: "Store",
      ADD: "Add",
      SUB: "Subtract",
      INP: "Input",
      OUT: "Output",
      BRP: "Branch+",
      BRZ: "Branch=0",
      BRA: "Branch",
      HLT: "Halt",
    },
  },

  history: {
    headers: { cycle: "cycle", pc: "PC", acc: "ACC", view: "Click to view" },
    placeholder: "No executions yet. Run a program to populate the history.",
  },

  modal: {
    close: "Close",
    instructions: {
      title: "LMC Instruction Set",
      intro: 'In the following table <code>xx</code> refers to a memory address (00–99) in the RAM.',
      th: { mnemonic: "Mnemonic", desc: "Description", code: "Op Code" },
      instructions: [
        ["INP",   "Read input to accumulator",          "901"],
        ["OUT",   "Output the accumulator",             "902"],
        ["LDA",   "Load ACC from address",              "5xx"],
        ["STA",   "Store ACC to address",               "3xx"],
        ["ADD",   "Add contents of address to ACC",     "1xx"],
        ["SUB",   "Subtract contents of address from ACC","2xx"],
        ["BRP",   "Branch if ACC is positive or zero",  "8xx"],
        ["BRZ",   "Branch if ACC is zero",              "7xx"],
        ["BRA",   "Branch always",                      "6xx"],
        ["HLT",   "Halt",                               "000"],
        ["DAT",   "Data declaration (optional initial value)", "—"],
        ["LDA #n", "Load literal value (immediate)",     "5nn"],
        ["LDA @a", "Indirect load via pointer in <code>a</code>", "5xx"],
      ],
    },
    about: {
      title: "About this LMC Simulator",
      paragraphs: [
        "The Little Man Computer was created by <strong>Dr. Stuart Madnick</strong> in 1965 as a teaching aid for the basic Von Neumann architecture. LMC is generally used for educational purposes as it models a simple Von Neumann architecture computer which has all of the basic features of a modern computer.",
      ],
      paragraph2: "You can read more about the Little Man Computer on its <a href=\"https://en.wikipedia.org/wiki/Little_man_computer\" target=\"_blank\" rel=\"noreferrer\">Wikipedia entry</a> and about the original 101computing.net simulator <a href=\"https://www.101computing.net/lmc-simulator/\" target=\"_blank\" rel=\"noreferrer\">here</a>.",
      paragraph3: "This is an independent, extended version built with vanilla ES modules. Three-digit values are represented in <strong>nine's complement</strong> so subtraction works correctly with values from <code>-499</code> to <code>+500</code>.",
      shortcuts: "Keyboard shortcuts: {shortcuts}.",
      credits: '© <a href="https://www.101computing.net" target="_blank" rel="noreferrer">101Computing.net</a> · <a href="https://en.wikipedia.org/wiki/Little_man_computer" target="_blank" rel="noreferrer">Wikipedia</a>.',
    },
    tutorial: {
      title: "Quick tutorial",
      steps: [
        "<strong>Pick an example</strong> from the dropdown above the editor.",
        "Type <code>3</code> and <code>4</code> in the input box if the program expects values.",
        "Click <strong>Load</strong> to assemble the program into RAM.",
        "Tap <strong>F9</strong> (or the step button) repeatedly to walk the FDE cycle.",
        "Watch the <em>CIR</em>, <em>MAR</em> and <em>MDR</em> registers. The highlighted RAM cell tells you which instruction is being executed.",
        "<strong>F5</strong> runs hands-off; the speed slider controls the clock.",
        "Click in the line-number gutter to set a <strong>breakpoint</strong>.",
        "<strong>F8</strong> steps backward through history — useful for debugging.",
      ],
    },
  },

  footer: {
    text: "Built for the Von Neumann architecture · press {keys}.",
    keys: {
      run: "run",
      pause: "pause",
      step: "step",
      back: "back",
      save: "save log",
    },
  },

  shortcutFormat: {
    f5: "F5",
    f6: "F6",
    f9: "F9",
    f8: "F8",
    ctrlS: "Ctrl+S",
  },

  // Example programs. Keys are referenced from programs/examples.js.
  examples: {
    "1":  { label: "Adding 2 inputs",        blurb: "Classic starter — read two numbers from input and print their sum.", expected: "7" },
    "2":  { label: "Max of 2 inputs",        blurb: "Compare two numbers with SUB + BRP and print the larger one.", expected: "12" },
    "3":  { label: "Count down timer",       blurb: "Loop that outputs the input value and counts down to zero.", expected: "5, 4, 3, 2, 1, 0" },
    "4":  { label: "Multiplying 2 inputs",    blurb: "Repeated addition — multiply without a MUL instruction.", expected: "20" },
    "5":  { label: "Triangular Numbers",     blurb: "Print the sequence 1, 3, 6, 10, … (n(n+1)/2) until 10.", expected: "1, 3, 6, 10, 15, 21, 28, 36, 45" },
    "6":  { label: "Factorial of...",        blurb: "Compute n! with nested loops. Try 5 → 120.", expected: "120" },
    "7":  { label: "Immediate Addressing",   blurb: "Add a literal to the accumulator with the # prefix.", expected: "10" },
    "8":  { label: "Indirect Addressing",    blurb: "Walk memory through a pointer using the @ prefix.", expected: "ends after a few cycles" },
    "9":  { label: "Print 0..9",             blurb: "Print the numbers 0 through 9 with a counter and ADD #1.", expected: "0..9" },
    "10": { label: "Sum 1..N",               blurb: "Sum the integers from 1 to N using a countdown loop.", expected: "55" },
    "11": { label: "Print 0..N (loop)",      blurb: "Print every integer from 0 up to N using a SUB-based guard.", expected: "0..5" },
    "12": { label: "Absolute value",         blurb: "If the input is negative, negate it using SUB; otherwise pass it through.", expected: "8" },
  },

  search: {
    placeholder: "Search examples…",
  },
};

export const es = {
  app: {
    name: "Pocho LMC",
    tagline: "Un simulador hecho por Pocho",
    eyebrow: "Little Man Computer",
    tutorial: "Tutorial",
    reference: "Referencia",
    about: "Acerca de",
    theme: "Cambiar tema",
    sound: "Sonido",
    share: "Copiar enlace para compartir",
    shareCopied: "¡Copiado!",
    shareFailed: "No se pudo copiar",
  },

  panels: {
    editor: {
      title: "Programa · Ensamblador",
      blurbEyebrow: "Sobre este ejemplo",
      expectedEyebrow: "Salida esperada",
      examples: "Ejemplos",
      load: "Cargar",
      run: "Ejecutar",
      loadExample: "Cargar ejemplo",
      tryExample: "▶ Probar ejemplo",
      import: "Importar…",
      clear: "Limpiar",
      choose: "Elegir programa de ejemplo",
      runningUntitled: "Programa sin título",
    },
    cpu: {
      title: "CPU · Estado",
      reset: "Reiniciar",
      now: "AHORA",
      next: "SIGUIENTE",
      busWrite: "CPU escribe a RAM",
      busRead: "CPU lee de RAM",
      rewind: "Paso atrás",
      step: "Paso",
      pauseRun: "Ejecutar/Pausa",
      fastForward: "Ejecutar hasta HLT",
      clock: "Reloj",
      slower: "Más lento",
      faster: "Más rápido",
      inputLabel: "Entrada · stdin",
      inputPlaceholder: "Un valor numérico por línea",
      outputLabel: "Salida · stdout",
      flagsLabel: "BANDERAS",
      flagZ: "Cero",
      flagN: "Negativo",
      flagP: "Positivo",
      phaseFetch: "Búsqueda",
      phaseDecode: "Decodificación",
      phaseExecute: "Ejecución",
      registers: { pc: "PC", cir: "CIR", mar: "MAR", mdr: "MDR", acc: "ACC", flags: "FLAGS" },
    },
    ram: {
      title: "RAM · 100 casillas",
      legend: { pc: "PC", mar: "MAR", code: "Código", data: "Datos" },
    },
    log: {
      title: "Actividad",
      clear: "Limpiar",
      export: "Exportar .lmc",
      historyBtn: "Historial",
      tabs: {
        live: "En vivo",
        history: "Historial",
        stats: "Estadísticas",
        log: "Archivo de log",
      },
      logFileToggle: "Capturar a archivo",
      downloadLog: "Descargar .txt",
      historyTitle: "Historial de ejecución",
    },
  },

  access: {
    label: "Último acceso",
    read: "LECTURA",
    write: "ESCRITURA",
    none: "—",
    phases: { fetch: "búsqueda", decode: "decodif.", execute: "ejecución", idle: "inactivo" },
  },

  blurb: {
    expected: "Salida esperada",
  },

  log: {
    loaded: "Programa cargado con {0} instrucciones.",
    halted: "Programa detenido en PC={0}.",
    parseError: "Línea {0}: {1}",
    outOfMemory: "Sin memoria para inmediato en la línea {0}",
    errorPrefix: "ERROR: {0}",
    stepDescription: "Ciclo {0} | {1} | PC={2} MAR={3} MDR={4} CIR={5} ACC={6}",
  },

  stats: {
    title: "Estadísticas",
    reset: "Reiniciar",
    cycles: "Ciclos",
    instructions: "Instrucciones",
    branches: "Saltos",
    reads: "Lecturas",
    writes: "Escrituras",
    runtime: "Tiempo",
    opcodes: {
      LDA: "Cargar",
      STA: "Almacenar",
      ADD: "Sumar",
      SUB: "Restar",
      INP: "Entrada",
      OUT: "Salida",
      BRP: "Salto+",
      BRZ: "Salto=0",
      BRA: "Salto",
      HLT: "Detener",
    },
  },

  history: {
    headers: { cycle: "ciclo", pc: "PC", acc: "ACC", view: "Click para ver" },
    placeholder: "Sin ejecuciones. Ejecute un programa para llenar el historial.",
  },

  modal: {
    close: "Cerrar",
    instructions: {
      title: "Set de instrucciones LMC",
      intro: 'En la tabla siguiente <code>xx</code> representa una dirección de memoria (00–99) en la RAM.',
      th: { mnemonic: "Mnemónico", desc: "Descripción", code: "Op Code" },
      instructions: [
        ["INP",   "Lee entrada al acumulador",           "901"],
        ["OUT",   "Escribe el acumulador",                "902"],
        ["LDA",   "Carga ACC desde la dirección",         "5xx"],
        ["STA",   "Almacena ACC en la dirección",         "3xx"],
        ["ADD",   "Suma el contenido de la dirección a ACC","1xx"],
        ["SUB",   "Resta el contenido de la dirección a ACC","2xx"],
        ["BRP",   "Salta si ACC es positivo o cero",       "8xx"],
        ["BRZ",   "Salta si ACC es cero",                  "7xx"],
        ["BRA",   "Salta siempre",                          "6xx"],
        ["HLT",   "Detener",                                "000"],
        ["DAT",   "Declaración de datos (valor inicial opcional)", "—"],
        ["LDA #n", "Carga literal (inmediato)",              "5nn"],
        ["LDA @a", "Carga indirecta vía puntero en <code>a</code>","5xx"],
      ],
    },
    about: {
      title: "Acerca de este simulador LMC",
      paragraphs: [
        "La Little Man Computer fue creada por <strong>Dr. Stuart Madnick</strong> en 1965 como apoyo didáctico para la arquitectura Von Neumann. El LMC se usa generalmente con fines educativos porque modela una computadora sencilla con todas las características básicas de una moderna.",
      ],
      paragraph2: "Puedes leer más sobre la Little Man Computer en su <a href=\"https://es.wikipedia.org/wiki/Little_man_computer\" target=\"_blank\" rel=\"noreferrer\">entrada de Wikipedia</a> y sobre el simulador original de 101computing.net <a href=\"https://www.101computing.net/lmc-simulator/\" target=\"_blank\" rel=\"noreferrer\">aquí</a>.",
      paragraph3: "Esta es una versión independiente y extendida construida con módulos ES nativos. Los valores de tres dígitos se representan en <strong>complemento a 9</strong> para que la resta funcione correctamente con valores entre <code>-499</code> y <code>+500</code>.",
      shortcuts: "Atajos de teclado: {shortcuts}.",
      credits: '© <a href="https://www.101computing.net" target="_blank" rel="noreferrer">101Computing.net</a> · <a href="https://es.wikipedia.org/wiki/Little_man_computer" target="_blank" rel="noreferrer">Wikipedia</a>.',
    },
    tutorial: {
      title: "Tutorial rápido",
      steps: [
        "<strong>Elige un ejemplo</strong> del desplegable arriba del editor.",
        "Escribe <code>3</code> y <code>4</code> en la caja de entrada si el programa lo requiere.",
        "Haz click en <strong>Cargar</strong> para ensamblar el programa en RAM.",
        "Pulsa <strong>F9</strong> (o el botón de paso) repetidamente para recorrer el ciclo FDE.",
        "Observa los registros <em>CIR</em>, <em>MAR</em> y <em>MDR</em>. La celda de RAM resaltada indica la instrucción en ejecución.",
        "<strong>F5</strong> corre en automático; el slider controla el reloj.",
        "Click en la gutter de números de línea para fijar un <strong>breakpoint</strong>.",
        "<strong>F8</strong> retrocede paso a paso a través del historial.",
      ],
    },
  },

  footer: {
    text: "Hecho para la arquitectura Von Neumann · pulsa {keys}.",
    keys: {
      run: "ejecutar",
      pause: "pausar",
      step: "paso",
      back: "atrás",
      save: "guardar log",
    },
  },

  shortcutFormat: {
    f5: "F5",
    f6: "F6",
    f9: "F9",
    f8: "F8",
    ctrlS: "Ctrl+S",
  },

  examples: {
    "1":  { label: "Sumar 2 entradas",       blurb: "Clásico — lee dos números de la entrada e imprime su suma.", expected: "7" },
    "2":  { label: "Máximo de 2 entradas",   blurb: "Compara dos números con SUB + BRP e imprime el mayor.", expected: "12" },
    "3":  { label: "Cuenta regresiva",       blurb: "Bucle que muestra el valor de entrada y cuenta hasta cero.", expected: "5, 4, 3, 2, 1, 0" },
    "4":  { label: "Multiplicar 2 entradas", blurb: "Suma repetida — multiplicar sin instrucción MUL.", expected: "20" },
    "5":  { label: "Números triangulares",   blurb: "Imprime la secuencia 1, 3, 6, 10, … (n(n+1)/2) hasta 10.", expected: "1, 3, 6, 10, 15, 21, 28, 36, 45" },
    "6":  { label: "Factorial de...",        blurb: "Calcula n! con bucles anidados. Prueba 5 → 120.", expected: "120" },
    "7":  { label: "Direccionamiento inmediato", blurb: "Suma un literal al acumulador con el prefijo #.", expected: "10" },
    "8":  { label: "Direccionamiento indirecto", blurb: "Recorre la memoria a través de un puntero con el prefijo @.", expected: "termina tras algunos ciclos" },
    "9":  { label: "Imprimir 0..9",          blurb: "Imprime los números 0 a 9 con un contador y ADD #1.", expected: "0..9" },
    "10": { label: "Sumar 1..N",             blurb: "Suma los enteros del 1 al N con un bucle descendente.", expected: "55" },
    "11": { label: "Imprimir 0..N (bucle)",  blurb: "Imprime cada entero de 0 a N usando una guarda con SUB.", expected: "0..5" },
    "12": { label: "Valor absoluto",         blurb: "Si la entrada es negativa, la niega con SUB; si no, la pasa tal cual.", expected: "8" },
  },

  search: {
    placeholder: "Buscar ejemplos…",
  },
};

export const SUPPORTED_LANGUAGES = ["en", "es"];
export const DEFAULT_LANGUAGE = "en";
