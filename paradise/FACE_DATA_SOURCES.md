# Paradise Face Data Sources

The Paradise runtime currently uses procedural placeholder character variants.
The open-source character-generation references downloaded for the next pass are
kept outside the deploy tree to avoid accidentally publishing large source
repositories or vendored assets.

Local source vault:

`/Users/johnmobley/asset-vault/open-source-face-data/paradise-face-sources`

Downloaded sources:

- `makehuman/` from `https://github.com/makehumancommunity/makehuman`
- `mpfb2/` from `https://github.com/makehumancommunity/mpfb2`

Next integration step:

Export a small set of license-compatible GLB character meshes from the local
source vault, then load only those optimized runtime assets into Paradise.
