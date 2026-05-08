// Symbol palette data — Greek/arrows/operators/relations/misc.
// `command` is the LaTeX command inserted at the cursor (use inside math
// mode). `label` is a human-readable description for the tooltip + search.
export type SymbolCategory =
  | 'Greek'
  | 'Arrows'
  | 'Operators'
  | 'Relations'
  | 'Misc'

export interface SymbolEntry {
  char: string
  command: string
  label: string
  category: SymbolCategory
}

export const SYMBOL_CATEGORIES: SymbolCategory[] = [
  'Greek',
  'Arrows',
  'Operators',
  'Relations',
  'Misc',
]

export const SYMBOLS: SymbolEntry[] = [
  // Greek — lowercase
  { char: 'α', command: '\\alpha', label: 'Lowercase Greek letter alpha', category: 'Greek' },
  { char: 'β', command: '\\beta', label: 'Lowercase Greek letter beta', category: 'Greek' },
  { char: 'γ', command: '\\gamma', label: 'Lowercase Greek letter gamma', category: 'Greek' },
  { char: 'δ', command: '\\delta', label: 'Lowercase Greek letter delta', category: 'Greek' },
  { char: 'ε', command: '\\varepsilon', label: 'Lowercase Greek letter epsilon, varepsilon', category: 'Greek' },
  { char: 'ϵ', command: '\\epsilon', label: 'Lowercase Greek letter epsilon lunate', category: 'Greek' },
  { char: 'ζ', command: '\\zeta', label: 'Lowercase Greek letter zeta', category: 'Greek' },
  { char: 'η', command: '\\eta', label: 'Lowercase Greek letter eta', category: 'Greek' },
  { char: 'ϑ', command: '\\vartheta', label: 'Lowercase Greek letter curly theta, vartheta', category: 'Greek' },
  { char: 'θ', command: '\\theta', label: 'Lowercase Greek letter theta', category: 'Greek' },
  { char: 'ι', command: '\\iota', label: 'Lowercase Greek letter iota', category: 'Greek' },
  { char: 'κ', command: '\\kappa', label: 'Lowercase Greek letter kappa', category: 'Greek' },
  { char: 'λ', command: '\\lambda', label: 'Lowercase Greek letter lambda', category: 'Greek' },
  { char: 'μ', command: '\\mu', label: 'Lowercase Greek letter mu', category: 'Greek' },
  { char: 'ν', command: '\\nu', label: 'Lowercase Greek letter nu', category: 'Greek' },
  { char: 'ξ', command: '\\xi', label: 'Lowercase Greek letter xi', category: 'Greek' },
  { char: 'π', command: '\\pi', label: 'Lowercase Greek letter pi', category: 'Greek' },
  { char: 'ϱ', command: '\\varrho', label: 'Lowercase Greek letter rho, varrho', category: 'Greek' },
  { char: 'ρ', command: '\\rho', label: 'Lowercase Greek letter rho', category: 'Greek' },
  { char: 'σ', command: '\\sigma', label: 'Lowercase Greek letter sigma', category: 'Greek' },
  { char: 'ς', command: '\\varsigma', label: 'Lowercase Greek letter final sigma, varsigma', category: 'Greek' },
  { char: 'τ', command: '\\tau', label: 'Lowercase Greek letter tau', category: 'Greek' },
  { char: 'υ', command: '\\upsilon', label: 'Lowercase Greek letter upsilon', category: 'Greek' },
  { char: 'ϕ', command: '\\phi', label: 'Lowercase Greek letter phi', category: 'Greek' },
  { char: 'φ', command: '\\varphi', label: 'Lowercase Greek letter phi, varphi', category: 'Greek' },
  { char: 'χ', command: '\\chi', label: 'Lowercase Greek letter chi', category: 'Greek' },
  { char: 'ψ', command: '\\psi', label: 'Lowercase Greek letter psi', category: 'Greek' },
  { char: 'ω', command: '\\omega', label: 'Lowercase Greek letter omega', category: 'Greek' },
  // Greek — uppercase
  { char: 'Γ', command: '\\Gamma', label: 'Uppercase Greek letter Gamma', category: 'Greek' },
  { char: 'Δ', command: '\\Delta', label: 'Uppercase Greek letter Delta', category: 'Greek' },
  { char: 'Θ', command: '\\Theta', label: 'Uppercase Greek letter Theta', category: 'Greek' },
  { char: 'Λ', command: '\\Lambda', label: 'Uppercase Greek letter Lambda', category: 'Greek' },
  { char: 'Ξ', command: '\\Xi', label: 'Uppercase Greek letter Xi', category: 'Greek' },
  { char: 'Π', command: '\\Pi', label: 'Uppercase Greek letter Pi', category: 'Greek' },
  { char: 'Σ', command: '\\Sigma', label: 'Uppercase Greek letter Sigma', category: 'Greek' },
  { char: 'Υ', command: '\\Upsilon', label: 'Uppercase Greek letter Upsilon', category: 'Greek' },
  { char: 'Φ', command: '\\Phi', label: 'Uppercase Greek letter Phi', category: 'Greek' },
  { char: 'Ψ', command: '\\Psi', label: 'Uppercase Greek letter Psi', category: 'Greek' },
  { char: 'Ω', command: '\\Omega', label: 'Uppercase Greek letter Omega', category: 'Greek' },

  // Arrows
  { char: '←', command: '\\leftarrow', label: 'Leftward arrow', category: 'Arrows' },
  { char: '→', command: '\\rightarrow', label: 'Rightward arrow', category: 'Arrows' },
  { char: '↔', command: '\\leftrightarrow', label: 'Left and right arrow', category: 'Arrows' },
  { char: '↑', command: '\\uparrow', label: 'Upward arrow', category: 'Arrows' },
  { char: '↓', command: '\\downarrow', label: 'Downward arrow', category: 'Arrows' },
  { char: '⇐', command: '\\Leftarrow', label: 'Is implied by', category: 'Arrows' },
  { char: '⇒', command: '\\Rightarrow', label: 'Implies', category: 'Arrows' },
  { char: '⇔', command: '\\Leftrightarrow', label: 'Left and right double arrow', category: 'Arrows' },
  { char: '↦', command: '\\mapsto', label: 'Maps to, rightward', category: 'Arrows' },
  { char: '↗', command: '\\nearrow', label: 'NE pointing arrow', category: 'Arrows' },
  { char: '↘', command: '\\searrow', label: 'SE pointing arrow', category: 'Arrows' },
  { char: '⇌', command: '\\rightleftharpoons', label: 'Right harpoon over left', category: 'Arrows' },
  { char: '↼', command: '\\leftharpoonup', label: 'Left harpoon up', category: 'Arrows' },
  { char: '⇀', command: '\\rightharpoonup', label: 'Right harpoon up', category: 'Arrows' },
  { char: '↽', command: '\\leftharpoondown', label: 'Left harpoon down', category: 'Arrows' },
  { char: '⇁', command: '\\rightharpoondown', label: 'Right harpoon down', category: 'Arrows' },

  // Operators
  { char: '×', command: '\\times', label: 'Cross product, multiplication', category: 'Operators' },
  { char: '÷', command: '\\div', label: 'Division', category: 'Operators' },
  { char: '∩', command: '\\cap', label: 'Intersection', category: 'Operators' },
  { char: '∪', command: '\\cup', label: 'Union', category: 'Operators' },
  { char: '⋅', command: '\\cdot', label: 'Dot product, multiplication', category: 'Operators' },
  { char: '⋯', command: '\\cdots', label: 'Centered dots', category: 'Operators' },
  { char: '∙', command: '\\bullet', label: 'Bullet', category: 'Operators' },
  { char: '∘', command: '\\circ', label: 'Circle', category: 'Operators' },
  { char: '∧', command: '\\wedge', label: 'Wedge, logical and', category: 'Operators' },
  { char: '∨', command: '\\vee', label: 'Vee, logical or', category: 'Operators' },
  { char: '∖', command: '\\setminus', label: 'Set minus, backslash', category: 'Operators' },
  { char: '⊕', command: '\\oplus', label: 'Plus sign in circle', category: 'Operators' },
  { char: '⊗', command: '\\otimes', label: 'Multiply sign in circle', category: 'Operators' },
  { char: '∑', command: '\\sum', label: 'Summation operator', category: 'Operators' },
  { char: '∏', command: '\\prod', label: 'Product operator', category: 'Operators' },
  { char: '⋂', command: '\\bigcap', label: 'Intersection operator', category: 'Operators' },
  { char: '⋃', command: '\\bigcup', label: 'Union operator', category: 'Operators' },
  { char: '∫', command: '\\int', label: 'Integral operator', category: 'Operators' },
  { char: '∬', command: '\\iint', label: 'Double integral operator', category: 'Operators' },
  { char: '∭', command: '\\iiint', label: 'Triple integral operator', category: 'Operators' },

  // Relations
  { char: '≠', command: '\\neq', label: 'Not equal', category: 'Relations' },
  { char: '≤', command: '\\leq', label: 'Less than or equal', category: 'Relations' },
  { char: '≥', command: '\\geq', label: 'Greater than or equal', category: 'Relations' },
  { char: '≪', command: '\\ll', label: 'Much less than', category: 'Relations' },
  { char: '≫', command: '\\gg', label: 'Much greater than', category: 'Relations' },
  { char: '≺', command: '\\prec', label: 'Precedes', category: 'Relations' },
  { char: '≻', command: '\\succ', label: 'Succeeds', category: 'Relations' },
  { char: '∈', command: '\\in', label: 'Set membership', category: 'Relations' },
  { char: '∉', command: '\\notin', label: 'Negated set membership', category: 'Relations' },
  { char: '∋', command: '\\ni', label: 'Contains', category: 'Relations' },
  { char: '⊂', command: '\\subset', label: 'Subset', category: 'Relations' },
  { char: '⊆', command: '\\subseteq', label: 'Subset or equals', category: 'Relations' },
  { char: '⊃', command: '\\supset', label: 'Superset', category: 'Relations' },
  { char: '≃', command: '\\simeq', label: 'Similar', category: 'Relations' },
  { char: '≈', command: '\\approx', label: 'Approximate', category: 'Relations' },
  { char: '≡', command: '\\equiv', label: 'Identical with', category: 'Relations' },
  { char: '≅', command: '\\cong', label: 'Congruent with', category: 'Relations' },
  { char: '∣', command: '\\mid', label: 'Mid, divides, vertical bar, modulus, absolute value', category: 'Relations' },
  { char: '∤', command: '\\nmid', label: 'Negated mid, not divides', category: 'Relations' },
  { char: '∥', command: '\\parallel', label: 'Parallel, double vertical bar, norm', category: 'Relations' },
  { char: '⟂', command: '\\perp', label: 'Perpendicular', category: 'Relations' },

  // Misc
  { char: '∞', command: '\\infty', label: 'Infinity', category: 'Misc' },
  { char: '∂', command: '\\partial', label: 'Partial differential', category: 'Misc' },
  { char: '∇', command: '\\nabla', label: 'Nabla, del, hamilton operator', category: 'Misc' },
  { char: '∅', command: '\\emptyset', label: 'Empty set', category: 'Misc' },
  { char: '∀', command: '\\forall', label: 'For all', category: 'Misc' },
  { char: '∃', command: '\\exists', label: 'There exists', category: 'Misc' },
  { char: '¬', command: '\\neg', label: 'Not sign', category: 'Misc' },
  { char: 'ℜ', command: '\\Re', label: 'Real part', category: 'Misc' },
  { char: 'ℑ', command: '\\Im', label: 'Imaginary part', category: 'Misc' },
  { char: '□', command: '\\square', label: 'Square', category: 'Misc' },
  { char: '△', command: '\\triangle', label: 'Triangle', category: 'Misc' },
  { char: 'ℵ', command: '\\aleph', label: 'Hebrew letter aleph', category: 'Misc' },
  { char: '℘', command: '\\wp', label: 'Weierstrass letter p', category: 'Misc' },
  { char: '#', command: '\\#', label: 'Number sign, hashtag', category: 'Misc' },
  { char: '$', command: '\\$', label: 'Dollar sign', category: 'Misc' },
  { char: '%', command: '\\%', label: 'Percent sign', category: 'Misc' },
  { char: '&', command: '\\&', label: 'Et sign, and, ampersand', category: 'Misc' },
  { char: '{', command: '\\{', label: 'Left curly brace', category: 'Misc' },
  { char: '}', command: '\\}', label: 'Right curly brace', category: 'Misc' },
  { char: '⟨', command: '\\langle', label: 'Left angle bracket, bra', category: 'Misc' },
  { char: '⟩', command: '\\rangle', label: 'Right angle bracket, ket', category: 'Misc' },
]
