---
name: Zod resolver compatibility
description: Why ClinicSquad's React Hook Form resolver version must support both Zod 3 and Zod 4 in the pnpm workspace.
---

Use an `@hookform/resolvers` release that explicitly supports both Zod 3 and Zod 4 when maintaining ClinicSquad's Zod 3 forms. Older resolver declarations import an unqualified `zod` type without declaring Zod as a peer, so pnpm can resolve those declarations against a different workspace Zod major than the form schemas. The mismatch appears as every resolver rejecting Zod 3 schemas, even when the schemas themselves have no transforms.

**Why:** The resolver's declaration resolved against a shared Zod 4 installation while ClinicSquad imported Zod 3. The mismatch caused workspace typecheck failures across otherwise ordinary forms.

**How to apply:** When changing resolver or Zod versions, check the resolver's declared Zod peer range and test type resolution from the ClinicSquad package before modifying individual form schemas. For transformed fields, model form input and parsed output as separate React Hook Form generics.
