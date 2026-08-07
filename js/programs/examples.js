// Built-in example programs. Each entry references a translation key under
// `i18n.examples.<value>` that holds `label`, `blurb`, and `expected`.

export const PROGRAMS = [
  {
    value: "1",
    input: "3\n4",
    code: `      INP
      STA num1
      INP
      ADD num1
      OUT
      HLT

num1  DAT
`,
  },
  {
    value: "2",
    input: "7\n12",
    code: `      INP
      STA num1
      INP
      STA num2
      SUB num1
      BRP pos
      LDA num1
      OUT
      BRA exit
pos   LDA num2
      OUT
exit  HLT

num1  DAT
num2  DAT
`,
  },
  {
    value: "3",
    input: "5",
    code: `        INP
loop    OUT
        STA count
        SUB one
        STA count
        BRP loop
        HLT

one     DAT 1
count   DAT
`,
  },
  {
    value: "4",
    input: "4\n5",
    code: `        INP
        STA NUM1
        INP
        STA NUM2
LOOP    LDA TOTAL
        ADD NUM1
        STA TOTAL
        LDA NUM2
        SUB ONE
        STA NUM2
        BRP LOOP
        LDA TOTAL
        SUB NUM1
        STA TOTAL
        OUT
        HLT

NUM1    DAT
NUM2    DAT
ONE     DAT 1
TOTAL   DAT 0
`,
  },
  {
    value: "5",
    input: "",
    code: `loop    LDA number
        ADD counter
        OUT
        STA number
        LDA counter
        ADD one
        STA counter
        LDA ten
        SUB counter
        BRP loop
        HLT

counter DAT 1
number  DAT 0
one     DAT 1
ten     DAT 10
`,
  },
  {
    value: "6",
    input: "5",
    code: `          INP
          STA final
          BRZ oneval
          SUB one
          STA iteration
          STA counter
          LDA final
          STA num
mult      LDA iteration
          BRZ end
          SUB one
          BRZ end
          LDA final
          ADD num
          STA final
          LDA counter
          SUB one
          STA counter
          SUB one
          BRZ next
          BRA mult
next      LDA final
          STA num
          LDA iteration
          SUB one
          STA iteration
          STA counter
          SUB one
          BRZ end
          BRA mult
end       LDA final
          OUT
          HLT
oneval    LDA one
          OUT
          HLT

final     DAT 0
counter   DAT 0
one       DAT 1
iteration DAT 0
num       DAT 0
`,
  },
  {
    value: "7",
    input: "",
    code: `LDA #5
ADD #7
SUB #2
OUT
`,
  },
  {
    value: "8",
    input: "2",
    code: `        INP
loop    STA count
        STA @address
        LDA address
        SUB one
        STA address
        LDA count
        SUB one
        BRP loop
        HLT

count   DAT
one     DAT 1
address DAT 99
`,
  },
  {
    value: "9",
    input: "",
    code: `        LDA #0
        STA n
loop    LDA n
        OUT
        LDA n
        ADD #1
        STA n
        SUB ten
        BRP done
        BRA loop
done    HLT

n       DAT
ten     DAT 10
`,
  },
  {
    value: "10",
    input: "10",
    code: `      INP
      STA N
      LDA #0
      STA total
      LDA N
      STA counter
loop  LDA total
      ADD counter
      STA total
      LDA counter
      SUB #1
      STA counter
      BRP loop
      LDA total
      OUT
      HLT

N       DAT
counter DAT
total   DAT
`,
  },
  {
    value: "11",
    input: "5",
    code: `      INP
      STA endN
      LDA #0
      STA counter
loop  LDA counter
      OUT
      LDA counter
      SUB endN
      BRP done
      LDA counter
      ADD #1
      STA counter
      BRA loop
done  HLT

counter DAT
endN    DAT
`,
  },
  {
    value: "12",
    input: "-8",
    code: `      INP
      STA x
      BRP done
      LDA #0
      SUB x
      OUT
      HLT
done  LDA x
      OUT
      HLT

x     DAT
`,
  },
];

// Helper: get the translated metadata for a program.
export function getProgramMeta(p, t) {
  const meta = t(`examples.${p.value}`) || {};
  return {
    label: meta.label || `Example ${p.value}`,
    blurb: meta.blurb || "",
    expected: meta.expected || "—",
  };
}
