# TypeScript

Imports carry the `.ts` or `.tsx` extension; nothing compiles the output.

`exactOptionalPropertyTypes` is on. Set an optional field with `...(value !== undefined ? { key: value } : {})`, never `key: value ?? undefined`.

Never `as unknown as X`: it silences a mismatch that is still there at runtime. Fix the value or narrow with a type guard. A single `as` stays for what the compiler cannot see.

`noUncheckedIndexedAccess` is on, which makes `!` the idiom for an index that was just bounds-checked. That is why Biome's `noNonNullAssertion` is off: a rule that contradicts the compiler is turned off rather than worked around.
