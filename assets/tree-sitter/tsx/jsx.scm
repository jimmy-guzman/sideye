; Give JSX element and attribute names their own theme groups. This overlay is
; appended after the bundled query, and OpenTUI resolves overlapping captures by
; specificity then order: `@tag.attribute` (specificity 2) outranks the bundled
; `@variable.member` on attribute names, and `@tag`, appended last, outranks the
; bundled `@variable` on element names. OpenTUI does not implement `#lua-match?`,
; so case-based predicates cannot distinguish components here; every element name
; gets `@tag`.
(jsx_opening_element name: (identifier) @tag)
(jsx_closing_element name: (identifier) @tag)
(jsx_self_closing_element name: (identifier) @tag)
(jsx_attribute (property_identifier) @tag.attribute)
