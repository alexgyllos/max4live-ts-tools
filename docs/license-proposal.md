# Proposed licence — owner approval required

**Draft only. This document does not grant a licence.** The package remains `UNLICENSED` and private. Repository possession/commit author names do not establish copyright ownership or authority to relicense. The owner must verify redistribution rights for the source/fixtures, approve the copyright holder/name and year, and explicitly approve MIT before a LICENSE file or MIT package metadata is committed.

Proposed text for an approved LICENSE (replace attribution with the verified rights holder):

```text
MIT License

Copyright (c) 2026 [verified copyright holder]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Dependencies (Zod and development tools) have their own licences; `npm run audit:history` prints installed direct dependency licence metadata. They are installed as dependencies, not vendored into this source. Legal sign-off must review the complete transitive inventory and final tarball, not infer ownership from package metadata alone.
