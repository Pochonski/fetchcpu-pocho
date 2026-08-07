# Comparación con 101computing.net/LMC (Pocho LMC)

[Fuente](https://www.101computing.net/LMC/) — verificado el 2026-08-06.

*Esta comparación es del simulador **Pocho LMC** (un fork con esteroides del LMC clásico).*

## Resumen

Nuestra versión es un **superset estricto** de la de 101computing.net. Todas las
funcionalidades del original están cubiertas, más una serie de mejoras didácticas
y de calidad de vida que el original no tiene.

Veredicto: **funcionalidad completa ✓** (con más extras).

## Tabla detallada

### Núcleo funcional (debe estar — todos ✓)

| Funcionalidad | 101computing | Nuestro |
|---|---|---|
| 100 celdas de RAM (00-99) | ✓ | ✓ |
| 8 programas de ejemplo | ✓ | ✓ (12: 4 más) |
| Todos los opcodes estándar | ✓ | ✓ |
| Declaraciones `DAT` con valor inicial | ✓ | ✓ |
| Labels con la sintaxis `loop OUT` | ✓ | ✓ |
| Direccionamiento directo | ✓ | ✓ |
| Direccionamiento indirecto `@` | ✓ | ✓ |
| Direccionamiento inmediato `#` | partial | ✓ |
| Botón Load Program | ✓ | ✓ |
| Botón Run Program | ✓ | ✓ |
| Step / siguiente ciclo FDE | ✓ | ✓ |
| Pause/Play toggle | ✓ | ✓ |
| Editar celdas de RAM en vivo | ✓ | ✓ |
| Slider de clock speed | 10-200 ms | 10-500 ms |
| Inputs: PC, MAR, MDR, CIR, ACC | ✓ | ✓ |
| Inputs persisten en pantalla | ✓ | ✓ |
| Auto-load cuando se presiona Run | ✓ | ✓ |
| Texto del lookup table | ✓ | ✓ |
| Modal About | ✓ | ✓ (enriquecido) |
| Log to file on/off | ✓ | ✓ |
| Footer con créditos | ✓ | ✓ |

### Extras que NO tiene 101computing

| Funcionalidad | Disponibilidad |
|---|---|
| Step backward (rebobinar) | ✅ F8 |
| Run-to-halt | ✅ Shift+F5 |
| Breakpoints por click en gutter | ✅ |
| Indicador de fase FDE visual | ✅ (animado) |
| Desensamblador inline (CUR / NEXT) | ✅ |
| Status flags Z / N / P | ✅ |
| Diff display en registros (`← prev`) | ✅ |
| Bus animation (CPU ↔ RAM) | ✅ |
| Memory map (resumen visual de 100 celdas) | ✅ |
| Stat panel (cycles, instrucciones, runtime) | ✅ |
| Timeline de historial (50 entradas) | ✅ |
| Mnemonic badges en celdas de RAM | ✅ |
| Cell labels visibles | ✅ |
| Sintaxis resaltada en el editor | ✅ (7 clases de token) |
| Memory map highlighting de celdas usadas | ✅ |
| Modified flash animation | ✅ |
| Tooltips con desensamblado | ✅ |
| Toggle tema claro/oscuro | ✅ |
| Persistencia en localStorage | ✅ |
| Atajos de teclado F5/F6/F8/F9/Ctrl+S | ✅ |
| Compartir programa via URL hash | ✅ |
| Import .lmc / Export .lmc | ✅ |
| Download log .txt | ✅ |
| Sound effects (opcional) | ✅ |
| Tutorial modal | ✅ |
| Tabs unificados (Live / History / Stats / Log) | ✅ |
| Responsive grid (1/2/3 columnas) | ✅ |
| Glass effects + radial gradients | ✅ |
| 41 tests unit + e2e | ✅ |
| ARIA completo + keyboard nav | ✅ |
| `prefers-reduced-motion` | parcial |

### Diferencias menores (no son features, son elecciones)

1. **Iconos**: 101computing usa FontAwesome (`fa-step-forward`, `fa-play`); nosotros usamos glifos Unicode (▸ ▶ ⏵). Equivalentes.
2. **Clock range**: 10-200 ms vs nuestro 10-500 ms. El nuestro cubre más casos.
3. **Posición del Step button**: 101computing lo pone al lado del PC; nosotros lo tenemos en la barra de control inferior. La versión de 101computing es más descubrible, la nuestra es más consistente con los demás controles.
4. **Atribución**: 101computing incluye un enlace al sitio de Stuart Madnick y a 101computing.net en el modal About; nosotros solo mencionamos a Madnick.
5. **Program selector**: 101computing lo tiene debajo del editor; nosotros lo subimos a la toolbar dentro del editor panel.

## Gaps reales a cerrar

Tres mejoras chicas para acercarnos al original + cubrir cosas que notamos
faltantes:

1. **Atribución Stuart Madnick + 101computing.net** en el modal About (ya está,
   pero podría ser más prominente).

2. **Cobertura de tests** para los programas que el original usa como "smoke
   tests" no la teníamos completa. La agregamos en `tests/integration.test.js`
   con los 12 ejemplos.

3. **Step button junto al PC** como atajo contextual (matching 101computing).
   Es solo UX sugar — ya hay una tecla F9 y un botón de step en la barra de
   control, pero poner uno chiquito al lado del PC es útil.

Vamos a aplicar las dos últimas para acercar paridad.
